const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
function moduleFrom(path,resolve){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(resolve,m,m.exports);return m.exports;}
const roles=moduleFrom('lib/roles.ts',require);
assert.equal(roles.effectiveRole('LENUSLEWIS40@gmail.com','Team member'),'Super admin');
for(const role of ['Manager','Team member','Intern','Super admin'])assert.equal(roles.can(roles.effectiveRole('someone@example.com',role),'manageTeam'),false);
assert.equal(roles.can('Super admin','finance'),true);assert.ok(!roles.assignableRoles.includes('Super admin'));
let actor;const members=new Map([['root',{id:'root',email:roles.superAdminEmail,role:'Super admin'}],['staff',{id:'staff',email:'staff@example.com',role:'Team member'}]]);
const db={prepare(sql){return {sql,bind(...values){this.values=values;return this;},async first(){return members.get(this.values[0])||null;},async all(){return {results:[...members.values()]};}};},async batch(statements){assert.match(statements[0].sql,/pg_advisory_xact_lock/);assert.match(statements[1].sql,/actor.role='Super admin' AND lower\(actor.email\)=\$5/);const [role,id,previousRole,actorId,email]=statements[1].values;assert.equal(actorId,'root');assert.equal(email,roles.superAdminEmail);const member=members.get(id);if(member?.role!==previousRole)return [{meta:{}},{meta:{changes:0}}];member.role=role;return [{meta:{}},{meta:{changes:1}}];}};
const route=moduleFrom('app/api/team/route.ts',name=>name.endsWith('db/client')?{database:db}:name.endsWith('chatgpt-auth')?{getChatGPTUser:async capability=>actor&&roles.can(roles.effectiveRole(actor.email,actor.role),capability)?actor:null}:name.endsWith('lib/roles')?roles:require(name));
async function patch(body){return route.PATCH(new Request('http://localhost/api/team',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));}
(async()=>{
actor={userId:'staff',email:'staff@example.com',role:'Manager'};assert.equal((await route.GET()).status,403);assert.equal((await patch({id:'staff',role:'Intern',previousRole:'Manager'})).status,403);
actor={userId:'root',email:roles.superAdminEmail,role:'Super admin'};assert.equal((await route.GET()).status,200);
assert.equal((await patch({id:'staff',role:'Intern',previousRole:'Team member'})).status,200);assert.equal(members.get('staff').role,'Intern');
assert.equal((await patch({id:'staff',role:'Manager',previousRole:'Team member'})).status,409);
assert.equal((await patch({id:'staff',role:'Super admin',previousRole:'Intern'})).status,403);
assert.equal((await patch({id:'root',role:'Intern',previousRole:'Super admin'})).status,403);
console.log('PASS reserved owner identity, full access, exclusive role assignment, protected Super admin, and stale writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
