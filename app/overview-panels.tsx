"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { financialSummary, money } from "../lib/finance";
import { recordDate } from "../lib/finance-reports";
import type { CalendarItem, Deliverable } from "../lib/calendar-types";

type OverviewItem = CalendarItem & { amount: string; currency: string; direction: string; price: string; cost: string; project_id: string | null; created_at: number };
type Event = { id: string; date: string; title: string; kind: string; status: string; targetKind: "lead" | "project" | "task" | "booking"; targetId: string; projectStatus?: string };
const orderStatuses = ["Planning", "In progress", "In review", "Delivered", "On hold", "Requested", "Confirmed", "Completed", "Cancelled"];
const weekdays = ["M", "T", "W", "T", "F", "S", "S"];
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function OverviewPanels({ items, deliverables, loading, onOpenCalendar, onOpenItem, onOpenFinance, onOpenProjects }: { items: OverviewItem[]; deliverables: Deliverable[]; loading: boolean; onOpenCalendar: (date: string) => void; onOpenItem: (kind: Event["targetKind"], id: string) => void; onOpenFinance: () => void; onOpenProjects: () => void }) {
  const currencies = useMemo(() => [...new Set(items.filter(item => item.kind === "finance" || item.kind === "project" || item.kind === "booking").map(item => item.currency || "GHS"))].sort(), [items]);
  const [currencyChoice, setCurrencyChoice] = useState("GHS");
  const currency = currencies.includes(currencyChoice) ? currencyChoice : currencies[0] || "GHS";
  const finance = financialSummary(items, currency);
  const today = dateKey(new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const events = useMemo<Event[]>(() => [
    ...items.filter(item => item.kind !== "finance" && /^\d{4}-\d{2}-\d{2}$/.test(item.due_date)).map(item => ({ id: item.id, date: item.due_date, title: item.title, kind: item.kind, status: item.status, targetKind: item.kind as Event["targetKind"], targetId: item.id })),
    ...deliverables.filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.due_date)).map(item => ({ id: `deliverable-${item.id}`, date: item.due_date, title: item.title, kind: "deliverable", status: item.status, targetKind: "project" as const, targetId: item.project_id, projectStatus: items.find(project => project.id === item.project_id)?.status || item.project_status })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)), [items, deliverables]);
  const eventsByDay = useMemo(() => { const grouped = new Map<string, number>(); events.forEach(event => grouped.set(event.date, (grouped.get(event.date) || 0) + 1)); return grouped; }, [events]);
  const upcoming = events.filter(event => event.date >= today).slice(0, 5);
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(1 - (start.getDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });

  const orders = items.filter(item => item.kind === "project" || item.kind === "booking");
  const statusCounts = orderStatuses.map(status => ({ status, count: orders.filter(order => order.status === status).length })).filter(row => row.count > 0);
  const months = Array.from({ length: 6 }, (_, index) => new Date(new Date().getFullYear(), new Date().getMonth() - 5 + index, 1));
  const monthly = months.map(date => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const cashInMonth = items.filter(item => item.kind === "finance" && item.status === "Completed" && (item.currency || "GHS") === currency && recordDate(item).startsWith(key));
    const monthTotals = financialSummary(cashInMonth, currency);
    return { key, label: date.toLocaleDateString(undefined, { month: "short" }), count: cashInMonth.length, income: monthTotals.revenue, expenses: monthTotals.expenses };
  });
  const ceiling = Math.max(1, ...monthly.flatMap(row => [row.income, row.expenses]));
  const hasChartData = monthly.some(row => row.count > 0);

  return <div className="overview-panels">
    <section className="overview-panel overview-calendar"><div className="overview-panel-head"><div><span className="section-number">SCHEDULE / AT A GLANCE</span><h2>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></div><div className="overview-month-controls"><button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18}/></button><button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18}/></button></div></div><div className="overview-mini-calendar" aria-label={`Dates in ${month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`}>{weekdays.map((day, index) => <span className="overview-weekday" key={index}>{day}</span>)}{days.map(day => { const key = dateKey(day); const count = eventsByDay.get(key) || 0; return <button key={key} className={`${day.getMonth() !== month.getMonth() ? "outside" : ""} ${key === today ? "today" : ""}`} aria-label={`${day.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}: ${count} scheduled item${count === 1 ? "" : "s"}`} onClick={() => onOpenCalendar(key)}>{day.getDate()}{count > 0 && <i aria-hidden="true"/>}</button>; })}</div><button className="overview-panel-link" onClick={() => onOpenCalendar(today)}>Open full calendar <ArrowRight size={16}/></button></section>
    <section className="overview-panel overview-upcoming"><div className="overview-panel-head"><div><span className="section-number">NEXT DATES</span><h2>Coming up</h2></div><CalendarDays size={19}/></div>{loading ? <p className="overview-empty">Loading dates…</p> : upcoming.length ? <div className="overview-upcoming-list">{upcoming.map(event => <button key={event.id} onClick={() => onOpenItem(event.targetKind, event.targetId)}><span className="overview-upcoming-date">{new Date(`${event.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span><strong>{event.title}</strong><small>{event.kind === "deliverable" ? `Deliverable · ${event.status} · Order ${event.projectStatus}` : `${event.kind === "project" ? "order" : event.kind} · ${event.status}`}</small></span><ArrowRight size={16}/></button>)}</div> : <p className="overview-empty">No upcoming dates. Add a due date or order deliverable.</p>}<button className="overview-panel-link" onClick={() => onOpenCalendar(today)}>See all dates <ArrowRight size={16}/></button></section>
    <section className="overview-panel overview-finance">
      <div className="overview-panel-head"><div><span className="section-number">FINANCES / ALL TIME</span><h2>Money at a glance</h2></div>{currencies.length > 1 && <label className="overview-currency">Currency <select value={currency} onChange={event => setCurrencyChoice(event.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>}</div>
      {loading ? <p className="overview-empty">Loading financials…</p> : currencies.length ? <>
        <div className="overview-finance-metrics" aria-label={`Financial totals in ${currency}`}>
          <div><span>Money received</span><strong>{money(finance.revenue, currency)}</strong></div>
          <div><span>Expenses</span><strong>{money(finance.expenses, currency)}</strong></div>
          <div className="overview-net-profit"><span>{finance.profit<0?"Net loss so far":"Net profit so far"}</span><strong>{money(finance.profit, currency)}</strong><small>After all recorded expenses</small></div>
        </div>
        <p className="overview-caption">Profit deducts saved order costs automatically, plus salaries, allowances and other completed expenses. Existing linked expenses count toward the same total.</p>
        {finance.linkedEntryCount > 0 && <p className="overview-caption overview-payment-caption">Order-linked payments: {money(finance.linkedReceived, currency)} received · {money(finance.linkedPaid, currency)} paid</p>}
        {(finance.pendingIncome > 0 || finance.pendingExpenses > 0) && <p className="overview-caption overview-payment-caption">Pending, excluded from totals: {money(finance.pendingIncome, currency)} income · {money(finance.pendingExpenses, currency)} expenses</p>}
        <p className="overview-caption overview-chart-caption">Completed cash receipts and payouts · last 6 months · {currency}</p>
        {hasChartData ? <><div className="overview-chart" role="img" aria-label={`Monthly cash revenue and expenses in ${currency}. ${monthly.map(row => `${row.label}: revenue ${money(row.income, currency)}, expenses ${money(row.expenses, currency)}`).join("; ")}`}>
          {monthly.map(row => <div className="overview-month" key={row.key}><div className="overview-bar-pair"><div className="overview-bar income" style={{height: `${row.income ? Math.max(4, row.income / ceiling * 100) : 0}%`}} title={`${row.label} revenue: ${money(row.income, currency)}`}/><div className="overview-bar expense" style={{height: `${row.expenses ? Math.max(4, row.expenses / ceiling * 100) : 0}%`}} title={`${row.label} expenses: ${money(row.expenses, currency)}`}/></div><span>{row.label}</span></div>)}
        </div><div className="overview-chart-legend"><span><i className="income"/> Money received</span><span><i className="expense"/> Expenses</span></div></> : <p className="overview-empty">No completed cash transactions in the last six months. All-time totals appear above.</p>}
      </> : <p className="overview-empty">Add an order or finance entry to see financial totals here.</p>}
      <button className="overview-panel-link" onClick={onOpenFinance}>View finances <ArrowRight size={16}/></button>
    </section>
    <section className="overview-panel overview-projects"><div className="overview-panel-head"><div><span className="section-number">DELIVERY / ALL ORDERS</span><h2>Order status</h2></div><strong className="overview-total">{orders.length}</strong></div>{loading ? <p className="overview-empty">Loading orders…</p> : orders.length ? <div className="overview-status-chart" role="img" aria-label={statusCounts.map(row => `${row.status}: ${row.count}`).join("; ")}>{statusCounts.map(row => <div className="overview-status-row" key={row.status}><span>{row.status}</span><div className="overview-status-track"><i style={{width: `${row.count / orders.length * 100}%`}}/></div><strong>{row.count}</strong></div>)}</div> : <p className="overview-empty">Add an order or booking to see delivery status here.</p>}<button className="overview-panel-link" onClick={onOpenProjects}>View orders <ArrowRight size={16}/></button></section>
  </div>;
}
