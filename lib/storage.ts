import { database as db } from "@/db/client";

// London currently supports Postgres but not Neon Object Storage. Store bounded
// attachments on the same Neon branch so uploads have no R2 dependency.
export const storage = {
  async put(key: string, stream: ReadableStream, options: { httpMetadata: { contentType: string } }) {
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("Files must be 25 MB or smaller.");
    const hex = Buffer.from(bytes).toString("hex");
    await db.prepare("INSERT INTO stored_files (object_key, content_type, data, created_at) VALUES ($1, $2, decode($3, 'hex'), $4) ON CONFLICT (object_key) DO UPDATE SET content_type=excluded.content_type, data=excluded.data")
      .bind(key, options.httpMetadata.contentType, hex, Date.now()).run();
  },
  async get(key: string) {
    const row = await db.prepare("SELECT encode(data, 'hex') AS hex FROM stored_files WHERE object_key=$1").bind(key).first<{ hex: string }>();
    if (!row) return null;
    const bytes = Uint8Array.from(Buffer.from(row.hex, "hex"));
    return { body: bytes, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer as ArrayBuffer };
  },
  async delete(key: string) { await db.prepare("DELETE FROM stored_files WHERE object_key=$1").bind(key).run(); },
};
