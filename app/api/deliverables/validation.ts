export const deliverableStatuses = ["Planned", "In progress", "Done"] as const;

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function parseDeliverable(input: Record<string, unknown>) {
  const title = String(input.title ?? "").trim();
  const dueDate = String(input.dueDate ?? "");
  const status = String(input.status ?? "Planned");
  const notes = String(input.notes ?? "").trim();
  if (!title || title.length > 160 || !validDate(dueDate) || !deliverableStatuses.includes(status as typeof deliverableStatuses[number]) || notes.length > 4000) return null;
  return { title, dueDate, status, notes };
}
