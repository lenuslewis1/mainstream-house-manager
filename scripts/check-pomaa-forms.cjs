const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
let extracted, signedIn = true, writes = 0;
const contacts = [{id:"vendor-1",kind:"partner",name:"Bright"},{id:"customer-1",kind:"customer",name:"Saved Customer"}];
const projects = [{id:"order-1",title:"Printing",currency:"GHS"}];
const cache = {};
function load(path) {
  path = require("node:path").resolve(path);
  if (cache[path]) return cache[path];
  const output = ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod = {exports:{}};
  new Function("require","module","exports",output)(name => {
    if(name === "cloudflare:workers") return {env:{DB:{prepare(sql){return {all:async()=>({results:sql.includes("FROM contacts")?contacts:projects}),run:async()=>{writes++;}}}}}};
    if(name.endsWith("chatgpt-auth")) return {getChatGPTUser:async()=>signedIn?{}:null};
    if(name.endsWith("/ai")) return {AIServiceError:class extends Error{},aiResponse:async(_instructions,_prompt,schema)=>{assert.equal(schema.name,"form_fields");return JSON.stringify(extracted);}};
    return load(require("node:path").resolve(require("node:path").dirname(path),name+".ts"));
  },mod,mod.exports);
  return cache[path]=mod.exports;
}
const {POST} = load("app/api/ai/forms/route.ts");
async function request(kind, keys, fields) {
  extracted = {fields:Object.entries(fields).map(([key,value])=>({key,value})),warnings:[]};
  return POST(new Request("https://example.test/api/ai/forms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,keys,prompt:"Fill the explicitly supplied details."})}));
}
(async()=>{
  for(const kind of ["lead","project","booking","task","finance","deliverable"]){const response=await request(kind,["title","notes"],{title:"Printing",notes:"Keep supplied details"}); assert.equal(response.status,200);assert.equal((await response.json()).fields.title,"Printing");}
  for(const kind of ["customer","partner"]){const response=await request(kind,["name","phone"],{name:"Example Business",phone:"0200000000"});assert.equal((await response.json()).fields.phone,"0200000000");}
  const invoice=await request("invoice",["lineItems"],{lineItems:JSON.stringify([{description:"Stickers",quantity:200,unitPrice:"2.50"}])}); assert.equal(JSON.parse((await invoice.json()).fields.lineItems)[0].quantity,200);
  const response=await request("finance",["title","amount","direction","currency","projectId","dueDate"],{title:"Print cost",amount:"-50",direction:"Made up",currency:"USD",projectId:"order-1",dueDate:"2026-02-30",vendorId:"invented"});const data=await response.json(); assert.equal(data.fields.currency,"GHS");assert.equal(data.fields.projectId,"order-1");for(const key of ["amount","direction","dueDate","vendorId"])assert.equal(data.fields[key],undefined);
  const refs=await request("project",["vendorId","client","service"],{vendorId:"invented",client:"saved customer",service:"invented"});const r=await refs.json();assert.equal(r.fields.client,"Saved Customer");assert.equal(r.fields.vendorId,undefined);assert.equal(r.fields.service,undefined);
  signedIn=false;assert.equal((await request("customer",["name"],{name:"Example"})).status,401);
  assert.equal(writes,0); console.log("Pomaa checks passed: all 9 forms, invoice lines, invalid fields, saved references, currency matching, authentication, and no writes.");
})().catch(error=>{console.error(error);process.exitCode=1;});
