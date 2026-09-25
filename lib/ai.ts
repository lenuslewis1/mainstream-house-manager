import { env } from "cloudflare:workers";

type InputPart = { type: "input_text"; text: string } | { type: "input_image"; image_url: string } | { type: "input_file"; filename: string; file_data: string };
type JsonSchema = { name: string; schema: Record<string, unknown>; strict: true };

export class AIServiceError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export async function aiResponse(instructions: string, content: string | InputPart[], schema?: JsonSchema): Promise<string> {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new AIServiceError("AI is not configured yet. Please contact the workspace owner.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "none" },
        instructions,
        input: [{ role: "user", content }],
        max_output_tokens: schema ? 1200 : 1400,
        ...(schema ? { text: { format: { type: "json_schema", ...schema } } } : {}),
      }),
      signal: controller.signal,
    });
    const data = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string }; status?: string };
    if (!response.ok) {
      console.error("AI service request failed", response.status, data.error?.message);
      throw new AIServiceError(response.status === 429 ? "AI is busy. Please try again shortly." : "AI could not complete this request. Please try again.", response.status === 429 ? 429 : 503);
    }
    const text = data.output?.flatMap(item => item.content || []).filter(part => part.type === "output_text").map(part => part.text || "").join("\n").trim();
    if (!text) throw new AIServiceError("AI returned no result. Please try again.");
    return text;
  } catch (error) {
    if (error instanceof AIServiceError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new AIServiceError("AI took too long. Please try again.", 504);
    console.error("AI service unavailable", error);
    throw new AIServiceError("AI is temporarily unavailable. Please try again.");
  } finally { clearTimeout(timer); }
}

export function base64Data(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
