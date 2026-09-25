"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Deliverable } from "../lib/calendar-types";
import { AlertMessage, useSiteConfirm } from "./site-alert";

const statuses = ["Planned", "In progress", "Done"] as const;

export default function DeliverablesPanel({ projectId, deliverables, onChanged }: { projectId: string; deliverables: Deliverable[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<Deliverable | "new" | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const confirm = useSiteConfirm();
  async function remove(deliverable: Deliverable) {
    if (!await confirm({ title: "Delete deliverable?", message: `“${deliverable.title}” will be removed from the order schedule.`, confirmLabel: "Delete deliverable", tone: "danger" })) return;
    setBusyId(deliverable.id); setError("");
    try {
      const response = await fetch(`/api/deliverables/${deliverable.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not delete deliverable.");
      await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete deliverable."); }
    finally { setBusyId(""); }
  }
  return <section className="deliverables-panel" aria-label="Order deliverables"><div className="deliverables-head"><div><span className="section-number">ORDER SCHEDULE</span><h2><CalendarDays size={20}/> Deliverables</h2><p>Add milestones with dates so they appear on the calendar.</p></div><button className="outline-button" onClick={() => setEditing("new")}><Plus size={16}/> Add deliverable</button></div>
    {error && <AlertMessage message={error}/>}
    {deliverables.length ? <ul className="deliverables-list">{deliverables.map(deliverable => <li key={deliverable.id}><span className="deliverable-date"><strong>{new Date(`${deliverable.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><small>{deliverable.due_date.slice(0, 4)}</small></span><div className="deliverable-info"><strong>{deliverable.title}</strong>{deliverable.notes && <p>{deliverable.notes}</p>}</div><span className={`deliverable-status status-${deliverable.status.toLowerCase().replaceAll(" ", "-")}`}>{deliverable.status}</span><div className="row-actions"><button className="icon-button" onClick={() => setEditing(deliverable)} aria-label={`Edit ${deliverable.title}`}><Pencil size={16}/></button><button className="delete-button" onClick={() => void remove(deliverable)} disabled={busyId === deliverable.id} aria-label={`Delete ${deliverable.title}`}><Trash2 size={16}/></button></div></li>)}</ul> : <p className="deliverables-empty">No deliverables yet. Add the first milestone and its due date.</p>}
    {editing && <DeliverableDialog key={editing === "new" ? "new" : editing.id} projectId={projectId} deliverable={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onChanged(); }} />}
  </section>;
}

function DeliverableDialog({ projectId, deliverable, onClose, onSaved }: { projectId: string; deliverable: Deliverable | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(deliverable?.title || "");
  const [dueDate, setDueDate] = useState(deliverable?.due_date || "");
  const [status, setStatus] = useState<(typeof statuses)[number]>(deliverable?.status || "Planned");
  const [notes, setNotes] = useState(deliverable?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(deliverable ? `/api/deliverables/${deliverable.id}` : "/api/deliverables", { method: deliverable ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, title, dueDate, status, notes }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save deliverable.");
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save deliverable."); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="deliverable-title"><div className="modal-top"><div><span className="section-number">PROJECT / DELIVERABLE</span><h2 id="deliverable-title">{deliverable ? "Edit deliverable" : "Add deliverable"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div><form onSubmit={submit}><label>Deliverable name<input autoFocus required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Final print files"/></label><div className="form-row"><label>Due date<input type="date" required value={dueDate} onChange={event => setDueDate(event.target.value)}/></label><label>Status<select value={status} onChange={event => setStatus(event.target.value as (typeof statuses)[number])}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label></div><label>Notes<textarea rows={3} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="What needs to be delivered?"/></label>{error && <AlertMessage message={error}/>}<div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save deliverable"}<ArrowRight size={17}/></button></div></form></div></div>;
}
