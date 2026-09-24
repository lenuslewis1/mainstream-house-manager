import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const runtime = "edge";

const statuses: Record<string, string[]> = {
  lead: ["New", "Contacted", "Proposal sent", "Won", "Lost"],
  project: ["Planning", "In progress", "In review", "Delivered", "On hold"],
  task: ["To do", "In progress", "Done"],
  booking: ["Requested", "Confirmed", "Completed", "Cancelled"],
  finance: ["Pending", "Completed"],
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    const item = await env.DB!.prepare("SELECT kind, source_lead_id FROM work_items WHERE id = ?").bind(id).first<{kind: string; source_lead_id: string | null}>();
    if (!item) return Response.json({ error: "Record not found" }, { status: 404 });
    if (input.mode === "details") {
      if (item.kind !== "lead" && item.kind !== "project") return Response.json({ error: "Only leads and projects can be edited here." }, { status: 400 });
      const title = String(input.title ?? "").trim();
      const client = String(input.client ?? "").trim();
      const service = String(input.service ?? "").trim();
      const dueDate = String(input.dueDate ?? "");
      const notes = String(input.notes ?? "").trim();
      if (!title || title.length > 160 || client.length > 160 || service.length > 160 || notes.length > 4000 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) {
        return Response.json({ error: "Check the required fields." }, { status: 400 });
      }
      await env.DB!.prepare("UPDATE work_items SET title = ?, client = ?, service = ?, due_date = ?, notes = ?, updated_at = ? WHERE id = ?")
        .bind(title, client, service, dueDate, notes, Date.now(), id).run();
      return Response.json({ ok: true });
    }
    const status = String(input.status ?? "");
    if (!statuses[item.kind]?.includes(status)) return Response.json({ error: "Invalid status" }, { status: 400 });
    if (item.kind === "lead" && status !== "Won") {
      const project = await env.DB!.prepare("SELECT id FROM work_items WHERE source_lead_id = ?").bind(id).first();
      if (project) return Response.json({ error: "This lead is linked to a project and stays marked Won." }, { status: 409 });
    }
    if (item.kind === "lead" && status === "Won") {
      return Response.json({ error: "Use Convert to project to mark this lead Won." }, { status: 409 });
    }
    await env.DB!.prepare("UPDATE work_items SET status = ?, updated_at = ? WHERE id = ?").bind(status, Date.now(), id).run();
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
    const leadAssets = await env.DB!.prepare("SELECT object_key FROM lead_assets WHERE lead_id = ?").bind(id).all<{ object_key: string }>();
    const projectAssets = await env.DB!.prepare("SELECT object_key FROM project_assets WHERE project_id = ?").bind(id).all<{ object_key: string }>();
    await env.DB!.batch([
      env.DB!.prepare("UPDATE work_items SET source_lead_id = NULL WHERE source_lead_id = ?").bind(id),
      env.DB!.prepare("DELETE FROM work_items WHERE id = ?").bind(id),
    ]);
    if (env.BUCKET) {
      await Promise.all([...leadAssets.results, ...projectAssets.results].map(asset => env.BUCKET!.delete(asset.object_key).catch(error => console.error("Unable to clean up work asset", error))));
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to delete work item", error);
    return Response.json({ error: "Could not delete. Please try again." }, { status: 503 });
  }
}
