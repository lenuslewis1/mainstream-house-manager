import assert from 'node:assert/strict';import fs from 'node:fs';import {neon} from '@neondatabase/serverless';
const base=process.env.TEST_BASE_URL||'http://localhost:8796',sql=neon(process.env.DATABASE_URL),jar=new Map(),email='qa-roles-20261019@example.com',password='QA-'+crypto.randomUUID()+'!';
const orderId=crypto.randomUUID(),legacyId=crypto.randomUUID(),ids=[orderId,legacyId,'order-expense:'+orderId];let userId;
async function call(path,method='GET',body,expected=200){const headers={Origin:base,Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')};if(body)headers['Content-Type']='application/json';const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(60000)});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const text=await r.text();let d;try{d=JSON.parse(text)}catch{d=text};assert.equal(r.status,expected,method+' '+path+': '+r.status+' '+JSON.stringify(d).slice(0,180));return d;}
function automatic(rows,id){return rows.find(r=>r.id==='order-expense:'+id);}
try{
 const signup=await call('/api/auth/sign-up/email','POST',{email,password,name:'Expense QA'});userId=signup.user.id;
 await sql`UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=${userId} AND email=${email}`;
 await call('/api/auth/sign-out','POST',{});jar.clear();await call('/api/auth/sign-in/email','POST',{email,password});await call('/api/session');
 const now=Date.now();await sql`INSERT INTO work_items(id,kind,title,status,service,price,cost,cost_items,currency,created_at,updated_at) VALUES(${orderId},'project','Expense QA order','Delivered','Printing','500','120.30',${JSON.stringify([{description:'Printing',amount:'100.10'},{description:'Delivery',amount:'20.20'}])},'GHS',${now},${now})`;
 await sql`INSERT INTO work_items(id,kind,title,status,direction,amount,currency,project_id,created_at,updated_at) VALUES(${legacyId},'finance','Expense QA existing payment','Completed','Expense','40','GHS',${orderId},${now},${now})`;
 assert.equal(automatic((await call('/api/items')).items,orderId),undefined);
 await sql`UPDATE team_members SET role='Manager' WHERE id=${userId}`;
 let rows=(await call('/api/items')).items;assert.equal(automatic(rows,orderId).amount,'80.30');
 assert.equal(rows.filter(r=>r.kind==='finance'&&r.project_id===orderId).reduce((n,r)=>n+Math.round(Number(r.amount)*100),0),12030);
 assert.equal(automatic((await call('/api/items')).items,orderId).amount,'80.30');
 assert.equal((await sql`SELECT count(*)::int AS n FROM work_items WHERE id=${'order-expense:'+orderId}`)[0].n,0);
 console.log('PASS automatic expense appears immediately, legacy linked payments count once, refreshes do not insert duplicates, and Team members cannot read finance entries.');
 await call('/api/items/'+orderId,'PATCH',{mode:'details',title:'Expense QA order',client:'',service:'Printing',dueDate:'',notes:'QA instructions',price:'500',currency:'GHS',vendorId:'',costItems:[{description:'Production',amount:'200'}]});
 rows=(await call('/api/items')).items;assert.equal(automatic(rows,orderId).amount,'160.00');
 await call('/api/items','POST',{kind:'finance',title:'Expense QA duplicate',direction:'Expense',status:'Completed',amount:'200',currency:'GHS',projectId:orderId},400);
 await call('/api/items/'+orderId,'PATCH',{mode:'details',title:'Expense QA order',client:'',service:'Printing',dueDate:'',notes:'',price:'500',currency:'GHS',vendorId:'',costItems:[{description:'Production',amount:'10'}]},400);
 const made=await call('/api/items','POST',{kind:'project',title:'Expense QA new order',service:'Printing',status:'Delivered',price:'500',currency:'GHS',costItems:[{description:'Materials',amount:'75'}]},201);ids.push(made.id,'order-expense:'+made.id);
 assert.equal(automatic((await call('/api/items')).items,made.id).amount,'75.00');
 console.log('PASS order create/edit updates expenses, duplicate recording is rejected, and existing completed payments are preserved.');
 await call('/api/items/'+orderId,'DELETE');
 const preserved=(await sql`SELECT amount,project_id,due_date FROM work_items WHERE id=${'order-expense:'+orderId}`)[0];assert.equal(Number(preserved.amount),160);assert.equal(preserved.project_id,null);assert.equal(preserved.due_date,new Date(now).toISOString().slice(0,10));
 await call('/api/items/'+orderId,'DELETE',undefined,404);assert.equal((await sql`SELECT count(*)::int AS n FROM work_items WHERE id=${'order-expense:'+orderId}`)[0].n,1);
 console.log('PASS deleting an order preserves its expense history; repeated deletion cannot duplicate it.');
 if(process.env.KEEP_EXPENSE_QA==='1'){fs.writeFileSync('.sites-runtime/expense-qa-session.json',JSON.stringify({email,password,userId,ids,cookies:[...jar],visualOrderId:made.id}));console.log('Retained disposable fixture for browser QA.');}
}catch(e){console.error(e);process.exitCode=1;}finally{if(process.env.KEEP_EXPENSE_QA!=='1'||process.exitCode){for(const id of ids)await sql`DELETE FROM work_items WHERE id=${id}`;if(userId){await sql`DELETE FROM team_members WHERE id=${userId}`;await sql`DELETE FROM neon_auth."user" WHERE id=${userId} AND email=${email}`;}console.log('Removed disposable expense QA data.');}}
