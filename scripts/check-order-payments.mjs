import assert from 'node:assert/strict';
import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';
const base=process.env.TEST_BASE_URL||'http://localhost:8787';
const email='qa-paid-20261020@example.com',password=`QA-${crypto.randomUUID()}!`,sql=neon(process.env.DATABASE_URL),jar=new Map(),orders=[];
let userId;
async function call(path,body,expected=200,signedIn=true){
 const headers={Origin:base,'Content-Type':'application/json'};
 if(signedIn)headers.Cookie=[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
 const r=await fetch(base+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
 const d=await r.json();assert.equal(r.status,expected,`${path}: ${r.status} ${JSON.stringify(d)}`);return d;
}
async function order(price='100',kind='project'){
 const id=crypto.randomUUID(),now=Date.now();orders.push(id);
 await sql`INSERT INTO work_items(id,kind,title,client,service,status,price,currency,created_at,updated_at) VALUES(${id},${kind},'Payment QA order','Payment QA customer','Printing','Planning',${price},'GHS',${now},${now})`;return id;
}
async function payment(id,amount,status='Completed'){
 const now=Date.now();await sql`INSERT INTO work_items(id,kind,title,status,amount,currency,direction,project_id,created_at,updated_at) VALUES(${crypto.randomUUID()},'finance','Payment QA receipt',${status},${amount},'GHS','Income',${id},${now},${now})`;
}
try{
 const full=await order();
 await call(`/api/orders/${full}/payment`,{expectedAmount:'100.00'},403,false);
 const signup=await call('/api/auth/sign-up/email',{email,password,name:'Payment QA'});userId=signup.user.id;
 await sql`UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=${userId} AND email=${email}`;
 await call('/api/auth/sign-out',{});jar.clear();await call('/api/auth/sign-in/email',{email,password});
 await sql`INSERT INTO team_members(id,name,email,last_seen,role) VALUES(${userId},'Payment QA',${email},${Date.now()},'Team member') ON CONFLICT(id) DO UPDATE SET role='Team member'`;
 await call(`/api/orders/${full}/payment`,{expectedAmount:'100.00'},403);
 await sql`UPDATE team_members SET role='Manager' WHERE id=${userId}`;
 console.log('PASS anonymous and Team member payment writes denied.');
 await call(`/api/orders/${full}/payment`,{expectedAmount:'99.00'},409);
 const concurrent=await Promise.all([fetch(base+`/api/orders/${full}/payment`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:JSON.stringify({expectedAmount:'100.00'})}),fetch(base+`/api/orders/${full}/payment`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:JSON.stringify({expectedAmount:'100.00'})})]);
 const codes=concurrent.map(r=>r.status).sort();for(const r of concurrent)await r.text();assert.deepEqual(codes,[200,201]);
 const receipts=await sql`SELECT amount,currency,status FROM work_items WHERE project_id=${full} AND kind='finance'`;assert.equal(receipts.length,1);assert.equal(Number(receipts[0].amount),100);assert.equal(receipts[0].status,'Completed');assert.equal(receipts[0].currency,'GHS');
 assert.equal((await sql`SELECT status FROM work_items WHERE id=${full}`)[0].status,'Planning');
 assert.equal((await call(`/api/orders/${full}/payment`,{expectedAmount:'100.00'})).alreadyPaid,true);
 console.log('PASS remaining balance recorded once under concurrent requests and retries; delivery status unchanged.');
 const partial=await order();await payment(partial,'40');const paid=await call(`/api/orders/${partial}/payment`,{expectedAmount:'60.00'},201);assert.equal(Number(paid.amount),60);
 const pending=await order();await payment(pending,'20','Pending');await call(`/api/orders/${pending}/payment`,{expectedAmount:'100.00'},409);
 assert.equal((await sql`SELECT count(*)::int AS n FROM work_items WHERE project_id=${pending}`)[0].n,1);
 const zero=await order('0');await call(`/api/orders/${zero}/payment`,{expectedAmount:'0.00'},400);
 const lead=await order('100','lead');await call(`/api/orders/${lead}/payment`,{expectedAmount:'100.00'},404);
 await call(`/api/orders/${crypto.randomUUID()}/payment`,{expectedAmount:'100.00'},404);
 await call(`/api/orders/${partial}/payment`,{expectedAmount:'-1'},400);
 console.log('PASS partial payments settle only the remainder; pending payments, missing prices, stale balances, invalid amounts, and non-orders are protected.');
 if(process.env.KEEP_PAYMENT_VISUAL==='1'){
   const visual=await order('123.45');orders.splice(orders.indexOf(visual),1);
   fs.mkdirSync('.sites-runtime',{recursive:true});fs.writeFileSync('.sites-runtime/payment-visual.json',JSON.stringify({id:visual}));
   console.log('Retained one disposable Payment QA order for browser verification.');
 }
}finally{
 for(const id of orders){await sql`DELETE FROM work_items WHERE project_id=${id} AND kind='finance'`;await sql`DELETE FROM work_items WHERE id=${id}`;}
 if(userId){await sql`DELETE FROM team_members WHERE id=${userId}`;await sql`DELETE FROM neon_auth."user" WHERE id=${userId} AND email=${email}`;}
 console.log('Removed disposable API test records and identity.');
}
