const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const dbPath=path.resolve('tmp/kanban-test.sqlite');fs.mkdirSync('tmp',{recursive:true});if(fs.existsSync(dbPath))fs.unlinkSync(dbPath);
const py=`import sqlite3,json,sys
p=json.load(sys.stdin)
c=sqlite3.connect(p['db'])
c.row_factory=sqlite3.Row
c.execute("PRAGMA foreign_keys=ON")
if 'migrations' in p:
 for sql in p['migrations']: c.executescript(sql)
 result=[]
else:
 result=[]
 with c:
  for q in p['queries']:
   r=c.execute(q['sql'],q.get('args',[]))
   result.append({'results':[dict(row) for row in r.fetchall()] if r.description else [],'meta':{'changes':max(0,r.rowcount)}})
print(json.dumps(result))`;
function run(p){const r=spawnSync('python',['-c',py],{input:JSON.stringify({db:dbPath,...p}),encoding:'utf8'});if(r.status)throw new Error(r.stderr);return JSON.parse(r.stdout);}
run({migrations:fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync('drizzle/'+f,'utf8'))});
const DB={prepare(sql){const q={sql,args:[]};return {q,bind(...args){q.args=args;return this;},async first(){return run({queries:[q]})[0].results[0]||null;},async all(){return run({queries:[q]})[0];},async run(){return run({queries:[q]})[0];}};},async batch(statements){return run({queries:statements.map(s=>s.q)});}};

let authenticated=true;
function load(file){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==='cloudflare:workers'?{env:{DB}}:name.endsWith('chatgpt-auth')?{getChatGPTUser:async()=>authenticated?{userId:'test-member',email:'tester@example.com',displayName:'Test member'}:null}:load(path.resolve(path.dirname(file),name+'.ts')),mod,mod.exports);return mod.exports;}
const route=load('app/api/tasks/board/route.ts'),{parseTask}=load('lib/kanban.ts');
const body={title:'Print quality check',status:'To do',notes:'Check final artwork',dueDate:'2026-10-20',assignee:'Test member',assigneeId:'test-member',referenceUrl:'https://example.com/artwork',referenceDate:'2026-10-19',priority:'High',labels:'Print, QA',checklist:[{id:'one',text:'Check colour',done:false}]};
const req=(data)=>new Request('https://test.local/api/tasks/board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const query=(sql,args=[])=>run({queries:[{sql,args}]})[0].results;
(async()=>{
assert.equal(parseTask({...body,dueDate:'2026-02-31'}),null);
assert.equal(parseTask({...body,checklist:[...body.checklist,...body.checklist]}),null);
authenticated=false;assert.equal((await route.POST(req(body))).status,401);authenticated=true;
assert.equal((await route.POST(req({...body,status:'unknown'}))).status,400);
await route.GET(new Request('https://test.local/api/tasks/board'));
const created=await route.POST(req(body));assert.equal(created.status,201);const {id}=await created.json();
let task=query('SELECT * FROM work_items WHERE id=?',[id])[0];assert.equal(task.task_assignee,body.assignee);assert.equal(task.task_priority,'High');assert.equal(JSON.parse(task.task_checklist)[0].done,false);
let res=await route.PATCH(req({...body,id,version:task.updated_at,status:'In progress',checklist:[{id:'one',text:'Check colour',done:true}]}));assert.equal(res.status,200);
assert.equal(query('SELECT * FROM task_updates WHERE task_id=?',[id]).length,2);
res=await route.PATCH(req({...body,id,version:task.updated_at,status:'Done'}));assert.equal(res.status,409);assert.equal(query('SELECT * FROM task_updates WHERE task_id=?',[id]).length,2);
assert.equal((await route.PATCH(req({id,comment:'Artwork approved. Ready to print.'}))).status,200);
assert.equal((await route.PATCH(req({id,comment:' '}))).status,400);
const updates=await (await route.GET(new Request('https://test.local/api/tasks/board?id='+id))).json();assert.equal(updates.updates.length,3);assert(updates.updates.some(u=>u.body.includes('Moved from To do to In progress')));
for(const stage of ['On hold','Blocked','Review','Done']){task=query('SELECT * FROM work_items WHERE id=?',[id])[0];assert.equal((await route.PATCH(req({...body,id,version:task.updated_at,status:stage}))).status,200);}
const result=await (await route.GET(new Request('https://test.local/api/tasks/board'))).json();assert.equal(result.tasks[0].status,'Done');assert.equal(result.me,'test-member');assert.equal(result.members[0].name,'Test member');
const cols=load('app/api/tasks/columns/route.ts');
assert.equal((await cols.POST(req({name:'Printing'}))).status,200);
const custom=query('SELECT * FROM task_columns WHERE name=?',['Printing'])[0];
task=query('SELECT * FROM work_items WHERE id=?',[id])[0];
assert.equal((await route.PATCH(req({...body,id,version:task.updated_at,status:custom.id}))).status,200);
assert.equal((await cols.PATCH(req({id:custom.id,name:'Production',version:custom.updated_at}))).status,200);
assert.equal(query('SELECT status FROM work_items WHERE id=?',[id])[0].status,custom.id);
assert.equal((await cols.PATCH(req({id:custom.id,name:'Stale',version:custom.updated_at}))).status,409);
assert.equal((await cols.POST(req({name:'production'}))).status,409);
assert.equal((await route.POST(req({...body,assigneeId:'fake'}))).status,400);
assert.equal((await route.POST(req({...body,referenceUrl:'javascript:alert(1)'}))).status,400);
assert.equal((await route.POST(req({...body,referenceDate:'2026-02-31'}))).status,400);
assert.equal(query('SELECT task_reference_url FROM work_items WHERE id=?',[id])[0].task_reference_url,body.referenceUrl);
const profile=load('app/api/tasks/profile/route.ts');assert.equal((await profile.PATCH(req({name:'New name',id:'someone-else'}))).status,200);
const refreshed=await (await route.GET(new Request('https://test.local/api/tasks/board'))).json();assert.equal(refreshed.members[0].name,'New name');assert.equal(refreshed.columns.find(c=>c.id===custom.id).name,'Production');
authenticated=false;assert.equal((await cols.POST(req({name:'No access'}))).status,401);authenticated=true;
query('DELETE FROM work_items WHERE id=?',[id]);assert.equal(query('SELECT * FROM task_updates WHERE task_id=?',[id]).length,0);
console.log('Kanban checks passed: migrations, auth, validation, task creation, assignments, checklists, six stages, comments, activity, stale edit rejection and delete cascade.');
})().catch(e=>{console.error(e);process.exit(1);});
