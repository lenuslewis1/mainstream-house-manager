import { database as db } from "../../../db/client";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

import { parseContact } from "./validation";

export async function GET(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "customer" && kind !== "partner") return Response.json({ error: "Choose customers or partners." }, { status: 400 });
  try {
    const result = await db.prepare("SELECT * FROM contacts WHERE kind = $1 ORDER BY LOWER(name)").bind(kind).all();
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
    await db.prepare("INSERT INTO contacts (id, kind, name, contact_person, phone, email, specialty, location, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
      .bind(id, contact.kind, contact.name, contact.contactPerson, contact.phone, contact.email, contact.specialty, contact.location, contact.notes, now, now).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Unable to save contact", error);
    return Response.json({ error: "Could not save contact. Please try again." }, { status: 503 });
  }
}
