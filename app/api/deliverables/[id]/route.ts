import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { parseDeliverable } from "../validation";

export const runtime = "edge";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const details = input && parseDeliverable(input);
  if (!details) return Response.json({ error: "Check the deliverable details." }, { status: 400 });
  try {
    const result = await env.DB!.prepare("UPDATE project_deliverables SET title = ?, due_date = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?")
      .bind(details.title, details.dueDate, details.status, details.notes, Date.now(), id).run();
    if (!result.meta.changes) return Response.json({ error: "Deliverable not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to update deliverable", error);
    return Response.json({ error: "Could not update deliverable." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  try {
    const result = await env.DB!.prepare("DELETE FROM project_deliverables WHERE id = ?").bind(id).run();
    if (!result.meta.changes) return Response.json({ error: "Deliverable not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to delete deliverable", error);
    return Response.json({ error: "Could not delete deliverable." }, { status: 503 });
  }
}
