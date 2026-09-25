import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { parseContact } from "../route";

export const runtime = "edge";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const contact = input && parseContact(input);
  if (!contact) return Response.json({ error: "Check the contact details." }, { status: 400 });
  try {
    const existing = await env.DB!.prepare("SELECT kind FROM contacts WHERE id = ?").bind(id).first<{ kind: string }>();
    if (!existing || existing.kind !== contact.kind) return Response.json({ error: "Contact not found" }, { status: 404 });
    await env.DB!.prepare("UPDATE contacts SET name = ?, contact_person = ?, phone = ?, email = ?, specialty = ?, location = ?, notes = ?, updated_at = ? WHERE id = ?")
      .bind(contact.name, contact.contactPerson, contact.phone, contact.email, contact.specialty, contact.location, contact.notes, Date.now(), id).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to update contact", error);
    return Response.json({ error: "Could not update contact." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  try {
    await env.DB!.batch([
      env.DB!.prepare("UPDATE work_items SET vendor_id = NULL WHERE vendor_id = ?").bind(id),
      env.DB!.prepare("DELETE FROM contacts WHERE id = ?").bind(id),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to delete contact", error);
    return Response.json({ error: "Could not delete contact." }, { status: 503 });
  }
}
