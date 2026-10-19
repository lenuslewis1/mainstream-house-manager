import { database as db } from "../../../../../db/client";
import { storage } from "../../../../../lib/storage";
import { getChatGPTUser } from "../../../../chatgpt-auth";

export const runtime = "edge";
const MAX_BYTES = 25 * 1024 * 1024;

async function isLead(id: string): Promise<boolean> {
  const item = await db.prepare("SELECT id FROM work_items WHERE id = $1 AND kind = 'lead'").bind(id).first();
  return Boolean(item);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  try {
    if (!(await isLead(id))) return Response.json({ error: "Lead not found" }, { status: 404 });
    const result = await db.prepare("SELECT id, file_name, content_type, size_bytes, uploaded_at, uploaded_by FROM lead_assets WHERE lead_id = $1 ORDER BY uploaded_at DESC").bind(id).all();
    return Response.json({ assets: result.results });
  } catch (error) {
    console.error("Unable to list lead assets", error);
    return Response.json({ error: "Assets are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id: leadId } = await params;
  if (!storage || !db) return Response.json({ error: "Asset storage is unavailable." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES + 1024 * 1024) return Response.json({ error: "Files must be 25 MB or smaller." }, { status: 413 });
  try {
    if (!(await isLead(leadId))) return Response.json({ error: "Lead not found" }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ error: "Choose a file up to 25 MB." }, { status: 400 });
    const fileName = file.name.trim();
    if (!fileName || fileName.length > 180) return Response.json({ error: "Use a filename under 180 characters." }, { status: 400 });
    const assetId = crypto.randomUUID();
    const key = `leads/${leadId}/${assetId}`;
    const contentType = file.type || "application/octet-stream";
    await storage.put(key, file.stream(), { httpMetadata: { contentType } });
    try {
      await db.prepare("INSERT INTO lead_assets (id, lead_id, object_key, file_name, content_type, size_bytes, uploaded_at, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)")
        .bind(assetId, leadId, key, fileName, contentType, file.size, Date.now(), user.email).run();
    } catch (error) {
      await storage.delete(key).catch(cleanupError => console.error("Unable to clean up uploaded asset", cleanupError));
      throw error;
    }
    return Response.json({ id: assetId }, { status: 201 });
  } catch (error) {
    console.error("Unable to upload lead asset", error);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 503 });
  }
}
