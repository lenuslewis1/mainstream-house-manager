const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
function load(file, imports) {
  const mod = {exports:{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  },mod,mod.exports);
  return mod.exports;
}
const task = {title:'Prepare artwork',status:'To do',notes:'Use approved artwork.',dueDate:'2026-11-01',assignee:'Designer',assigneeId:'member-1',priority:'High',checklist:[],labels:'',referenceUrl:'https://example.com/brief',referenceDate:''};
const originalFetch=global.fetch;
const savedEnv={...process.env};
let queries=0,calls=[],transport='ok',member={name:'Designer',email:'designer@example.com'};
const {notifyTaskAssignee}=load('lib/task-assignment-email.ts',{'../db/client':{database:{prepare(){return {bind(){return this;},async first(){queries++;return member;}};}}}});
const input={id:'task-1',version:123,task,assignedBy:'Manager'};
global.fetch=async(url,options)=>{
 calls.push({url,options});
 if(transport==='network')throw new Error('Simulated timeout');
 if(transport==='transient'&&calls.length===1)return Response.json({error:'Unavailable'},{status:503});
 if(transport==='reject')return Response.json({error:'Sender not verified'},{status:403});
 return Response.json({id:'email-1'});
};
(async()=>{
 delete process.env.RESEND_API_KEY;delete process.env.TASK_EMAIL_FROM;
 assert.equal((await notifyTaskAssignee(input)).status,'not-configured');assert.equal(calls.length,0);
 process.env.RESEND_API_KEY='test-only-key';process.env.TASK_EMAIL_FROM='Tasks <tasks@example.com>';process.env.APP_URL='https://dashboard.example.com';
 assert.equal((await notifyTaskAssignee({...input,task:{...task,assigneeId:''}})).status,'skipped');
 assert.equal((await notifyTaskAssignee({...input,previousAssigneeId:task.assigneeId})).status,'skipped');assert.equal(queries,0);
 assert.equal((await notifyTaskAssignee(input)).status,'sent');assert.equal(calls.length,1);
 const mail=JSON.parse(calls[0].options.body);
 assert.deepEqual(mail.to,['designer@example.com']);assert.equal(calls[0].url,'https://api.resend.com/emails');
 for(const value of ['Prepare artwork','Use approved artwork.','High','2026-11-01','Manager','https://dashboard.example.com/?task=task-1'])assert.ok(mail.text.includes(value));
 calls=[];transport='transient';assert.equal((await notifyTaskAssignee(input)).status,'sent');assert.equal(calls.length,2);
 assert.equal(calls[0].options.headers['Idempotency-Key'],calls[1].options.headers['Idempotency-Key']);
 calls=[];transport='reject';assert.equal((await notifyTaskAssignee(input)).status,'failed');assert.equal(calls.length,1);
 calls=[];transport='network';assert.equal((await notifyTaskAssignee(input)).status,'failed');assert.equal(calls.length,2);
 calls=[];member=null;assert.equal((await notifyTaskAssignee(input)).status,'failed');assert.equal(calls.length,0);
 console.log('PASS email transport: trusted recipient, message details, assignment-only triggers, missing configuration, transient retries with stable idempotency, and failures.');

 let persisted=false,notified=[],old={...taskInput(),id:'task-1',updated_at:100},changes=1,role='Manager';
 function taskInput(){return {...task,kind:'task',due_date:task.dueDate,task_assignee:task.assignee,task_assignee_id:task.assigneeId,task_reference_url:'',task_reference_date:'',task_priority:'High',task_checklist:'[]',task_labels:''};}
 const db={prepare(sql){return {bind(){return this;},async first(){return sql.includes('team_members')?{name:'Designer'}:old;},async run(){persisted=true;return {meta:{changes}};}};},async batch(){persisted=true;return [];}};
 const kanban=load('lib/kanban.ts',{});
 const route=load('app/api/tasks/board/route.ts',{
  '../../../../db/client':{database:db},'../../../chatgpt-auth':{getChatGPTUser:async()=>({role,userId:'manager',email:'manager@example.com'})},
  '../../../../lib/kanban':kanban,'../../../../lib/team':{columns:async()=>[{id:'To do'},{id:'Done'}],memberName:async()=> 'Manager'},
  '../../../../lib/task-assignment-email':{notifyTaskAssignee:async arg=>{assert.equal(persisted,true,'Email must follow commit');notified.push(arg);return {status:'failed'};}},
 });
 const req=body=>new Request('https://dashboard.example.com/api/tasks/board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const created=await route.POST(req(task));assert.equal(created.status,201);assert.equal((await created.json()).notification.status,'failed');assert.equal(notified.length,1);
 notified=[];persisted=false;
 assert.equal((await route.PATCH(req({...task,id:'task-1',version:99}))).status,409);assert.equal(notified.length,0);
 changes=0;assert.equal((await route.PATCH(req({...task,id:'task-1',version:100}))).status,409);assert.equal(notified.length,0);
 changes=1;persisted=false;
 const updated=await route.PATCH(req({...task,assigneeId:'member-2',id:'task-1',version:100}));assert.equal(updated.status,200);assert.equal(notified[0].previousAssigneeId,'member-1');
 notified=[];role='Intern';assert.equal((await route.POST(req(task))).status,403);assert.equal(notified.length,0);
 console.log('PASS task routes: email follows successful save, failed email preserves task success, stale/conflicting writes and unauthorized task creation never send.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in savedEnv))delete process.env[key];Object.assign(process.env,savedEnv);});
