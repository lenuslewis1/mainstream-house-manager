const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const dbPath=path.resolve('tmp/auto-tasks-test.sqlite');fs.mkdirSync('tmp',{recursive:true});if(fs.existsSync(dbPath))fs.unlinkSync(dbPath);
const py=`import sqlite3,json,sys
p=json.load(sys.stdin)
c=sqlite3.connect(p['db'])
c.row_factory=sqlite3.Row
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
let calls=0,fail=false,deleteSource=false;
function load(file){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==='cloudflare:workers'?{env:{DB}}:name==='./ai'?{aiResponse:async()=>{calls++;if(fail)throw new Error('Test AI failure');if(deleteSource)run({queries:[{sql:"DELETE FROM marketing_posts WHERE id='removed'"}]});return JSON.stringify({tasks:[{title:'Prepare artwork',notes:'Use approved specifications.'},{title:'Check quality',notes:'Check dimensions and output.'}]});}}:load(path.resolve(path.dirname(file),name+'.ts')),mod,mod.exports);return mod.exports;}
const {autoTasks,parseGeneratedTasks}=load('lib/auto-tasks.ts');
function order(id,status='Planning',date='2026-10-01'){run({queries:[{sql:"INSERT INTO work_items(id,kind,title,service,status,due_date,created_at,updated_at) VALUES(?,'project',?,'Business cards',?,?,1,1)",args:[id,'Order '+id,status,date]}]});}
(async()=>{
assert.equal(parseGeneratedTasks({tasks:[{title:'',notes:''}]}),null);assert.equal(parseGeneratedTasks({tasks:Array(6).fill({title:'Task',notes:''})}),null);
order('a');const results=await Promise.all([autoTasks('order','a'),autoTasks('order','a')]);assert.equal(calls,1);assert.equal(results.reduce((n,r)=>n+r.added,0),2);
const tasks=run({queries:[{sql:"SELECT * FROM work_items WHERE kind='task'"}]})[0].results;assert.equal(tasks[0].task_source_id,'a');assert.equal(tasks[0].due_date,'2026-10-01');
run({queries:[{sql:"UPDATE work_items SET due_date='2026-10-05' WHERE id='a'"}]});await autoTasks('order','a');assert.equal(run({queries:[{sql:"SELECT due_date FROM work_items WHERE task_source_id='a'"}]})[0].results[0].due_date,'2026-10-05');
run({queries:[{sql:"UPDATE work_items SET status='Done' WHERE kind='task'"}]});await autoTasks('order','a');assert.equal(calls,1);assert.equal(run({queries:[{sql:"SELECT COUNT(*) AS n FROM work_items WHERE kind='task' AND status='Done'"}]})[0].results[0].n,2);
order('b','Delivered');assert.equal((await autoTasks('order','b')).state,'Skipped');assert.equal(calls,1);
order('c','Planning','');fail=true;assert.equal((await autoTasks('order','c')).state,'Failed');fail=false;assert.equal((await autoTasks('order','c')).added,2);assert.equal(run({queries:[{sql:"SELECT due_date FROM work_items WHERE task_source_id='c'"}]})[0].results[0].due_date,'');
run({queries:[{sql:"INSERT INTO marketing_posts(id,title,date,channel,format,status,time,created_at,updated_at) VALUES('post','Content','2026-10-02','Instagram','Carousel','Draft','10:30',1,1)"}]});assert.equal((await autoTasks('content','post')).added,2);assert.equal(run({queries:[{sql:"SELECT due_date,notes FROM work_items WHERE task_source_id='post'"}]})[0].results[0].due_date,'2026-10-02');
run({queries:[{sql:"INSERT INTO marketing_posts(id,title,date,channel,format,status,created_at,updated_at) VALUES('removed','Content','2026-10-02','Instagram','Image','Draft',1,1)"}]});deleteSource=true;assert.equal((await autoTasks('content','removed')).added,0);assert.equal(run({queries:[{sql:"SELECT COUNT(*) AS n FROM work_items WHERE task_source_id='removed'"}]})[0].results[0].n,0);
console.log('Auto-task checks passed: real migrations, concurrent deduplication, completed task preservation, failure retry, source deadlines, linked content and deletion race.');
})().catch(e=>{console.error(e);process.exit(1);});
