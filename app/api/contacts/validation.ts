export function parseContact(input: Record<string, unknown>) {
  const kind = String(input.kind ?? "");
  const name = String(input.name ?? "").trim();
  const contactPerson = String(input.contactPerson ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const email = String(input.email ?? "").trim();
  const specialty = String(input.specialty ?? "").trim();
  const location = String(input.location ?? "").trim();
  const notes = String(input.notes ?? "").trim();
  if (!["customer", "partner"].includes(kind) || !name || name.length > 160 || contactPerson.length > 160 || phone.length > 60 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || specialty.length > (kind === "partner" ? 4000 : 160) || location.length > 255 || notes.length > 4000) return null;
  return { kind, name, contactPerson, phone, email, specialty, location, notes };
}
