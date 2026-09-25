import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const runtime = "edge";

type AssetRow = { id: string; kind: string; parent_id: string; parent_title: string; file_name: string; content_type: string; size_bytes: number; uploaded_at: number };

export async function GET() {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const result = await env.DB!.prepare("SELECT a.id, 'lead' AS kind, a.lead_id AS parent_id, w.title AS parent_title, a.file_name, a.content_type, a.size_bytes, a.uploaded_at FROM lead_assets a JOIN work_items w ON w.id = a.lead_id UNION ALL SELECT a.id, 'order' AS kind, a.project_id AS parent_id, w.title AS parent_title, a.file_name, a.content_type, a.size_bytes, a.uploaded_at FROM project_assets a JOIN work_items w ON w.id = a.project_id ORDER BY uploaded_at DESC LIMIT 100").all<AssetRow>();
    return Response.json({ assets: result.results });
  } catch (error) {
    console.error("Unable to list AI assets", error);
    return Response.json({ error: "Could not load assets." }, { status: 503 });
  }
}
