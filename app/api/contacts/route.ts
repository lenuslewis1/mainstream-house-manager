import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

export function parseContact(input: Record<string, unknown>) {
  const kind = String(input.kind ?? "");
  const name = String(input.name ?? "").trim();
  const contactPerson = String(input.contactPerson ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const email = String(input.email ?? "").trim();
  const specialty = String(input.specialty ?? "").trim();
  const notes = String(input.notes ?? "").trim();
  if (!["customer", "partner"].includes(kind) || !name || name.length > 160 || contactPerson.length > 160 || phone.length > 60 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || specialty.length > (kind === "partner" ? 4000 : 160) || notes.length > 4000) return null;
  return { kind, name, contactPerson, phone, email, specialty, notes };
}

export async function GET(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "customer" && kind !== "partner") return Response.json({ error: "Choose customers or partners." }, { status: 400 });
  try {
    const result = await env.DB!.prepare("SELECT * FROM contacts WHERE kind = ? ORDER BY name COLLATE NOCASE").bind(kind).all();
    return Response.json({ contacts: result.results });
  } catch (error) {
    console.error("Unable to load contacts", error);
    return Response.json({ error: "Contacts are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const contact = input && parseContact(input);
  if (!contact) return Response.json({ error: "Check the contact details." }, { status: 400 });
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await env.DB!.prepare("INSERT INTO contacts (id, kind, name, contact_person, phone, email, specialty, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, contact.kind, contact.name, contact.contactPerson, contact.phone, contact.email, contact.specialty, contact.notes, now, now).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Unable to save contact", error);
    return Response.json({ error: "Could not save contact. Please try again." }, { status: 503 });
  }
}
