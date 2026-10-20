import { database as db } from "../../../db/client";
import { getChatGPTUser } from "../../chatgpt-auth";
import { memberName, rememberMember } from "../../../lib/team";
import { validMoney, withOrderExpenses, type FinanceRecord } from "../../../lib/finance";

import { parseFinanceDetails } from "../../../lib/finance-reports";

import { parseOrderCosts, costTotal } from "../../../lib/order-costs";

import { autoTasks } from "../../../lib/auto-tasks";

export const runtime = "edge";

const statuses: Record<string, string[]> = {
  lead: ["New", "Contacted", "Proposal sent", "Won", "Lost"],
  project: ["Planning", "In progress", "In review", "Delivered", "On hold"],
  task: ["To do", "On hold", "Blocked", "In progress", "Review", "Done"],
  booking: ["Requested", "Confirmed", "Completed", "Cancelled"],
  finance: ["Pending", "Completed"],
};

export async function GET() {
  const user=await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    await rememberMember(user);
    const data = await db.prepare("SELECT * FROM work_items WHERE ($1 IN ('Manager','Super admin') OR kind != 'finance') ORDER BY updated_at DESC").bind(user.role).all();
    return Response.json({ items: user.role === "Manager" || user.role === "Super admin" ? withOrderExpenses(data.results as FinanceRecord[]) : data.results });
  } catch (error) {
    console.error("Unable to load work items", error);
    return Response.json({ error: "Your records are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const actor = await getChatGPTUser();
  if (!actor) return Response.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  const kind = String(input.kind ?? "");
  if (kind === "finance" && !(await getChatGPTUser("finance"))) return Response.json({error:"Only managers can access finances."},{status:403});
  const title = String(input.title ?? "").trim();
  const status = String(input.status ?? "");
  const client = String(input.client ?? "").trim();
  const service = String(input.service ?? "").trim();
  const dueDate = String(input.dueDate ?? "");
  const notes = String(input.notes ?? "").trim();
  const amount = String(input.amount ?? "").trim();
  const currency = String(input.currency ?? "").trim().toUpperCase();
  const direction = String(input.direction ?? "");
  const price = String(input.price ?? "0").trim();
  const costItems = input.costItems === undefined ? [] : parseOrderCosts(input.costItems);
  if (!costItems) return Response.json({ error: "Enter a description and valid amount for each order cost." }, { status: 400 });
  const cost = input.costItems === undefined ? String(input.cost ?? "0").trim() : costTotal(costItems);
  const projectId = String(input.projectId ?? "").trim();
  const vendorId = String(input.vendorId ?? "").trim();
  if (["project", "booking"].includes(kind) && !service) return Response.json({ error: "Choose a service for this order." }, { status: 400 });
  if (!statuses[kind] || !title || title.length > 160 || !statuses[kind].includes(status) || (kind === "lead" && status === "Won") || client.length > 160 || service.length > 160 || notes.length > 4000 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) || (kind === "booking" && !dueDate) || (["project", "booking"].includes(kind) && (!validMoney(price) || !validMoney(cost) || !/^[A-Z]{3}$/.test(currency))) || (kind === "finance" && (!validMoney(amount) || !/^[A-Z]{3}$/.test(currency) || !["Income", "Expense"].includes(direction)))) {
    return Response.json({ error: "Check the required fields." }, { status: 400 });
  }
  const details = parseFinanceDetails(input);
  if (kind === "finance" && !details) return Response.json({ error: "Check category, payment method, and reference." }, { status: 400 });
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    if (kind === "finance" && direction === "Expense" && projectId) return Response.json({error:"Order costs already count as expenses. Edit the order costs instead of adding a second expense."},{status:400});
    if (kind === "finance" && projectId) {
      const project = await db.prepare("SELECT currency FROM work_items WHERE id = $1 AND kind IN ('project', 'booking')").bind(projectId).first<{currency: string}>();
      if (!project) return Response.json({ error: "Choose an existing order." }, { status: 400 });
      if ((project.currency || "GHS") !== currency) return Response.json({ error: "Finance entry currency must match the order currency." }, { status: 400 });
    }
    if (vendorId && (kind !== "project" && kind !== "booking" || !(await db.prepare("SELECT id FROM contacts WHERE id = $1 AND kind = 'partner'").bind(vendorId).first()))) {
      return Response.json({ error: "Choose an existing vendor." }, { status: 400 });
    }
    const statements = [db.prepare("INSERT INTO work_items (id, kind, title, client, service, status, due_date, notes, amount, currency, direction, price, cost, project_id, vendor_id, created_at, updated_at, category, payment_method, reference, cost_items, created_by_id, created_by_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)")
      .bind(id, kind, title, client, service, status, dueDate, notes, kind === "finance" ? amount : "", ["finance", "project", "booking"].includes(kind) ? currency : "", kind === "finance" ? direction : "", ["project", "booking"].includes(kind) ? price : "0", ["project", "booking"].includes(kind) ? cost : "0", kind === "finance" && projectId ? projectId : null, vendorId || null, now, now, kind === "finance" ? details?.category || "" : "", kind === "finance" ? details?.paymentMethod || "" : "", kind === "finance" ? details?.reference || "" : "", JSON.stringify(["project", "booking"].includes(kind) ? costItems : []), actor.userId, await memberName(actor))];
    if (client && !(kind === "finance" && direction === "Expense")) statements.push(db.prepare("INSERT INTO contacts (id, kind, name, created_at, updated_at) SELECT $1, 'customer', $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE kind = 'customer' AND LOWER(TRIM(name)) = LOWER($5))")
      .bind(crypto.randomUUID(), client, now, now, client));
    await db.batch(statements);
    const tasks = ["project","booking"].includes(kind) ? await autoTasks("order",id) : undefined;
    return Response.json({ id, tasks }, { status: 201 });
  } catch (error) {
    console.error("Unable to save work item", error);
    return Response.json({ error: "Could not save. Please try again." }, { status: 503 });
  }
}
