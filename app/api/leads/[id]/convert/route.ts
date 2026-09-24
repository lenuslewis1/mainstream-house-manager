import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";

export const runtime = "edge";

type Lead = { id: string; title: string; client: string; service: string; notes: string; status: string };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  if (!env.DB) return Response.json({ error: "Records are temporarily unavailable." }, { status: 503 });
  try {
    const lead = await env.DB.prepare("SELECT id, title, client, service, notes, status FROM work_items WHERE id = ? AND kind = 'lead'").bind(id).first<Lead>();
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    const existing = await env.DB.prepare("SELECT id FROM work_items WHERE kind = 'project' AND source_lead_id = ?").bind(id).first<{ id: string }>();
    if (existing) return Response.json({ id: existing.id, alreadyConverted: true });
    const projectId = crypto.randomUUID();
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO work_items (id, kind, title, client, service, status, due_date, notes, amount, currency, direction, source_lead_id, created_at, updated_at) VALUES (?, 'project', ?, ?, ?, 'Planning', '', ?, '', 'GHS', '', ?, ?, ?)")
        .bind(projectId, lead.title, lead.client, lead.service, lead.notes, id, now, now),
      env.DB.prepare("UPDATE work_items SET status = 'Won', updated_at = ? WHERE id = ? AND kind = 'lead'").bind(now, id),
    ]);
    return Response.json({ id: projectId }, { status: 201 });
  } catch (error) {
    console.error("Unable to convert lead", error);
    return Response.json({ error: "Could not create the project. Please try again." }, { status: 503 });
  }
}
