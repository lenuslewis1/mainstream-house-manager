"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckSquare2, ChevronDown, CircleHelp, Command, Download, FileText, Handshake, LayoutDashboard, Menu, Paperclip, Pencil, Plus, Search, Trash2, Upload, UserRound, Users, Wallet, X } from "lucide-react";
import { serviceGroups } from "../lib/services";
import CalendarView from "./calendar-view";
import DeliverablesPanel from "./deliverables-panel";
import type { Deliverable } from "../lib/calendar-types";
import { cents, money, totals } from "../lib/finance";

type Kind = "lead" | "project" | "task" | "booking" | "finance";
type ContactKind = "customer" | "partner";
type Section = "overview" | "calendar" | Kind | ContactKind;
type Item = { id: string; kind: Kind; title: string; client: string; service: string; status: string; due_date: string; notes: string; amount: string; currency: string; direction: string; price: string; cost: string; project_id: string | null; source_lead_id: string | null; created_at: number; updated_at: number };
type LeadAsset = { id: string; file_name: string; content_type: string; size_bytes: number; uploaded_at: number; uploaded_by: string };
type Contact = { id: string; kind: ContactKind; name: string; contact_person: string; phone: string; email: string; specialty: string; notes: string; created_at: number; updated_at: number };
const statuses: Record<Kind, string[]> = {
  lead: ["New", "Contacted", "Proposal sent", "Won", "Lost"],
  project: ["Planning", "In progress", "In review", "Delivered", "On hold"],
  task: ["To do", "In progress", "Done"],
  booking: ["Requested", "Confirmed", "Completed", "Cancelled"],
  finance: ["Pending", "Completed"],
};
const labels: Record<Kind, string> = { lead: "Lead", project: "Project", task: "Task", booking: "Booking", finance: "Finance entry" };
const nav = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "lead", label: "Leads", icon: Users },
  { key: "project", label: "Projects", icon: BriefcaseBusiness },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "task", label: "Tasks", icon: CheckSquare2 },
  { key: "booking", label: "Bookings", icon: CalendarDays },
  { key: "finance", label: "Finances", icon: Wallet },
  { key: "customer", label: "Customers", icon: UserRound },
  { key: "partner", label: "Partners", icon: Handshake },
] as const;

async function api(path: string, options?: RequestInit): Promise<{items?: Item[]; error?: string; id?: string; ok?: boolean}> {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await response.json().catch(() => ({})) as {items?: Item[]; error?: string; id?: string; ok?: boolean};
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function Workspace() {
  const [section, setSection] = useState<Section>("overview");
  const [items, setItems] = useState<Item[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Kind | null>(null);
  const [dialogProjectId, setDialogProjectId] = useState("");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [expandItemId, setExpandItemId] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [busyId, setBusyId] = useState("");

  const reload = useCallback(async () => {
    try { const data = await api("/api/items"); setItems(data.items || []); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load records."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const reloadDeliverables = useCallback(async () => {
    try {
      const response = await fetch("/api/deliverables", { cache: "no-store" });
      const data = await response.json() as { deliverables?: Deliverable[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load deliverables.");
      setDeliverables(data.deliverables || []);
      setCalendarError("");
    } catch (cause) { setCalendarError(cause instanceof Error ? cause.message : "Could not load deliverables."); }
    finally { setCalendarLoading(false); }
  }, []);
  useEffect(() => { void reloadDeliverables(); }, [reloadDeliverables]);
  useEffect(() => {
    const context = (document as Document & {modelContext?: {registerTool: (tool: Record<string, unknown>, options: {signal: AbortSignal}) => void | Promise<void>}}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_mainstream_work_item",
      title: "Create Mainstream House work item",
      description: "Save a lead, project, task, booking, or finance entry in the Mainstream House workspace.",
      inputSchema: {type:"object", properties:{kind:{type:"string",enum:["lead","project","task","booking","finance"]},title:{type:"string"},client:{type:"string"},service:{type:"string"},status:{type:"string"},dueDate:{type:"string"},notes:{type:"string"},amount:{type:"string"},currency:{type:"string"},direction:{type:"string"},price:{type:"string"},cost:{type:"string"},projectId:{type:"string"}},required:["kind","title","status"],additionalProperties:false},
      annotations: {readOnlyHint:false,untrustedContentHint:false},
      async execute(input: unknown) { const result = await api("/api/items", {method:"POST", body:JSON.stringify(input)}); await reload(); return {id:result.id, saved:true}; },
    }, {signal:lifecycle.signal})).catch(error => console.error("WebMCP registration failed",error));
    return () => lifecycle.abort();
  }, [reload]);

  const visible = useMemo(() => items.filter(item =>
    (section === "overview" || item.kind === section) &&
    (!query || [item.title, item.client, item.service, item.status, item.notes].join(" ").toLowerCase().includes(query.toLowerCase()))
  ), [items, section, query]);
  const counts = {
    leads: items.filter(item => item.kind === "lead" && !["Won", "Lost"].includes(item.status)).length,
    projects: items.filter(item => item.kind === "project" && !["Delivered", "On hold"].includes(item.status)).length,
    tasks: items.filter(item => item.kind === "task" && item.status !== "Done").length,
    bookings: items.filter(item => item.kind === "booking" && !["Completed", "Cancelled"].includes(item.status)).length,
    finances: items.filter(item => item.kind === "finance").length,
  };
  const convertedLeadIds = useMemo(() => new Set(items.filter(item => item.kind === "project" && item.source_lead_id).map(item => item.source_lead_id)), [items]);
  async function convertLead(item: Item) {
    if (!window.confirm(`Create a project from “${item.title}” and mark the lead Won?`)) return;
    setBusyId(item.id);
    try {
      const result = await api(`/api/leads/${item.id}/convert`, { method: "POST" });
      if (!result.id) throw new Error("Could not create the project.");
      await reload();
      setSection("project");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create project."); }
    finally { setBusyId(""); }
  }
  async function changeStatus(item: Item, status: string) {
    if (item.kind === "lead" && status === "Won") { await convertLead(item); return; }
    setBusyId(item.id);
    try { await api(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update."); }
    finally { setBusyId(""); }
  }
  async function remove(item: Item) {
    if (!window.confirm(item.kind === "lead" || item.kind === "project" ? `Delete “${item.title}” and its attached files?` : `Delete “${item.title}”?`)) return;
    setBusyId(item.id);
    try { await api(`/api/items/${item.id}`, { method: "DELETE" }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to delete."); }
    finally { setBusyId(""); }
  }
  const title = section === "overview" ? "Workspace overview" : nav.find(n => n.key === section)?.label || "Workspace";
  return <div className="shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><img src="/mainstream-house-logo.svg" alt="Mainstream House" /></div>
      <div className="side-caption">WORKSPACE</div>
      <nav className="navigation" aria-label="Main navigation">{nav.map(link => <button key={link.key} className={section === link.key ? "nav-link active" : "nav-link"} onClick={() => { setSection(link.key); setMobileNav(false); }}><link.icon size={18} strokeWidth={1.8}/><span>{link.label}</span>{link.key === "lead" && counts.leads > 0 ? <em>{counts.leads}</em> : null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={17}/><div><strong>Keep work together</strong><p>Track enquiries, delivery, bookings, and money.</p></div></div><div className="side-footer">MAINSTREAM HOUSE <span>© 2026</span></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileNav(v => !v)} aria-label="Toggle menu"><Menu size={21}/></button><span className="breadcrumb">Workspace</span><span className="slash">/</span><strong>{title}</strong></div><div className="topbar-right"><span className="private-pill"><span/> Private workspace</span><div className="avatar" aria-label="Mainstream House">MH</div></div></header>
      <div className="content">
        <div className="intro"><div><div className="eyebrow"><span className="eyebrow-line"/> MAINSTREAM HOUSE / OPERATIONS</div><h1>{section === "overview" ? <>Good work starts<br/><i>with a clear view.</i></> : title}</h1><p>{section === "overview" ? "Enquiries, delivery, bookings, and finances in one shared workspace." : section === "lead" ? "Follow each enquiry from first contact to decision." : section === "project" ? "Keep delivery moving from brief to handoff." : section === "calendar" ? "See upcoming due dates, project milestones, and delivery progress." : section === "task" ? "Stay on top of the work that needs attention." : section === "booking" ? "Track scheduled client work and appointments." : section === "customer" ? "Keep your customer details in one place." : section === "partner" ? "Keep the printing and fulfillment partners you work with close at hand." : "Record income and expenses for the team to review."}</p></div>{section !== "customer" && section !== "partner" && section !== "calendar" && <button className="primary-button" onClick={() => setDialog(section === "overview" ? "lead" : section)}><Plus size={18}/> New {section === "overview" ? "lead" : labels[section].toLowerCase()} <ArrowRight size={18}/></button>}</div>
        {section === "overview" && <section className="stat-grid" aria-label="Current work"><button onClick={() => setSection("lead")} className="stat-card"><span className="stat-icon lime"><Users size={19}/></span><span className="stat-label">OPEN LEADS</span><strong>{counts.leads.toString().padStart(2,"0")}</strong><span className="stat-foot">Enquiries to follow up <ArrowRight size={16}/></span></button><button onClick={() => setSection("project")} className="stat-card"><span className="stat-icon violet"><BriefcaseBusiness size={19}/></span><span className="stat-label">ACTIVE PROJECTS</span><strong>{counts.projects.toString().padStart(2,"0")}</strong><span className="stat-foot">Work in motion <ArrowRight size={16}/></span></button><button onClick={() => setSection("task")} className="stat-card"><span className="stat-icon orange"><CheckSquare2 size={19}/></span><span className="stat-label">OPEN TASKS</span><strong>{counts.tasks.toString().padStart(2,"0")}</strong><span className="stat-foot">Next actions <ArrowRight size={16}/></span></button></section>}
        {section === "overview" && <div className="quick-row"><button onClick={() => setSection("booking")}><CalendarDays size={18}/><span><strong>{counts.bookings} upcoming bookings</strong><small>View schedule</small></span><ArrowRight size={17}/></button><button onClick={() => setSection("finance")}><Wallet size={18}/><span><strong>{counts.finances} finance entries</strong><small>View income and expenses</small></span><ArrowRight size={17}/></button></div>}
        {(section === "customer" || section === "partner") ? <ContactsPanel key={section} kind={section} /> : section === "calendar" ? <CalendarView items={items} deliverables={deliverables} loading={loading || calendarLoading} error={error || calendarError} onRetry={() => { void reload(); void reloadDeliverables(); }} onOpenItem={(kind, id) => { setQuery(""); setSection(kind); setExpandItemId(id); }} /> : <><section className="records"><div className="records-head"><div><span className="section-number">01 / YOUR WORK</span><h2>{section === "overview" ? "Recent activity" : `All ${title.toLowerCase()}`}</h2></div><div className="records-actions"><label className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search work" aria-label="Search work"/></label><button className="outline-button" onClick={() => setDialog(section === "overview" ? "project" : section)}><Plus size={17}/> Add {section === "overview" ? "project" : labels[section].toLowerCase()}</button></div></div>
          {error && <div className="error" role="alert">{error} <button onClick={() => void reload()}>Try again</button></div>}
          {section === "finance" && !loading && <FinanceSummary items={items} />}
          {loading ? <div className="empty">Loading your work…</div> : visible.length === 0 ? <div className="empty"><span className="empty-symbol"><Command size={23}/></span><h3>{query ? "No matching work" : "Nothing on the board yet"}</h3><p>{query ? "Try another search term." : "Add your first record to begin tracking work here."}</p>{!query && <button onClick={() => setDialog(section === "overview" ? "lead" : section)}><Plus size={16}/> Add {section === "overview" ? "a lead" : `a ${labels[section].toLowerCase()}`}</button>}</div> : <WorkTable items={visible} allItems={items} deliverables={deliverables} onDeliverablesChanged={reloadDeliverables} expandId={expandItemId} onExpandHandled={() => setExpandItemId(null)} busyId={busyId} onStatus={changeStatus} onDelete={remove} onConvert={convertLead} onEdit={setEditItem} onAddFinance={projectId => { setDialogProjectId(projectId); setDialog("finance"); }} onViewLeadAssets={leadId => { setExpandItemId(leadId); setSection("lead"); }} convertedLeadIds={convertedLeadIds} />}
        </section>
        </>}
        <footer className="footer"><span>MAINSTREAM HOUSE / WORKSPACE</span><span>Built for the work behind the work.</span></footer>
      </div>
    </main>
    {dialog && <NewItemDialog kind={dialog} projects={items.filter(item => item.kind === "project")} initialProjectId={dialogProjectId} onClose={() => { setDialog(null); setDialogProjectId(""); void reload(); }} onCreated={() => { setDialog(null); setDialogProjectId(""); void reload(); }} />}
    {editItem && <EditItemDialog item={editItem} projects={items.filter(item => item.kind === "project")} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); void reload(); }} />}
  </div>;
}

function WorkTable({ items, allItems, deliverables, onDeliverablesChanged, expandId, onExpandHandled, busyId, onStatus, onDelete, onConvert, onEdit, onAddFinance, onViewLeadAssets, convertedLeadIds }: {
  items: Item[];
  allItems: Item[];
  deliverables: Deliverable[];
  onDeliverablesChanged: () => Promise<void>;
  expandId: string | null;
  onExpandHandled: () => void;
  busyId: string;
  onStatus: (item: Item, status: string) => Promise<void>;
  onDelete: (item: Item) => Promise<void>;
  onConvert: (item: Item) => Promise<void>;
  onEdit: (item: Item) => void;
  onAddFinance: (projectId: string) => void;
  onViewLeadAssets: (leadId: string) => void;
  convertedLeadIds: Set<string | null>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => { if (expandId && items.some(item => item.id === expandId)) { setExpandedId(expandId); onExpandHandled(); } }, [expandId, items, onExpandHandled]);
  return <div className="table-wrap"><table><thead><tr><th>WORK</th><th>CLIENT</th><th>SERVICE / TYPE</th><th>DATE / AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{items.map(item => {
    const converted = item.kind === "lead" && convertedLeadIds.has(item.id);
    const expandable = item.kind === "lead" || item.kind === "project";
    const open = expandedId === item.id;
    return <Fragment key={item.id}><tr>
      <td>{expandable ? <button className="item-title detail-title" onClick={() => setExpandedId(open ? null : item.id)} aria-expanded={open} aria-controls={`details-${item.id}`}>{item.title}<ChevronDown size={15} className={open ? "chevron-open" : ""}/></button> : <div className="item-title">{item.title}</div>}<div className="item-kind">{labels[item.kind]}{item.source_lead_id ? " · From lead" : ""}{item.notes ? ` · ${item.notes}` : ""}</div></td>
      <td>{item.client || <span className="muted">—</span>}</td>
      <td>{item.kind === "finance" ? <>{item.direction}{item.project_id && <div className="item-kind">{allItems.find(project => project.id === item.project_id)?.title || "Project removed"}</div>}</> : item.service || <span className="muted">—</span>}</td>
      <td>{item.kind === "finance" ? money(cents(item.amount), item.currency) : item.due_date ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : <span className="muted">—</span>}</td>
      <td><select className={`status status-${item.status.toLowerCase().replaceAll(" ", "-")}`} aria-label={`Status for ${item.title}`} disabled={busyId === item.id || converted} value={item.status} onChange={event => void onStatus(item, event.target.value)}>{statuses[item.kind].map(status => <option key={status}>{status}</option>)}</select></td>
      <td><div className="row-actions">{item.kind === "lead" && !converted ? <button className="convert-button" disabled={busyId === item.id} onClick={() => void onConvert(item)}>Convert to project <ArrowRight size={14}/></button> : converted ? <span className="converted-label">Project created</span> : null}{item.kind === "project" && item.source_lead_id && <button className="convert-button" onClick={() => onViewLeadAssets(item.source_lead_id!)}>Lead assets <Paperclip size={14}/></button>}{expandable && <button className="convert-button" onClick={() => setExpandedId(open ? null : item.id)} aria-expanded={open} aria-controls={`details-${item.id}`}>{open ? "Hide details" : "View details"}<ChevronDown size={14} className={open ? "chevron-open" : ""}/></button>}{(expandable || item.kind === "finance") && <button className="icon-button" disabled={busyId === item.id} onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`} title="Edit"><Pencil size={16}/></button>}<button className="delete-button" disabled={busyId === item.id} onClick={() => void onDelete(item)} aria-label={`Delete ${item.title}`}><X size={16}/></button></div></td>
    </tr>{expandable && open && <tr className="details-row" id={`details-${item.id}`}><td colSpan={6}><div className="details-content"><div className="details-grid"><div><span>Title</span><strong>{item.title}</strong></div><div><span>Client</span><strong>{item.client || "—"}</strong></div><div><span>Service</span><strong>{item.service || "—"}</strong></div><div><span>Due date</span><strong>{item.due_date || "—"}</strong></div><div><span>Status</span><strong>{item.status}</strong></div><div><span>Created</span><strong>{new Date(item.created_at).toLocaleDateString()}</strong></div></div><div className="details-notes"><span>Notes</span><p>{item.notes || "No notes added."}</p></div>{item.kind === "project" && <><ProjectFinancialPanel project={item} items={allItems} onAddFinance={() => onAddFinance(item.id)} onEditFinance={onEdit}/><DeliverablesPanel projectId={item.id} deliverables={deliverables.filter(deliverable => deliverable.project_id === item.id)} onChanged={onDeliverablesChanged}/></>}<WorkAssetsPanel kind={item.kind as "lead" | "project"} records={[item]} selectedId={item.id}/></div></td></tr>}</Fragment>;
  })}</tbody></table></div>;
}

function FinanceSummary({ items }: { items: Item[] }) {
  const projects = items.filter(item => item.kind === "project");
  const currencies = [...new Set([...projects.map(item => item.currency || "GHS"), ...items.filter(item => item.kind === "finance").map(item => item.currency || "GHS")])].sort();
  return <div className="finance-summary" aria-label="Financial summary"><div className="finance-heading"><h3>Financial summary</h3><p>Project forecasts use price and budgeted cost. Recorded totals use completed finance entries.</p></div>{currencies.length ? currencies.map(currency => {
    const current = projects.filter(project => (project.currency || "GHS") === currency);
    const figures = totals(items.filter(item => item.kind === "finance" && (item.currency || "GHS") === currency));
    const price = current.reduce((sum, project) => sum + cents(project.price), 0);
    const cost = current.reduce((sum, project) => sum + cents(project.cost), 0);
    return <div className="finance-currency" key={currency}><strong>{currency}</strong><div className="finance-metrics"><div><span>Project price total</span><b>{money(price, currency)}</b></div><div><span>Budgeted project costs</span><b>{money(cost, currency)}</b></div><div><span>Projected profit</span><b>{money(price - cost, currency)}</b></div><div><span>Recorded revenue</span><b>{money(figures.revenue, currency)}</b></div><div><span>Recorded expenses</span><b>{money(figures.expenses, currency)}</b></div><div><span>Recorded net</span><b>{money(figures.revenue - figures.expenses, currency)}</b></div></div><p>Pending: {money(figures.pendingIncome, currency)} income · {money(figures.pendingExpenses, currency)} expenses. Recorded totals include project-linked and general entries.</p></div>;
  }) : <p>No projects or finance entries yet.</p>}</div>;
}

function ProjectFinancialPanel({ project, items, onAddFinance, onEditFinance }: { project: Item; items: Item[]; onAddFinance: () => void; onEditFinance: (item: Item) => void }) {
  const currency = project.currency || "GHS";
  const linked = items.filter(item => item.kind === "finance" && item.project_id === project.id);
  const figures = totals(linked);
  const price = cents(project.price);
  const cost = cents(project.cost);
  return <section className="project-financials"><div className="finance-heading"><div><h3>Project finances</h3><p>Price and budgeted cost are forecasts; linked entries record actual income and costs.</p></div><button type="button" className="outline-button" onClick={onAddFinance}><Plus size={16}/> Add entry</button></div><div className="finance-metrics"><div><span>Project price</span><b>{money(price, currency)}</b></div><div><span>Budgeted cost</span><b>{money(cost, currency)}</b></div><div><span>Projected profit</span><b>{money(price - cost, currency)}</b></div><div><span>Recorded revenue</span><b>{money(figures.revenue, currency)}</b></div><div><span>Recorded expenses</span><b>{money(figures.expenses, currency)}</b></div><div><span>Recorded net</span><b>{money(figures.revenue - figures.expenses, currency)}</b></div><div><span>Revenue remaining</span><b>{money(price - figures.revenue, currency)}</b></div></div><p className="finance-pending">Pending entries: {money(figures.pendingIncome, currency)} income · {money(figures.pendingExpenses, currency)} expenses</p>{linked.length ? <ul className="finance-entry-list">{linked.map(entry => <li key={entry.id}><span><strong>{entry.title}</strong><small>{entry.direction} · {entry.status}{entry.due_date ? ` · ${entry.due_date}` : ""}</small></span><b>{money(cents(entry.amount), currency)}</b><button type="button" className="icon-button" onClick={() => onEditFinance(entry)} aria-label={`Edit ${entry.title}`}><Pencil size={15}/></button></li>)}</ul> : <p className="finance-pending">No finance entries linked yet.</p>}</section>;
}

function WorkAssetsPanel({ kind, records, selectedId }: { kind: "lead" | "project"; records: Item[]; selectedId: string | null }) {
  const [recordId, setRecordId] = useState(selectedId ?? "");
  const path = kind === "lead" ? "leads" : "projects";
  const [assets, setAssets] = useState<LeadAsset[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (selectedId) setRecordId(selectedId); }, [selectedId]);
  useEffect(() => {
    if (!records.some(record => record.id === recordId)) setRecordId(records[0]?.id ?? "");
  }, [records, recordId]);
  const loadAssets = useCallback(async (id: string) => {
    if (!id) { setAssets([]); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/${path}/${id}/assets`, { cache: "no-store" });
      const data = await response.json() as { assets?: LeadAsset[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load assets.");
      setAssets(data.assets || []);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load assets."); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void loadAssets(recordId); }, [recordId, loadAssets]);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !recordId) return;
    if (selected.size > 25 * 1024 * 1024) { setError("Files must be 25 MB or smaller."); return; }
    setSaving(true); setError("");
    try {
      const form = new FormData(); form.set("file", selected);
      const response = await fetch(`/api/${path}/${recordId}/assets`, { method: "POST", body: form });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setSelected(null); setInputKey(value => value + 1);
      await loadAssets(recordId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setSaving(false); }
  }
  async function removeAsset(asset: LeadAsset) {
    if (!window.confirm(`Delete “${asset.file_name}” from this ${kind}?`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/${path}/${recordId}/assets/${asset.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete asset.");
      await loadAssets(recordId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete asset."); }
    finally { setSaving(false); }
  }
  return <section className="assets-panel" aria-label={`${kind} assets`}>
    <div className="assets-heading"><div><span className="section-number">{kind.toUpperCase()} FILES</span><h2><Paperclip size={21}/> Assets</h2><p>Briefs, references, and working files for this {kind}.</p></div>{records.length > 1 && <label>{kind === "lead" ? "Lead" : "Project"}<select value={recordId} onChange={event => setRecordId(event.target.value)}>{records.map(record => <option key={record.id} value={record.id}>{record.title}{record.client ? ` · ${record.client}` : ""}</option>)}</select></label>}</div>
    {!records.length ? <div className="assets-empty">Add a {kind} above to start attaching files.</div> : <>
      <form className="upload-form" onSubmit={upload}><label className="file-picker"><Upload size={18}/><span>{selected ? selected.name : "Choose a file"}</span><input key={inputKey} type="file" onChange={event => setSelected(event.target.files?.[0] ?? null)} aria-label="Choose asset to upload"/></label><span className="file-limit">Up to 25 MB per file</span><button type="submit" className="primary-button" disabled={!selected || saving}>{saving ? "Saving…" : "Upload asset"}</button></form>
      {error && <div className="error" role="alert">{error}</div>}
      {loading ? <div className="assets-empty">Loading assets…</div> : assets.length ? <ul className="asset-list">{assets.map(asset => <li key={asset.id}><span className="asset-icon"><FileText size={18}/></span><div className="asset-details"><strong>{asset.file_name}</strong><small>{(asset.size_bytes / 1024 / 1024).toFixed(2)} MB · {new Date(asset.uploaded_at).toLocaleDateString()} · {asset.uploaded_by}</small></div><a href={`/api/${path}/${recordId}/assets/${asset.id}`} aria-label={`Download ${asset.file_name}`}><Download size={18}/><span>Download</span></a><button type="button" onClick={() => void removeAsset(asset)} disabled={saving} aria-label={`Delete ${asset.file_name}`}><Trash2 size={17}/></button></li>)}</ul> : <div className="assets-empty">No files attached to this {kind} yet.</div>}
    </>}
  </section>;
}

function EditItemDialog({ item, projects, onClose, onSaved }: { item: Item; projects: Item[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [client, setClient] = useState(item.client);
  const [service, setService] = useState(item.service);
  const [dueDate, setDueDate] = useState(item.due_date);
  const [notes, setNotes] = useState(item.notes);
  const [price, setPrice] = useState(item.price || "0");
  const [cost, setCost] = useState(item.cost || "0");
  const [amount, setAmount] = useState(item.amount);
  const [currency, setCurrency] = useState(item.currency || "GHS");
  const [direction, setDirection] = useState(item.direction || "Income");
  const [projectId, setProjectId] = useState(item.project_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const knownServices = serviceGroups.flatMap(group => group.items.map(name => `${group.name} / ${name}`));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await api(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ mode: "details", title, client, service, dueDate, notes, price, cost, amount, currency, direction, projectId }) }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save changes."); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
    <div className="modal-top"><div><span className="section-number">EDIT / {item.kind.toUpperCase()}</span><h2 id="edit-item-title">Edit {item.kind}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={submit}><label>Title <input autoFocus required maxLength={160} value={title} onChange={event => setTitle(event.target.value)}/></label><div className="form-row"><label>Client <input maxLength={160} value={client} onChange={event => setClient(event.target.value)}/></label>{item.kind !== "finance" && <label>Service <select value={service} onChange={event => setService(event.target.value)}><option value="">Select subservice</option>{service && !knownServices.includes(service) && <option value={service}>{service}</option>}{serviceGroups.map(group => <optgroup key={group.name} label={group.name}>{group.items.map(name => <option key={name} value={`${group.name} / ${name}`}>{name}</option>)}</optgroup>)}</select></label>}</div>{item.kind === "project" && <div className="form-row"><label>Project price <input type="number" min="0" step="0.01" required value={price} onChange={event => setPrice(event.target.value)}/></label><label>Budgeted cost <input type="number" min="0" step="0.01" required value={cost} onChange={event => setCost(event.target.value)}/></label></div>}{item.kind === "finance" && <><div className="form-row"><label>Type <select value={direction} onChange={event => setDirection(event.target.value)}><option>Income</option><option>Expense</option></select></label><label>Amount <input type="number" min="0" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)}/></label></div><label>Project <select value={projectId} onChange={event => { const id = event.target.value; setProjectId(id); const project = projects.find(candidate => candidate.id === id); if (project) setCurrency(project.currency || "GHS"); }}><option value="">General / unlinked</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label></>}{(item.kind === "project" || item.kind === "finance") && <label>Currency <input required maxLength={3} minLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} placeholder="GHS"/></label>}<label>{item.kind === "finance" ? "Transaction date" : "Due date"} <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/></label><label>Notes <textarea rows={4} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)}/></label>{error && <div className="error" role="alert">{error}</div>}<div className="modal-actions"><button className="cancel-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}<ArrowRight size={17}/></button></div></form>
    {(item.kind === "lead" || item.kind === "project") && <WorkAssetsPanel kind={item.kind} records={[item]} selectedId={item.id}/>}
  </div></div>;
}

function ContactsPanel({ kind }: { kind: ContactKind }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Contact | "new" | null>(null);
  const [busyId, setBusyId] = useState("");
  const noun = kind === "customer" ? "customer" : "partner";
  const reload = useCallback(async () => {
    try { const response = await fetch(`/api/contacts?kind=${kind}`, { cache: "no-store" }); const data = await response.json() as { contacts?: Contact[]; error?: string }; if (!response.ok) throw new Error(data.error || "Could not load contacts."); setContacts(data.contacts || []); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load contacts."); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => { void reload(); }, [reload]);
  async function remove(contact: Contact) {
    if (!window.confirm(`Delete ${contact.name} from ${kind === "customer" ? "customers" : "partners"}?`)) return;
    setBusyId(contact.id);
    try { await api(`/api/contacts/${contact.id}`, { method: "DELETE" }); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete contact."); }
    finally { setBusyId(""); }
  }
  const visible = contacts.filter(contact => !query || [contact.name, contact.contact_person, contact.phone, contact.email, contact.specialty, contact.notes].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <section className="records"><div className="records-head"><div><span className="section-number">01 / YOUR {kind.toUpperCase()}S</span><h2>{kind === "customer" ? "Customer directory" : "Partner directory"}</h2></div><div className="records-actions"><label className="search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${noun}s`} aria-label={`Search ${noun}s`}/></label><button className="outline-button" onClick={() => setDialog("new")}><Plus size={17}/> Add {noun}</button></div></div>
    {error && <div className="error" role="alert">{error} <button onClick={() => void reload()}>Try again</button></div>}
    {loading ? <div className="empty">Loading {noun}s…</div> : visible.length ? <div className="table-wrap"><table><thead><tr><th>NAME</th><th>CONTACT</th><th>PHONE / EMAIL</th><th>{kind === "partner" ? "SPECIALTY" : "DETAILS"}</th><th>ACTION</th></tr></thead><tbody>{visible.map(contact => <tr key={contact.id}><td><div className="item-title">{contact.name}</div>{contact.notes && <div className="item-kind" title={contact.notes}>{contact.notes}</div>}</td><td>{contact.contact_person || <span className="muted">—</span>}</td><td><div className="contact-links">{contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{!contact.phone && !contact.email && <span className="muted">—</span>}</div></td><td>{contact.specialty || <span className="muted">—</span>}</td><td><div className="row-actions"><button className="icon-button" onClick={() => setDialog(contact)} aria-label={`Edit ${contact.name}`} title="Edit"><Pencil size={16}/></button><button className="delete-button" disabled={busyId === contact.id} onClick={() => void remove(contact)} aria-label={`Delete ${contact.name}`}><X size={16}/></button></div></td></tr>)}</tbody></table></div> : <div className="empty"><span className="empty-symbol">{kind === "customer" ? <UserRound size={23}/> : <Handshake size={23}/>}</span><h3>{query ? "No matching contacts" : `No ${noun}s saved yet`}</h3><p>{query ? "Try another search term." : `Save your first ${noun} to keep their details handy.`}</p>{!query && <button onClick={() => setDialog("new")}><Plus size={16}/> Add {noun}</button>}</div>}
    {dialog && <ContactDialog key={dialog === "new" ? "new" : dialog.id} kind={kind} contact={dialog === "new" ? null : dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void reload(); }} />}
  </section>;
}

function ContactDialog({ kind, contact, onClose, onSaved }: { kind: ContactKind; contact: Contact | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(contact?.name || "");
  const [contactPerson, setContactPerson] = useState(contact?.contact_person || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [specialty, setSpecialty] = useState(contact?.specialty || "");
  const [notes, setNotes] = useState(contact?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await api(contact ? `/api/contacts/${contact.id}` : "/api/contacts", { method: contact ? "PATCH" : "POST", body: JSON.stringify({ kind, name, contactPerson, phone, email, specialty, notes }) }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save contact."); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="contact-title"><div className="modal-top"><div><span className="section-number">{contact ? "EDIT" : "NEW"} / {kind.toUpperCase()}</span><h2 id="contact-title">{contact ? "Edit" : "Add"} {kind}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div><form onSubmit={submit}><label>{kind === "customer" ? "Customer / business name" : "Partner / business name"}<input autoFocus required maxLength={160} value={name} onChange={event => setName(event.target.value)}/></label><div className="form-row"><label>Contact person<input maxLength={160} value={contactPerson} onChange={event => setContactPerson(event.target.value)}/></label><label>{kind === "partner" ? "Service / specialty" : "Details"}<input maxLength={160} value={specialty} onChange={event => setSpecialty(event.target.value)} placeholder={kind === "partner" ? "Printing, fulfillment, delivery…" : "Organization or customer type"}/></label></div><div className="form-row"><label>Phone<input type="tel" maxLength={60} value={phone} onChange={event => setPhone(event.target.value)}/></label><label>Email<input type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label></div><label>Notes<textarea rows={4} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Useful context for the team"/></label>{error && <div className="error" role="alert">{error}</div>}<div className="modal-actions"><button className="cancel-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : `Save ${kind}`}<ArrowRight size={17}/></button></div></form></div></div>;
}

function NewItemDialog({ kind, projects, initialProjectId, onClose, onCreated }: { kind: Kind; projects: Item[]; initialProjectId: string; onClose: () => void; onCreated: () => void }) {
  const [title,setTitle] = useState("");
  const [client,setClient] = useState("");
  const [service,setService] = useState("");
  const [status,setStatus] = useState(statuses[kind][0]);
  const [dueDate,setDueDate] = useState("");
  const [notes,setNotes] = useState("");
  const [amount,setAmount] = useState("");
  const [currency,setCurrency] = useState(projects.find(project => project.id === initialProjectId)?.currency || "GHS");
  const [direction,setDirection] = useState("Income");
  const [price,setPrice] = useState("0");
  const [cost,setCost] = useState("0");
  const [projectId,setProjectId] = useState(initialProjectId);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.some(file => file.size === 0 || file.size > 25 * 1024 * 1024)) { setError("Each file must be between 1 byte and 25 MB."); return; }
    setSaving(true); setError("");
    let recordId = savedId;
    try {
      if (!recordId) {
        const result = await api("/api/items", { method: "POST", body: JSON.stringify({ kind,title,client,service,status,dueDate,notes,amount,currency,direction,price,cost,projectId }) });
        if (!result.id) throw new Error("Could not save the record.");
        recordId = result.id;
        setSavedId(recordId);
      }
      if (kind === "lead" || kind === "project") {
        const path = kind === "lead" ? "leads" : "projects";
        for (let index = 0; index < files.length; index++) {
          const form = new FormData(); form.set("file", files[index]);
          const response = await fetch(`/api/${path}/${recordId}/assets`, { method: "POST", body: form });
          const data = await response.json().catch(() => ({})) as { error?: string };
          if (!response.ok) { setFiles(files.slice(index)); throw new Error(data.error || `Could not upload ${files[index].name}.`); }
          setFiles(files.slice(index + 1));
        }
      }
      onCreated();
    } catch(cause) { setError(`${recordId ? `${labels[kind]} saved. ` : ""}${cause instanceof Error ? cause.message : "Could not save."}${recordId ? " Retry the remaining files or close this form." : ""}`); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if(e.target === e.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-top"><div><span className="section-number">NEW / {labels[kind].toUpperCase()}</span><h2 id="modal-title">Add a {labels[kind].toLowerCase()}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <form onSubmit={submit}>
        {!savedId && <><label>Title <input autoFocus required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind === "lead" ? "What does the client need?" : kind === "project" ? "Project name" : kind === "booking" ? "Meeting or booking title" : kind === "finance" ? "What was this for?" : "What needs to be done?"}/></label>
        <div className="form-row"><label>Client <input maxLength={160} value={client} onChange={e=>setClient(e.target.value)} placeholder="Client or business name"/></label><label>Service <select value={service} onChange={e=>setService(e.target.value)}><option value="">Select subservice</option>{serviceGroups.map(group => <optgroup key={group.name} label={group.name}>{group.items.map(item => <option key={item} value={`${group.name} / ${item}`}>{item}</option>)}</optgroup>)}</select></label></div>
        {kind === "project" && <><div className="form-row"><label>Project price <input type="number" min="0" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Budgeted cost <input type="number" min="0" step="0.01" required value={cost} onChange={e=>setCost(e.target.value)}/></label></div><label>Currency <input required maxLength={3} minLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} placeholder="GHS"/></label></>}
        {kind === "finance" && <div className="form-row"><label>Type <select value={direction} onChange={e=>setDirection(e.target.value)}><option>Income</option><option>Expense</option></select></label><label>Amount <input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label></div>}
        {kind === "finance" && <label>Project <select value={projectId} onChange={e => { const id = e.target.value; setProjectId(id); const project = projects.find(candidate => candidate.id === id); if (project) setCurrency(project.currency || "GHS"); }}><option value="">General / unlinked</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>}
        {kind === "finance" && <label>Currency <input required maxLength={3} minLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} placeholder="GHS"/></label>}
        <div className="form-row"><label>Status <select value={status} onChange={e=>setStatus(e.target.value)}>{statuses[kind].filter(s => kind !== "lead" || s !== "Won").map(s=><option key={s}>{s}</option>)}</select></label><label>{kind === "booking" ? "Booking date" : kind === "finance" ? "Transaction date" : "Due date"} <input type="date" required={kind === "booking"} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
        <label>Notes <textarea maxLength={4000} rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Brief, next step, or context"/></label></>}
        {(kind === "lead" || kind === "project") && <div className="form-assets"><strong><Paperclip size={16}/> Assets</strong><p>Attach briefs, references, or order files now. Each file can be up to 25 MB.</p><label className="file-picker"><Upload size={18}/><span>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose files"}</span><input type="file" multiple disabled={saving} onChange={event => setFiles(Array.from(event.target.files || []))} aria-label={`Choose ${kind} assets`}/></label>{files.length > 0 && <ul>{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name} <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></li>)}</ul>}</div>}
        {error && <div className="error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>{savedId ? "Close" : "Cancel"}</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : savedId ? "Retry uploads" : `Save ${labels[kind].toLowerCase()}`} <ArrowRight size={17}/></button></div>
      </form>
    </div>
  </div>;
}
