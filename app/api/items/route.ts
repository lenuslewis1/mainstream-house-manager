import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validMoney } from "../../../lib/finance";

export const runtime = "edge";

const statuses: Record<string, string[]> = {
  lead: ["New", "Contacted", "Proposal sent", "Won", "Lost"],
  project: ["Planning", "In progress", "In review", "Delivered", "On hold"],
  task: ["To do", "In progress", "Done"],
  booking: ["Requested", "Confirmed", "Completed", "Cancelled"],
  finance: ["Pending", "Completed"],
};

export async function GET() {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const data = await env.DB!.prepare("SELECT * FROM work_items ORDER BY updated_at DESC").all();
    return Response.json({ items: data.results });
  } catch (error) {
    console.error("Unable to load work items", error);
    return Response.json({ error: "Your records are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  const kind = String(input.kind ?? "");
  const title = String(input.title ?? "").trim();
  const status = String(input.status ?? "");
  const client = String(input.client ?? "").trim();
  const service = String(input.service ?? "");
  const dueDate = String(input.dueDate ?? "");
  const notes = String(input.notes ?? "").trim();
  const amount = String(input.amount ?? "").trim();
  const currency = String(input.currency ?? "").trim().toUpperCase();
  const direction = String(input.direction ?? "");
  const price = String(input.price ?? "0").trim();
  const cost = String(input.cost ?? "0").trim();
  const projectId = String(input.projectId ?? "").trim();
  if (!statuses[kind] || !title || title.length > 160 || !statuses[kind].includes(status) || (kind === "lead" && status === "Won") || client.length > 160 || notes.length > 4000 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) || (kind === "booking" && !dueDate) || (kind === "project" && (!validMoney(price) || !validMoney(cost) || !/^[A-Z]{3}$/.test(currency))) || (kind === "finance" && (!validMoney(amount) || !/^[A-Z]{3}$/.test(currency) || !["Income", "Expense"].includes(direction)))) {
    return Response.json({ error: "Check the required fields." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    if (kind === "finance" && projectId) {
      const project = await env.DB!.prepare("SELECT currency FROM work_items WHERE id = ? AND kind = 'project'").bind(projectId).first<{currency: string}>();
      if (!project) return Response.json({ error: "Choose an existing project." }, { status: 400 });
      if ((project.currency || "GHS") !== currency) return Response.json({ error: "Finance entry currency must match the project currency." }, { status: 400 });
    }
    await env.DB!.prepare("INSERT INTO work_items (id, kind, title, client, service, status, due_date, notes, amount, currency, direction, price, cost, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, kind, title, client, service, status, dueDate, notes, kind === "finance" ? amount : "", kind === "finance" || kind === "project" ? currency : "", kind === "finance" ? direction : "", kind === "project" ? price : "0", kind === "project" ? cost : "0", kind === "finance" && projectId ? projectId : null, now, now).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Unable to save work item", error);
    return Response.json({ error: "Could not save. Please try again." }, { status: 503 });
  }
}
