import { database as db } from "../../../../db/client";
import { storage } from "../../../../lib/storage";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { validMoney, cents } from "../../../../lib/finance";

import { parseFinanceDetails } from "../../../../lib/finance-reports";

import { parseOrderCosts, costTotal } from "../../../../lib/order-costs";

import { autoTasks } from "../../../../lib/auto-tasks";

export const runtime = "edge";

const statuses: Record<string, string[]> = {
  lead: ["New", "Contacted", "Proposal sent", "Won", "Lost"],
  project: ["Planning", "In progress", "In review", "Delivered", "On hold"],
  task: ["To do", "On hold", "Blocked", "In progress", "Review", "Done"],
  booking: ["Requested", "Confirmed", "Completed", "Cancelled"],
  finance: ["Pending", "Completed"],
};

function customerInsert(client: string, now: number) {
  return db.prepare("INSERT INTO contacts (id, kind, name, created_at, updated_at) SELECT $1, 'customer', $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE kind = 'customer' AND LOWER(TRIM(name)) = LOWER($5))")
    .bind(crypto.randomUUID(), client, now, now, client);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor=await getChatGPTUser();
  if (!actor) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    const item = await db.prepare("SELECT kind, source_lead_id, cost FROM work_items WHERE id = $1").bind(id).first<{kind: string; source_lead_id: string | null; cost:string}>();
    if (!item) return Response.json({ error: "Record not found" }, { status: 404 });
    if (item.kind === "finance" && !(await getChatGPTUser("finance"))) return Response.json({error:"Only managers can access finances."},{status:403});
    if (input.mode === "details") {
      if (item.kind === "finance") {
        const details = parseFinanceDetails(input);
        if (!details) return Response.json({ error: "Check category, payment method, and reference." }, { status: 400 });
        const title = String(input.title ?? "").trim();
        const client = String(input.client ?? "").trim();
        const notes = String(input.notes ?? "").trim();
        const dueDate = String(input.dueDate ?? "");
        const amount = String(input.amount ?? "").trim();
        const currency = String(input.currency ?? "").trim().toUpperCase();
        const direction = String(input.direction ?? "");
        const projectId = String(input.projectId ?? "").trim();
        if (!title || title.length > 160 || client.length > 160 || notes.length > 4000 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) || !validMoney(amount) || !/^[A-Z]{3}$/.test(currency) || !["Income", "Expense"].includes(direction)) return Response.json({ error: "Check the required fields." }, { status: 400 });
        if (projectId) {
          const project = await db.prepare("SELECT currency FROM work_items WHERE id = $1 AND kind IN ('project', 'booking')").bind(projectId).first<{currency: string}>();
          if (!project) return Response.json({ error: "Choose an existing order." }, { status: 400 });
          if ((project.currency || "GHS") !== currency) return Response.json({ error: "Finance entry currency must match the order currency." }, { status: 400 });
        }
        const now = Date.now();
        const statements = [db.prepare("UPDATE work_items SET title = $1, client = $2, notes = $3, due_date = $4, amount = $5, currency = $6, direction = $7, project_id = $8, updated_at = $9, category = $10, payment_method = $11, reference = $12 WHERE id = $13")
          .bind(title, client, notes, dueDate, amount, currency, direction, projectId || null, now, details.category, details.paymentMethod, details.reference, id)];
        if (client && direction === "Income") statements.push(customerInsert(client, now));
        await db.batch(statements);
        return Response.json({ ok: true });
      }
      if (item.kind !== "lead" && item.kind !== "project" && item.kind !== "booking" && item.kind !== "task") return Response.json({ error: "This record cannot be edited here." }, { status: 400 });
      const title = String(input.title ?? "").trim();
      const client = String(input.client ?? "").trim();
      const service = String(input.service ?? "").trim();
      const dueDate = String(input.dueDate ?? "");
      const notes = String(input.notes ?? "").trim();
      const vendorId = String(input.vendorId ?? "").trim();
      if ((item.kind === "project" || item.kind === "booking") && !service) return Response.json({ error: "Choose a service for this order." }, { status: 400 });
      if (!title || title.length > 160 || client.length > 160 || service.length > 160 || notes.length > 4000 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) || (item.kind === "booking" && !dueDate)) {
        return Response.json({ error: "Check the required fields." }, { status: 400 });
      }
      if (item.kind === "project" || item.kind === "booking") {
        const price = String(input.price ?? "0").trim();
        const costItems = input.costItems === undefined ? null : parseOrderCosts(input.costItems);
        if (input.costItems !== undefined && !costItems) return Response.json({ error: "Enter a description and valid amount for each order cost." }, { status: 400 });
        const cost = costItems ? costTotal(costItems) : String(input.cost ?? "0").trim();
        const currency = String(input.currency ?? "GHS").trim().toUpperCase();
        if (!validMoney(price) || !validMoney(cost) || !/^[A-Z]{3}$/.test(currency)) return Response.json({ error: "Enter a valid order price, cost, and currency." }, { status: 400 });
        const linked = await db.prepare("SELECT 1 FROM work_items WHERE project_id = $1 AND kind = 'finance' AND currency != $2 LIMIT 1").bind(id, currency).first();
        if (linked) return Response.json({ error: "Order currency must match its linked finance entries." }, { status: 409 });
        if (vendorId && !(await db.prepare("SELECT id FROM contacts WHERE id = $1 AND kind = 'partner'").bind(vendorId).first())) return Response.json({ error: "Choose an existing vendor." }, { status: 400 });
        const now = Date.now();
        const statements = [db.prepare("UPDATE work_items SET title = $1, client = $2, service = $3, due_date = $4, notes = $5, price = $6, cost = $7, currency = $8, vendor_id = $9, updated_at = $10, cost_items = $11 WHERE id = $12")
          .bind(title, client, service, dueDate, notes, price, cost, currency, vendorId || null, now, JSON.stringify(costItems || []), id)];
        if (client) statements.push(customerInsert(client, now));
        await db.batch(statements);
      } else {
        if (vendorId) return Response.json({ error: "Only orders can have vendors." }, { status: 400 });
        const now = Date.now();
        const statements = [db.prepare("UPDATE work_items SET title = $1, client = $2, service = $3, due_date = $4, notes = $5, updated_at = $6 WHERE id = $7")
          .bind(title, client, service, dueDate, notes, now, id)];
        if (client) statements.push(customerInsert(client, now));
        if (item.kind === "task") statements.push(db.prepare("INSERT INTO task_updates(id,task_id,author,body,kind,created_at) VALUES($1,$2,$3,$4,'activity',$5)").bind(crypto.randomUUID(),id,actor.displayName,"Updated task details",now));
        await db.batch(statements);
      }
      const tasks = ["project","booking"].includes(item.kind) ? await autoTasks("order",id) : undefined;
      return Response.json({ ok: true, tasks });
    }
    const status = String(input.status ?? "");
    if (!statuses[item.kind]?.includes(status)) return Response.json({ error: "Invalid status" }, { status: 400 });
    if (item.kind === "lead" && status !== "Won") {
      const project = await db.prepare("SELECT id FROM work_items WHERE source_lead_id = $1").bind(id).first();
      if (project) return Response.json({ error: "This lead is linked to a project and stays marked Won." }, { status: 409 });
    }
    if (item.kind === "lead" && status === "Won") {
      return Response.json({ error: "Use Convert to project to mark this lead Won." }, { status: 409 });
    }
    const now=Date.now();
    const changes=[db.prepare("UPDATE work_items SET status = $1, updated_at = $2 WHERE id = $3").bind(status,now,id)];
    if(item.kind === "task") changes.push(db.prepare("INSERT INTO task_updates(id,task_id,author,body,kind,created_at) VALUES($1,$2,$3,$4,'activity',$5)").bind(crypto.randomUUID(),id,actor.displayName,`Stage changed to ${status}`,now));
    await db.batch(changes);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to update work item", error);
    return Response.json({ error: "Could not update. Please try again." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  try {
    const item = await db.prepare("SELECT kind FROM work_items WHERE id=$1").bind(id).first<{kind:string}>();
    if (!item) return Response.json({error:"Record not found"},{status:404});
    if (item.kind === "finance" && !(await getChatGPTUser("finance"))) return Response.json({error:"Only managers can access finances."},{status:403});
    const leadAssets = await db.prepare("SELECT object_key FROM lead_assets WHERE lead_id = $1").bind(id).all<{ object_key: string }>();
    const projectAssets = await db.prepare("SELECT object_key FROM project_assets WHERE project_id = $1").bind(id).all<{ object_key: string }>();
    await db.batch([
      db.prepare("UPDATE work_items SET task_source_id = NULL WHERE task_source_kind = 'order' AND task_source_id = $1").bind(id),
      db.prepare("DELETE FROM task_generations WHERE source_key = $1").bind(`order:${id}`),
      db.prepare("UPDATE work_items SET source_lead_id = NULL WHERE source_lead_id = $1").bind(id),
      db.prepare("UPDATE work_items SET project_id = NULL WHERE project_id = $1").bind(id),
      db.prepare("DELETE FROM work_items WHERE id = $1").bind(id),
    ]);
    if (storage) {
      await Promise.all([...leadAssets.results, ...projectAssets.results].map(asset => storage.delete(asset.object_key).catch(error => console.error("Unable to clean up work asset", error))));
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to delete work item", error);
    return Response.json({ error: "Could not delete. Please try again." }, { status: 503 });
  }
}
