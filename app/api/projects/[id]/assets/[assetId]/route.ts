import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../../chatgpt-auth";

export const runtime = "edge";
type Params = { params: Promise<{ id: string; assetId: string }> };
type AssetRow = { id: string; object_key: string; file_name: string; content_type: string };

async function findAsset(projectId: string, assetId: string): Promise<AssetRow | null> {
  return env.DB!.prepare("SELECT a.id, a.object_key, a.file_name, a.content_type FROM project_assets a JOIN work_items w ON w.id = a.project_id WHERE a.id = ? AND a.project_id = ? AND w.kind = 'project'")
    .bind(assetId, projectId).first<AssetRow>();
}

export async function GET(_request: Request, { params }: Params) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id, assetId } = await params;
  try {
    const asset = await findAsset(id, assetId);
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404 });
    const object = await env.BUCKET!.get(asset.object_key);
    if (!object) return Response.json({ error: "File unavailable" }, { status: 404 });
    const safeName = asset.file_name.replace(/["\\\r\n]/g, "_");
    return new Response(object.body, { headers: {
      "Content-Type": asset.content_type,
      "Content-Length": String(object.size),
      "Content-Disposition": `attachment; filename="${safeName.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("Unable to open project asset", error);
    return Response.json({ error: "File unavailable. Please try again." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id, assetId } = await params;
  try {
    const asset = await findAsset(id, assetId);
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404 });
    await env.DB!.prepare("DELETE FROM project_assets WHERE id = ? AND project_id = ?").bind(assetId, id).run();
    await env.BUCKET!.delete(asset.object_key).catch(error => console.error("Unable to remove asset object", error));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to delete project asset", error);
    return Response.json({ error: "Could not delete the asset." }, { status: 503 });
  }
}
