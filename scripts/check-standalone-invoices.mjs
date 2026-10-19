import assert from "node:assert/strict";
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const base = process.env.TEST_BASE_URL || "http://localhost:8787";
const email = "qa-neon-20261019@example.com", password = `QA-${crypto.randomUUID()}!`;
const cookies = new Map(), invoiceIds = [];
let userId, orderId, succeeded = false;
async function call(path, method = "GET", body, status = 200, signedIn = true) {
  const headers = { Origin: base, Connection: "close", "Content-Type": "application/json" };
  if (signedIn) headers.Cookie = [...cookies].map(([key,value]) => `${key}=${value}`).join("; ");
  const response = await fetch(base+path,{ method,headers,body:body === undefined ? undefined : JSON.stringify(body),redirect:"manual",signal:AbortSignal.timeout(30000) });
  if(signedIn) for(const cookie of response.headers.getSetCookie()) { const pair=cookie.split(";")[0], index=pair.indexOf("=");cookies.set(pair.slice(0,index),pair.slice(index+1)); }
  const text = await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  assert.equal(response.status,status,`${method} ${path}: ${response.status} ${JSON.stringify(data).slice(0,300)}`);
  return data;
}
try {
  await call("/api/invoices","GET",undefined,401,false);
  await call("/api/invoices","POST",{},401,false);
  const signup=await call("/api/auth/sign-up/email","POST",{email,password,name:"Invoice QA"});userId=signup.user.id;
  await sql`UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=${userId} AND email=${email}`;
  await call("/api/auth/sign-out","POST",{});cookies.clear();
  await call("/api/auth/sign-in/email","POST",{email,password});
  await call("/api/session");
  await sql`UPDATE team_members SET role='Manager' WHERE id=${userId}`;
  const before=(await call("/api/items")).items.length;
  for(const body of [{},{orderId:null}]) invoiceIds.push((await call("/api/invoices","POST",body,201)).id);
  assert.notEqual(invoiceIds[0],invoiceIds[1]);
  for(const id of invoiceIds) assert.equal((await call(`/api/invoices/${id}`)).invoice.order_id,null);
  assert.equal((await call("/api/items")).items.length,before);
  console.log("PASS standalone invoices receive unique numbers without creating orders");
  const details={billToName:"Standalone invoice QA",billToDetails:"QA customer details",issueDate:"2026-10-19",dueDate:"2026-11-19",currency:"USD",lineItems:[{description:"Design services",quantity:2,unitPrice:"125.50"}],paymentDetails:"QA payment details"};
  await call(`/api/invoices/${invoiceIds[0]}`,"PATCH",details);
  const saved=(await call(`/api/invoices/${invoiceIds[0]}`)).invoice;
  assert.equal(saved.bill_to_name,details.billToName);assert.equal(saved.currency,"USD");assert.equal(saved.order_id,null);assert.deepEqual(saved.line_items,details.lineItems);
  await call(`/api/invoices/${invoiceIds[0]}`,"PATCH",{...details,billToName:""},400);
  assert.equal((await call(`/api/invoices/${invoiceIds[0]}`)).invoice.bill_to_name,details.billToName);
  console.log("PASS standalone customer, dates, currency, items and payment details save and reopen; invalid edits rejected");
  const list=(await call("/api/invoices")).invoices;
  for(const id of invoiceIds)assert.ok(list.some(invoice=>invoice.id===id&&invoice.order_id===null));
  const page=await call("/invoices");assert.ok(page.includes("Invoices"));
  console.log("PASS invoice list and protected invoices page include standalone drafts");
  await call("/api/invoices","POST",{orderId:42},400);
  await call("/api/invoices","POST",{orderId:"missing-invoice-qa-order"},404);
  orderId=(await call("/api/items","POST",{kind:"project",title:"Standalone invoice regression QA order",status:"Delivered",service:"Printing",currency:"GHS",price:"100",cost:"0"},201)).id;
  const linked=(await call("/api/invoices","POST",{orderId})).id;invoiceIds.push(linked);
  assert.equal((await call("/api/invoices","POST",{orderId})).id,linked);
  assert.equal((await call(`/api/invoices/${linked}`)).invoice.order_id,orderId);
  await call(`/api/invoices/${linked}`,"PATCH",details,400);
  await call(`/api/invoices/${linked}`,"PATCH",{...details,currency:"GHS"});
  console.log("PASS order-linked invoices remain retry-safe and retain their order currency");
  succeeded=true;
  if(process.env.KEEP_QA_USER==="1")fs.writeFileSync(".sites-runtime/qa-user.json",JSON.stringify({email,password,userId}));
  console.log("Standalone invoice integration checks passed.");
} finally {
  for(const id of invoiceIds)await sql`DELETE FROM invoices WHERE id=${id}`;
  if(orderId)await sql`DELETE FROM work_items WHERE id=${orderId}`;
  if(userId&&(!succeeded||process.env.KEEP_QA_USER!=="1")){await sql`DELETE FROM team_members WHERE id=${userId}`;await sql`DELETE FROM neon_auth."user" WHERE id=${userId} AND email=${email}`;}
}
