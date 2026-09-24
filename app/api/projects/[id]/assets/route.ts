import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";

export const runtime = "edge";
const MAX_BYTES = 25 * 1024 * 1024;

async function isProject(id: string): Promise<boolean> {
  const item = await env.DB!.prepare("SELECT id FROM work_items WHERE id = ? AND kind IN ('project', 'booking')").bind(id).first();
  return Boolean(item);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  try {
    if (!(await isProject(id))) return Response.json({ error: "Order not found" }, { status: 404 });
    const result = await env.DB!.prepare("SELECT id, file_name, content_type, size_bytes, uploaded_at, uploaded_by FROM project_assets WHERE project_id = ? ORDER BY uploaded_at DESC").bind(id).all();
    return Response.json({ assets: result.results });
  } catch (error) {
    console.error("Unable to list project assets", error);
    return Response.json({ error: "Assets are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id: projectId } = await params;
  if (!env.BUCKET || !env.DB) return Response.json({ error: "Asset storage is unavailable." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES + 1024 * 1024) return Response.json({ error: "Files must be 25 MB or smaller." }, { status: 413 });
  try {
    if (!(await isProject(projectId))) return Response.json({ error: "Order not found" }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ error: "Choose a file up to 25 MB." }, { status: 400 });
    const fileName = file.name.trim();
    if (!fileName || fileName.length > 180) return Response.json({ error: "Use a filename under 180 characters." }, { status: 400 });
    const assetId = crypto.randomUUID();
    const key = `projects/${projectId}/${assetId}`;
    const contentType = file.type || "application/octet-stream";
    await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType } });
    try {
      await env.DB.prepare("INSERT INTO project_assets (id, project_id, object_key, file_name, content_type, size_bytes, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(assetId, projectId, key, fileName, contentType, file.size, Date.now(), user.email).run();
    } catch (error) {
      await env.BUCKET.delete(key).catch(cleanupError => console.error("Unable to clean up uploaded asset", cleanupError));
      throw error;
    }
    return Response.json({ id: assetId }, { status: 201 });
  } catch (error) {
    console.error("Unable to upload project asset", error);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 503 });
  }
}
