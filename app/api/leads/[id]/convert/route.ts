import { memberName } from "../../../../../lib/team";
import { database as db } from "../../../../../db/client";
import { getChatGPTUser } from "../../../../chatgpt-auth";

import { autoTasks } from "../../../../../lib/auto-tasks";

export const runtime = "edge";

type Lead = { id: string; title: string; client: string; service: string; notes: string; status: string };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getChatGPTUser();
  if (!actor) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  if (!db) return Response.json({ error: "Records are temporarily unavailable." }, { status: 503 });
  try {
    const lead = await db.prepare("SELECT id, title, client, service, notes, status FROM work_items WHERE id = $1 AND kind = 'lead'").bind(id).first<Lead>();
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    const existing = await db.prepare("SELECT id FROM work_items WHERE kind = 'project' AND source_lead_id = $1").bind(id).first<{ id: string }>();
    if (existing) return Response.json({ id: existing.id, alreadyConverted: true });
    if (!lead.service?.trim()) return Response.json({ error: "Assign a service to this lead before converting it to an order." }, { status: 400 });
    const projectId = crypto.randomUUID();
    const now = Date.now();
    await db.batch([
      db.prepare("INSERT INTO work_items (id, kind, title, client, service, status, due_date, notes, amount, currency, direction, source_lead_id, created_at, updated_at, created_by_id, created_by_name) VALUES ($1, 'project', $2, $3, $4, 'Planning', '', $5, '', 'GHS', '', $6, $7, $8, $9, $10)")
        .bind(projectId, lead.title, lead.client, lead.service, lead.notes, id, now, now, actor.userId, await memberName(actor)),
      db.prepare("UPDATE work_items SET status = 'Won', updated_at = $1 WHERE id = $2 AND kind = 'lead'").bind(now, id),
    ]);
    const tasks = await autoTasks("order",projectId);
    return Response.json({ id: projectId, tasks }, { status: 201 });
  } catch (error) {
    console.error("Unable to convert lead", error);
    return Response.json({ error: "Could not create the order. Please try again." }, { status: 503 });
  }
}
