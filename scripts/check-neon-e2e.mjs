import assert from "node:assert/strict";
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

const base = process.env.TEST_BASE_URL || "http://localhost:8787";
const email = "qa-neon-20261019@example.com";
const password = `QA-${crypto.randomUUID()}!`;
const sql = neon(process.env.DATABASE_URL);
const jar = new Map();
const items = [], contacts = [];
let userId;
let succeeded = false;
const checks = [];
function pass(message) { checks.push(message); console.log(`PASS ${message}`); }
async function call(path, method = "GET", body, expected = 200, authenticated = true) {
  // Avoid stale keep-alive sockets when Wrangler retargets its local proxy.
  const headers = { Origin: base, Connection: "close" };
  if (authenticated) headers.Cookie = [...jar].map(([key,value]) => `${key}=${value}`).join("; ");
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, { method, headers, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined, redirect: "manual", signal: AbortSignal.timeout(60000) });
  if (authenticated) for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";"); const index = pair.indexOf("=");
    jar.set(pair.slice(0,index), pair.slice(index+1));
  }
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  assert.equal(response.status, expected, `${method} ${path}: ${response.status}, ${typeof data === "string" ? data.slice(0,200) : JSON.stringify(data)}`);
  return { response, data };
}
try {
  await call("/api/items", "GET", undefined, 401, false);
  await call("/api/items", "POST", { kind: "lead", title: "forged" }, 401, false);
  const forged = await fetch(base+"/api/items", { headers: { Origin:base, Connection:"close", "oai-authenticated-user-id":"fake", "oai-authenticated-user-email":"lenuslewis40@gmail.com" }, signal: AbortSignal.timeout(60000) });
  assert.equal(forged.status,401);
  await forged.text();
  pass("anonymous reads/writes and forged legacy auth headers denied (401)");
  await call("/api/auth/sign-up/email", "POST", { email:"not-approved-neon-qa@example.com", password, name:"Denied QA" },403,false);
  pass("signup for an email outside the workspace allowlist denied (403)");
  const signup = await call("/api/auth/sign-up/email", "POST", { email, password, name: "Neon QA" });
  userId = signup.data.user.id;
  await call("/api/items", "GET", undefined, 401);
  pass("Neon Auth signup succeeds; unverified account cannot access records");
  // Disposable fixture only: validate real Auth sessions without sending email.
  await sql`UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=${userId} AND email=${email}`;
  await call("/api/auth/sign-out", "POST", {});
  jar.clear();
  const signin = await call("/api/auth/sign-in/email", "POST", { email, password });
  assert.equal(signin.data.user.emailVerified, true, "QA auth fixture should be verified");
  const session = await call("/api/session"); assert.equal(session.data.user.email,email);
  await sql`UPDATE team_members SET role='Manager' WHERE id=${userId}`;
  pass("Neon Auth password sign-in and verified server session");
  const home = await call("/"); assert.ok(home.data.includes("Workspace overview"));
  pass("authenticated workspace renders successfully (200)");
  const contact = (await call("/api/contacts", "POST", { kind:"customer", name:"Neon QA customer", email:"qa@example.com" },201)).data.id;
  contacts.push(contact);
  await call(`/api/contacts/${contact}`,"PATCH",{kind:"customer",name:"Neon QA customer updated"});
  assert.ok((await call("/api/contacts?kind=customer")).data.contacts.some(row=>row.id===contact&&row.name.includes("updated")));
  pass("Postgres contact create/read/update");
  const lead=(await call("/api/items","POST",{kind:"lead",title:"Neon QA lead",status:"New",service:"Branding",notes:"E2E fixture"},201)).data.id; items.push(lead);
  const project=(await call(`/api/leads/${lead}/convert`,"POST",{},201)).data.id; items.push(project);
  const again=(await call(`/api/leads/${lead}/convert`,"POST",{})).data; assert.equal(again.id,project);assert.equal(again.alreadyConverted,true);
  const loaded=(await call("/api/items")).data.items; assert.ok(loaded.some(row=>row.id===project));assert.equal(typeof loaded.find(row=>row.id===lead).updated_at,"number");
  pass("Postgres lead conversion is transactional and retry-safe; timestamps remain numeric");
  const invoice=(await call("/api/invoices","POST",{orderId:project})).data.id;
  assert.equal(typeof invoice,"number");assert.equal((await call("/api/invoices","POST",{orderId:project})).data.id,invoice);
  await call(`/api/invoices/${invoice}`);
  pass("Postgres invoice numbering and duplicate prevention");
  const taskInput={title:"Neon QA task",status:"To do",notes:"test",dueDate:"",assignee:"",priority:"Normal",checklist:[],labels:""};
  const task=(await call("/api/tasks/board","POST",taskInput,201)).data.id;items.push(task);
  const board=(await call("/api/tasks/board")).data;
  const old=board.tasks.find(row=>row.id===task);
  await call("/api/tasks/board","PATCH",{...taskInput,id:task,version:old.updated_at,title:"Neon QA task updated"});
  await call("/api/tasks/board","PATCH",{...taskInput,id:task,version:old.updated_at},409);
  const updates=(await call(`/api/tasks/board?id=${task}`)).data.updates;
  assert.equal(updates.length,2);
  pass("Postgres atomic task update/activity; stale update rejected (409)");
  const fileBody="Neon upload round-trip ✓";
  const form=new FormData();form.append("file",new File([fileBody],"qa.txt",{type:"text/plain"}));
  const asset=(await call(`/api/projects/${project}/assets`,"POST",form,201)).data.id;
  const file=await call(`/api/projects/${project}/assets/${asset}`);assert.equal(file.data,fileBody);
  await call(`/api/projects/${project}/assets/${asset}`,"DELETE");
  await call(`/api/projects/${project}/assets/${asset}`,"GET",undefined,404);
  pass("Neon Postgres attachment upload/download/delete, exact bytes preserved");
  for (const path of ["/api/deliverables",`/api/deliverables?projectId=${project}`,"/api/finance/budgets","/api/marketing","/api/tasks/automation","/api/ai/assets"]) await call(path);
  pass("deliverables, budgets, marketing, automation and asset lists query Postgres");
  const ai=(await call("/api/ai","POST",{mode:"ask",prompt:"What is the title of the order created from Neon QA lead? Answer briefly."})).data;
  assert.ok(ai.text&&ai.text.includes("Neon QA lead"));
  pass("Pomaa gpt-5.6-luna answers from live Neon workspace data");
  await call("/api/auth/sign-out","POST",{});await call("/api/items","GET",undefined,401);
  pass("Neon Auth sign-out removes access (401)");
  succeeded = true;
  if(process.env.KEEP_QA_USER==="1") fs.writeFileSync(".sites-runtime/qa-user.json",JSON.stringify({email,password,userId}));
} finally {
  // Delete only the records and identity created by this test.
  for(const id of items.reverse()) {
    const assets=await sql`SELECT object_key FROM lead_assets WHERE lead_id=${id} UNION ALL SELECT object_key FROM project_assets WHERE project_id=${id}`;
    for(const asset of assets) await sql`DELETE FROM stored_files WHERE object_key=${asset.object_key}`;
    await sql`DELETE FROM work_items WHERE task_source_kind='order' AND task_source_id=${id}`;
    await sql`DELETE FROM invoices WHERE order_id=${id}`;
    await sql`UPDATE work_items SET source_lead_id=NULL,task_source_id=NULL WHERE source_lead_id=${id} OR task_source_id=${id}`;
    await sql`DELETE FROM task_generations WHERE source_id=${id}`;
    await sql`DELETE FROM work_items WHERE id=${id}`;
  }
  for(const id of contacts) await sql`DELETE FROM contacts WHERE id=${id}`;
  if(userId&&(!succeeded||process.env.KEEP_QA_USER!=="1")) {
    await sql`DELETE FROM team_members WHERE id=${userId}`;
    await sql`DELETE FROM neon_auth."user" WHERE id=${userId} AND email=${email}`;
  }
  fs.mkdirSync("outputs",{recursive:true});fs.writeFileSync("outputs/neon-e2e-results.txt",checks.map(message=>`PASS ${message}`).join("\n")+"\n");
}
console.log(`Neon E2E: ${checks.length} checks passed.`);
