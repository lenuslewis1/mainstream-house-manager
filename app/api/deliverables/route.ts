import { database as db } from "../../../db/client";
import { getChatGPTUser } from "../../chatgpt-auth";
import { parseDeliverable } from "./validation";

export const runtime = "edge";

export async function GET(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId");
  try {
    const query = `SELECT d.*, w.title AS project_title, w.client AS project_client, w.status AS project_status
      FROM project_deliverables d JOIN work_items w ON w.id = d.project_id AND w.kind IN ('project', 'booking')
      ${projectId ? "WHERE d.project_id = $1" : ""} ORDER BY d.due_date ASC, d.created_at ASC`;
    const result = await (projectId ? db.prepare(query).bind(projectId) : db.prepare(query)).all();
    return Response.json({ deliverables: result.results });
  } catch (error) {
    console.error("Unable to load deliverables", error);
    return Response.json({ error: "Deliverables are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const projectId = String(input?.projectId ?? "");
  const details = input && parseDeliverable(input);
  if (!projectId || !details) return Response.json({ error: "Check the deliverable details." }, { status: 400 });
  try {
    const project = await db.prepare("SELECT id FROM work_items WHERE id = $1 AND kind IN ('project', 'booking')").bind(projectId).first();
    if (!project) return Response.json({ error: "Order not found" }, { status: 404 });
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.prepare("INSERT INTO project_deliverables (id, project_id, title, due_date, status, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)")
      .bind(id, projectId, details.title, details.dueDate, details.status, details.notes, now, now).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Unable to save deliverable", error);
    return Response.json({ error: "Could not save deliverable." }, { status: 503 });
  }
}
