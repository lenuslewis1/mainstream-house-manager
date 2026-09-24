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
    const item = await env.DB!.prepare("SELECT kind FROM work_items WHERE id = ?").bind(id).first<{kind: string}>();
    if (!item) return Response.json({ error: "Record not found" }, { status: 404 });
    const status = String(input.status ?? "");
    if (!statuses[item.kind]?.includes(status)) return Response.json({ error: "Invalid status" }, { status: 400 });
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
    const assets = await env.DB!.prepare("SELECT object_key FROM lead_assets WHERE lead_id = ?").bind(id).all<{ object_key: string }>();
    await env.DB!.prepare("DELETE FROM work_items WHERE id = ?").bind(id).run();
    if (assets.results.length && env.BUCKET) {
      await Promise.all(assets.results.map(asset => env.BUCKET!.delete(asset.object_key).catch(error => console.error("Unable to clean up lead asset", error))));
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to delete work item", error);
    return Response.json({ error: "Could not delete. Please try again." }, { status: 503 });
  }
}
