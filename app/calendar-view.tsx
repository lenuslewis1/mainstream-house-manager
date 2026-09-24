"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { CalendarItem, Deliverable } from "../lib/calendar-types";

type CalendarEvent = { id: string; date: string; title: string; kind: "lead" | "project" | "task" | "booking" | "deliverable"; status: string; projectTitle?: string; projectStatus?: string; client?: string; service?: string; notes?: string; targetKind: "lead" | "project" | "task" | "booking"; targetId: string };
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function readableDate(key: string) { const [year, month, day] = key.split("-").map(Number); return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }

export default function CalendarView({ items, deliverables, loading, error, onRetry, onOpenItem }: { items: CalendarItem[]; deliverables: Deliverable[]; loading: boolean; error: string; onRetry: () => void; onOpenItem: (kind: CalendarEvent["targetKind"], id: string) => void }) {
  const today = dateKey(new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [preview, setPreview] = useState<CalendarEvent | null>(null);
  useEffect(() => {
    if (!preview) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setPreview(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [preview]);
  const events = useMemo<CalendarEvent[]>(() => [
    ...items.filter(item => item.kind !== "finance" && /^\d{4}-\d{2}-\d{2}$/.test(item.due_date)).map(item => ({ id: `item-${item.id}`, date: item.due_date, title: item.title, kind: item.kind as CalendarEvent["kind"], status: item.status, client: item.client, service: item.service, notes: item.notes, targetKind: item.kind as CalendarEvent["targetKind"], targetId: item.id })),
    ...deliverables.map(deliverable => ({ id: `deliverable-${deliverable.id}`, date: deliverable.due_date, title: deliverable.title, kind: "deliverable" as const, status: deliverable.status, projectTitle: deliverable.project_title, projectStatus: items.find(item => item.id === deliverable.project_id)?.status || deliverable.project_status, client: deliverable.project_client, notes: deliverable.notes, targetKind: "project" as const, targetId: deliverable.project_id })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)), [items, deliverables]);
  const byDate = useMemo(() => { const grouped = new Map<string, CalendarEvent[]>(); for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) || []), event]); return grouped; }, [events]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - (first.getDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  const selected = byDate.get(selectedDate) || [];
  const upcoming = events.filter(event => event.date >= today);
  const open = (event: CalendarEvent) => setPreview(event);
  return <div className="calendar-layout">
    <section className="calendar-card" aria-label="Calendar month"><div className="calendar-toolbar"><div><span className="section-number">SCHEDULE / MONTH VIEW</span><h2>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></div><div className="calendar-controls"><button onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(dateKey(now)); }}>Today</button><button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18}/></button><button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18}/></button></div></div>
      {error && <div className="error" role="alert">{error} <button onClick={onRetry}>Try again</button></div>}
      <div className="calendar-grid" role="grid" aria-label={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}>{weekdays.map(day => <div className="calendar-weekday" key={day} role="columnheader">{day}</div>)}{days.map(day => { const key = dateKey(day); const dayEvents = byDate.get(key) || []; return <div key={key} className={`calendar-day ${day.getMonth() !== month.getMonth() ? "outside" : ""} ${key === today ? "today" : ""} ${key === selectedDate ? "selected" : ""}`} role="gridcell" aria-label={readableDate(key)}><button className="calendar-date" onClick={() => setSelectedDate(key)} aria-label={`Show ${readableDate(key)} events`} aria-pressed={key === selectedDate}>{day.getDate()}</button><div className="calendar-day-events">{dayEvents.slice(0, 2).map(event => <button key={event.id} className={`calendar-chip calendar-${event.kind}`} onClick={() => { setSelectedDate(key); open(event); }} title={`${event.title} · ${event.status}`}>{event.title}</button>)}{dayEvents.length > 2 && <button className="calendar-more" onClick={() => setSelectedDate(key)}>+{dayEvents.length - 2} more</button>}</div></div>; })}</div>
      <div className="calendar-legend"><span><i className="legend-project"/> Project</span><span><i className="legend-deliverable"/> Deliverable</span><span><i className="legend-task"/> Task</span><span><i className="legend-booking"/> Booking</span><span><i className="legend-lead"/> Lead</span></div>
    </section>
    <aside className="calendar-side"><section className="calendar-side-card"><span className="section-number">SELECTED DAY</span><h2>{readableDate(selectedDate)}</h2>{loading ? <p className="calendar-empty">Loading dates…</p> : selected.length ? <div className="calendar-event-list">{selected.map(event => <EventCard key={event.id} event={event} onOpen={() => open(event)}/>)}</div> : <p className="calendar-empty">No dates scheduled for this day.</p>}</section><section className="calendar-side-card"><span className="section-number">COMING UP</span><h2>Upcoming dates <small>{upcoming.length}</small></h2>{loading ? <p className="calendar-empty">Loading dates…</p> : upcoming.length ? <div className="calendar-event-list">{upcoming.map(event => <EventCard key={event.id} event={event} showDate onOpen={() => open(event)}/>)}</div> : <p className="calendar-empty">No upcoming dates yet. Add a due date to a work item or a deliverable to a project.</p>}</section></aside>
    {preview && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPreview(null); }}><div className="modal calendar-preview" role="dialog" aria-modal="true" aria-labelledby="calendar-preview-title"><div className="modal-top"><div><span className="section-number">{preview.kind.toUpperCase()} / CALENDAR</span><h2 id="calendar-preview-title">{preview.title}</h2></div><button type="button" className="icon-button" onClick={() => setPreview(null)} aria-label="Close preview"><X size={20}/></button></div><dl><div><dt>Due date</dt><dd>{readableDate(preview.date)}</dd></div><div><dt>Status</dt><dd>{preview.status}</dd></div>{preview.projectTitle && <div><dt>Project</dt><dd>{preview.projectTitle}</dd></div>}{preview.projectStatus && <div><dt>Project status</dt><dd>{preview.projectStatus}</dd></div>}{preview.client && <div><dt>Client</dt><dd>{preview.client}</dd></div>}{preview.service && <div><dt>Service</dt><dd>{preview.service}</dd></div>}{preview.notes && <div><dt>Notes</dt><dd>{preview.notes}</dd></div>}</dl><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setPreview(null)}>Close</button><button type="button" className="primary-button" onClick={() => { const item = preview; setPreview(null); onOpenItem(item.targetKind, item.targetId); }}>View full {preview.kind === "deliverable" ? "project" : preview.kind}<ArrowRight size={17}/></button></div></div></div>}
  </div>;
}

function EventCard({ event, showDate, onOpen }: { event: CalendarEvent; showDate?: boolean; onOpen: () => void }) {
  const kindLabel = event.kind === "deliverable" ? "Deliverable" : event.kind.charAt(0).toUpperCase() + event.kind.slice(1);
  return <button className="calendar-event" onClick={onOpen}><span className={`calendar-event-kind calendar-${event.kind}`}><CalendarDays size={13}/>{kindLabel}</span><strong>{event.title}</strong>{event.projectTitle && <span className="calendar-event-project">{event.projectTitle}</span>}{event.client && !event.projectTitle && <span className="calendar-event-project">{event.client}</span>}<span className="calendar-event-meta">{showDate && <span>{readableDate(event.date)}</span>}<span>{event.kind === "deliverable" ? `Deliverable: ${event.status} · Project: ${event.projectStatus}` : event.kind === "project" ? `Project: ${event.status}` : event.status}</span><ArrowRight size={15}/></span></button>;
}
