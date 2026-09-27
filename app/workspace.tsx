"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckSquare2, ChevronDown, CircleHelp, Command, Download, FileText, Handshake, LayoutDashboard, Menu, Paperclip, Pencil, Plus, Search, Sparkles, Trash2, Upload, UserRound, Users, Wallet, X } from "lucide-react";
import { serviceGroups } from "../lib/services";
import { displayVendorServices, parseVendorServices, serializeVendorServices, vendorServiceOptions } from "../lib/vendor-services";
import CalendarView from "./calendar-view";
import OverviewPanels from "./overview-panels";
import DeliverablesPanel from "./deliverables-panel";
import type { Deliverable } from "../lib/calendar-types";
import { cents, financialSummary, money, totals } from "../lib/finance";
import AIWorkspace from "./ai-workspace";
import PomaaForm from "./pomaa-form";
import { AlertMessage, useSiteConfirm } from "./site-alert";

type Kind = "lead" | "project" | "task" | "booking" | "finance";
type ContactKind = "customer" | "partner";
type Section = "overview" | "calendar" | "order" | "ai" | Kind | ContactKind;
type Item = { id: string; kind: Kind; title: string; client: string; service: string; status: string; due_date: string; notes: string; amount: string; currency: string; direction: string; price: string; cost: string; project_id: string | null; vendor_id: string | null; source_lead_id: string | null; created_at: number; updated_at: number };
type LeadAsset = { id: string; file_name: string; content_type: string; size_bytes: number; uploaded_at: number; uploaded_by: string };
type Contact = { id: string; kind: ContactKind; name: string; contact_person: string; phone: string; email: string; specialty: string; location: string; notes: string; created_at: number; updated_at: number };
const statuses: Record<Kind, string[]> = {
  lead: ["New", "Contacted", "Proposal sent", "Won", "Lost"],
  project: ["Planning", "In progress", "In review", "Delivered", "On hold"],
  task: ["To do", "In progress", "Done"],
  booking: ["Requested", "Confirmed", "Completed", "Cancelled"],
  finance: ["Pending", "Completed"],
};
const labels: Record<Kind, string> = { lead: "Lead", project: "Order", task: "Task", booking: "Booking", finance: "Finance entry" };
const nav = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "ai", label: "Pomaa", icon: Sparkles },
  { key: "lead", label: "Leads", icon: Users },
  { key: "order", label: "Orders", icon: BriefcaseBusiness },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "task", label: "Tasks", icon: CheckSquare2 },
  { key: "finance", label: "Finances", icon: Wallet },
  { key: "customer", label: "Customers", icon: UserRound },
  { key: "partner", label: "Vendors", icon: Handshake },
] as const;

async function api(path: string, options?: RequestInit): Promise<{items?: Item[]; error?: string; id?: string; ok?: boolean}> {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await response.json().catch(() => ({})) as {items?: Item[]; error?: string; id?: string; ok?: boolean};
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function Workspace() {
  const confirm = useSiteConfirm();
  const [section, setSection] = useState<Section>("overview");
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [vendorError, setVendorError] = useState("");
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [pomaaPrompt, setPomaaPrompt] = useState("");
  const [pomaaContact, setPomaaContact] = useState<ContactKind | null>(null);
  const [dialog, setDialog] = useState<Kind | null>(null);
  const [dialogProjectId, setDialogProjectId] = useState("");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [expandItemId, setExpandItemId] = useState<string | null>(null);
  const [calendarFocusDate, setCalendarFocusDate] = useState("");
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
  const reloadVendors = useCallback(async () => {
    try {
      const response = await fetch("/api/contacts?kind=partner", { cache: "no-store" });
      const data = await response.json() as { contacts?: Contact[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load vendors.");
      setVendors(data.contacts || []);
      setVendorError("");
    } catch (cause) { setVendorError(cause instanceof Error ? cause.message : "Could not load vendors."); }
  }, []);
  useEffect(() => { if (["overview", "order", "finance"].includes(section)) void reloadVendors(); }, [reloadVendors, section]);
  useEffect(() => {
    const context = (document as Document & {modelContext?: {registerTool: (tool: Record<string, unknown>, options: {signal: AbortSignal}) => void | Promise<void>}}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_mainstream_work_item",
      title: "Create Mainstream House work item",
      description: "Save a lead, project, task, booking, or finance entry in the Mainstream House workspace.",
      inputSchema: {type:"object", properties:{kind:{type:"string",enum:["lead","project","task","booking","finance"]},title:{type:"string"},client:{type:"string"},service:{type:"string"},status:{type:"string"},dueDate:{type:"string"},notes:{type:"string"},amount:{type:"string"},currency:{type:"string"},direction:{type:"string"},price:{type:"string"},cost:{type:"string"},projectId:{type:"string"},vendorId:{type:"string"}},required:["kind","title","status"],additionalProperties:false},
      annotations: {readOnlyHint:false,untrustedContentHint:false},
      async execute(input: unknown) { const result = await api("/api/items", {method:"POST", body:JSON.stringify(input)}); await reload(); return {id:result.id, saved:true}; },
    }, {signal:lifecycle.signal})).catch(error => console.error("WebMCP registration failed",error));
    return () => lifecycle.abort();
  }, [reload]);

  const visible = useMemo(() => items.filter(item =>
    (section === "overview" || item.kind === section || (section === "order" && (item.kind === "project" || item.kind === "booking"))) &&
    (!query || [item.title, item.client, item.service, item.status, item.notes].join(" ").toLowerCase().includes(query.toLowerCase()))
  ), [items, section, query]);
  const openLeads = items.filter(item => item.kind === "lead" && !["Won", "Lost"].includes(item.status)).length;
  const convertedLeadIds = useMemo(() => new Set(items.filter(item => item.kind === "project" && item.source_lead_id).map(item => item.source_lead_id)), [items]);
  async function convertLead(item: Item) {
    if (!await confirm({ title: "Convert lead to order?", message: `Create an order from “${item.title}” and mark the lead Won.`, confirmLabel: "Create order" })) return;
    setBusyId(item.id);
    try {
      const result = await api(`/api/leads/${item.id}/convert`, { method: "POST" });
      if (!result.id) throw new Error("Could not create the order.");
      await reload();
      setSection("order");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create order."); }
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
    if (!await confirm({ title: `Delete ${labels[item.kind].toLowerCase()}?`, message: item.kind === "lead" || item.kind === "project" || item.kind === "booking" ? `“${item.title}” and its attached files will be deleted.` : `“${item.title}” will be deleted.`, confirmLabel: "Delete", tone: "danger" })) return;
    setBusyId(item.id);
    try { await api(`/api/items/${item.id}`, { method: "DELETE" }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to delete."); }
    finally { setBusyId(""); }
  }
  async function openInvoice(item: Item) {
    setBusyId(item.id);
    try {
      const response = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: item.id }) });
      const data = await response.json() as { id?: number; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "Could not open the invoice.");
      window.location.assign(`/invoices/${data.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open the invoice."); setBusyId(""); }
  }
  const title = section === "overview" ? "Workspace overview" : nav.find(n => n.key === section)?.label || "Workspace";
  const newKind: Kind = section === "overview" ? "lead" : section === "order" ? "project" : section === "calendar" || section === "customer" || section === "partner" || section === "ai" ? "lead" : section;
  return <div className="shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><img src="/mainstream-house-logo.svg" alt="Mainstream House" /></div>
      <div className="side-caption">WORKSPACE</div>
      <nav className="navigation" aria-label="Main navigation">{nav.map(link => <button key={link.key} className={section === link.key ? "nav-link active" : "nav-link"} onClick={() => { setSection(link.key); setMobileNav(false); }}><link.icon size={18} strokeWidth={1.8}/><span>{link.label}</span>{link.key === "lead" && openLeads > 0 ? <em>{openLeads}</em> : null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={17}/><div><strong>Keep work together</strong><p>Track enquiries, orders, vendors, and money.</p></div></div><div className="side-footer">MAINSTREAM HOUSE <span>© 2026</span></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileNav(v => !v)} aria-label="Toggle menu"><Menu size={21}/></button><span className="breadcrumb">Workspace</span><span className="slash">/</span><strong>{title}</strong></div><div className="topbar-right"><span className="private-pill"><span/> Private workspace</span><div className="avatar" aria-label="Mainstream House">MH</div></div></header>
      <div className="content">
        {section !== "overview" && <div className="intro"><div><div className="eyebrow"><span className="eyebrow-line"/> MAINSTREAM HOUSE / OPERATIONS</div><h1>{title}</h1><p>{section === "ai" ? "Ask Pomaa, dictate an order, draft copy, or read an asset." : section === "lead" ? "Follow each enquiry from first contact to decision." : section === "order" ? "Manage delivery orders and scheduled bookings together." : section === "calendar" ? "See upcoming due dates, order milestones, and delivery progress." : section === "task" ? "Stay on top of the work that needs attention." : section === "customer" ? "Keep your customer details in one place." : section === "partner" ? "Keep printing and fulfillment vendors close at hand." : "Record income and expenses for the team to review."}</p></div>{section !== "customer" && section !== "partner" && section !== "calendar" && section !== "ai" && <button className="primary-button" onClick={() => setDialog(newKind)}><Plus size={18}/> New {labels[newKind].toLowerCase()} <ArrowRight size={18}/></button>}</div>}
        {section === "overview" && <OverviewPanels items={items} deliverables={deliverables} loading={loading || calendarLoading} onOpenCalendar={date => { setCalendarFocusDate(date); setSection("calendar"); }} onOpenItem={(kind, id) => { setQuery(""); setSection(kind === "project" || kind === "booking" ? "order" : kind); setExpandItemId(id); }} onOpenFinance={() => setSection("finance")} onOpenProjects={() => setSection("order")}/>}
        {section === "ai" ? <AIWorkspace onOpenForm={(kind, prompt) => { setPomaaPrompt(prompt); if (kind === "customer" || kind === "partner") setPomaaContact(kind); else setDialog(kind); }} items={items} onOrderAdded={() => { void reload(); }} onOpenOrder={id => { setQuery(""); setSection("order"); setExpandItemId(id); void reload(); }}/> : (section === "customer" || section === "partner") ? <ContactsPanel key={section} kind={section} /> : section === "calendar" ? <CalendarView key={calendarFocusDate || "default"} initialDate={calendarFocusDate || undefined} items={items} deliverables={deliverables} loading={loading || calendarLoading} error={error || calendarError} onRetry={() => { setError(""); setCalendarError(""); void reload(); void reloadDeliverables(); }} onOpenItem={(kind, id) => { setQuery(""); setSection(kind === "project" || kind === "booking" ? "order" : kind); setExpandItemId(id); }} /> : <><section className="records"><div className="records-head"><div><span className="section-number">01 / YOUR WORK</span><h2>{section === "overview" ? "Recent activity" : `All ${title.toLowerCase()}`}</h2></div><div className="records-actions"><label className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search work" aria-label="Search work"/></label>{section === "order" && <><button className="outline-button" onClick={() => setSection("ai")}><Sparkles size={17}/> Add from summary</button><button className="outline-button" onClick={() => setDialog("booking")}><Plus size={17}/> Add booking</button></>}<button className="outline-button" onClick={() => setDialog(section === "overview" || section === "order" ? "project" : newKind)}><Plus size={17}/> Add {section === "overview" ? "order" : labels[newKind].toLowerCase()}</button></div></div>
          {error && <AlertMessage message={error} onRetry={() => { setError(""); return reload(); }}/>}
          {section === "finance" && !loading && <FinanceSummary items={items} />}
          {loading ? <div className="empty">Loading your work…</div> : visible.length === 0 ? <div className="empty"><span className="empty-symbol"><Command size={23}/></span><h3>{query ? "No matching work" : "Nothing on the board yet"}</h3><p>{query ? "Try another search term." : "Add your first record to begin tracking work here."}</p>{!query && <button onClick={() => setDialog(newKind)}><Plus size={16}/> Add {section === "overview" ? "a lead" : `a ${labels[newKind].toLowerCase()}`}</button>}</div> : <WorkTable items={visible} allItems={items} vendors={vendors} deliverables={deliverables} onDeliverablesChanged={reloadDeliverables} expandId={expandItemId} onExpandHandled={() => setExpandItemId(null)} busyId={busyId} onStatus={changeStatus} onDelete={remove} onConvert={convertLead} onEdit={setEditItem} onAddFinance={projectId => { setDialogProjectId(projectId); setDialog("finance"); }} onInvoice={openInvoice} onViewLeadAssets={leadId => { setExpandItemId(leadId); setSection("lead"); }} convertedLeadIds={convertedLeadIds} />}
        </section>
        </>}
        <footer className="footer"><span>MAINSTREAM HOUSE / WORKSPACE</span><span>Built for the work behind the work.</span></footer>
      </div>
    </main>
    {pomaaContact && <ContactDialog initialPrompt={pomaaPrompt} kind={pomaaContact} contact={null} onClose={() => { setPomaaContact(null); setPomaaPrompt(""); }} onSaved={() => { setPomaaContact(null); setPomaaPrompt(""); void reload(); void reloadVendors(); }}/>}
    {dialog && <NewItemDialog initialPrompt={pomaaPrompt} kind={dialog} projects={items.filter(item => item.kind === "project" || item.kind === "booking")} vendors={vendors} vendorError={vendorError} reloadVendors={reloadVendors} initialProjectId={dialogProjectId} onClose={() => { setDialog(null); setPomaaPrompt(""); setDialogProjectId(""); void reload(); }} onCreated={() => { setDialog(null); setPomaaPrompt(""); setDialogProjectId(""); void reload(); }} />}
    {editItem && <EditItemDialog item={editItem} projects={items.filter(item => item.kind === "project" || item.kind === "booking")} vendors={vendors} vendorError={vendorError} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); void reload(); }} />}
  </div>;
}

function WorkTable({ items, allItems, vendors, deliverables, onDeliverablesChanged, expandId, onExpandHandled, busyId, onStatus, onDelete, onConvert, onEdit, onAddFinance, onInvoice, onViewLeadAssets, convertedLeadIds }: {
  items: Item[];
  allItems: Item[];
  vendors: Contact[];
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
  onInvoice: (item: Item) => Promise<void>;
  onViewLeadAssets: (leadId: string) => void;
  convertedLeadIds: Set<string | null>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => { if (expandId && items.some(item => item.id === expandId)) { setExpandedId(expandId); onExpandHandled(); } }, [expandId, items, onExpandHandled]);
  return <div className="table-wrap"><table><thead><tr><th>WORK</th><th>CLIENT</th><th>SERVICE / TYPE</th><th>DATE / AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{items.map(item => {
    const converted = item.kind === "lead" && convertedLeadIds.has(item.id);
    const expandable = item.kind !== "finance";
    const open = expandedId === item.id;
    return <Fragment key={item.id}><tr>
      <td>{expandable ? <button className="item-title detail-title" onClick={() => setExpandedId(open ? null : item.id)} aria-expanded={open} aria-controls={`details-${item.id}`}>{item.title}<ChevronDown size={15} className={open ? "chevron-open" : ""}/></button> : <div className="item-title">{item.title}</div>}<div className="item-kind">{labels[item.kind]}{item.source_lead_id ? " · From lead" : ""}{item.notes ? ` · ${item.notes}` : ""}</div></td>
      <td>{item.client || <span className="muted">—</span>}</td>
      <td>{item.kind === "finance" ? <>{item.direction}{item.project_id && <div className="item-kind">{allItems.find(project => project.id === item.project_id)?.title || "Order removed"}</div>}</> : <>{item.service || <span className="muted">—</span>}{item.vendor_id && <div className="item-kind">Vendor: {vendors.find(vendor => vendor.id === item.vendor_id)?.name || "Unavailable"}</div>}</>}</td>
      <td>{item.kind === "finance" ? money(cents(item.amount), item.currency) : item.due_date ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : <span className="muted">—</span>}</td>
      <td><select className={`status status-${item.status.toLowerCase().replaceAll(" ", "-")}`} aria-label={`Status for ${item.title}`} disabled={busyId === item.id || converted} value={item.status} onChange={event => void onStatus(item, event.target.value)}>{statuses[item.kind].map(status => <option key={status}>{status}</option>)}</select></td>
      <td><div className="row-actions">{item.kind === "lead" && !converted ? <button className="convert-button" disabled={busyId === item.id} onClick={() => void onConvert(item)}>Convert to order <ArrowRight size={14}/></button> : converted ? <span className="converted-label">Order created</span> : null}{(item.kind === "project" || item.kind === "booking") && <button className="convert-button" disabled={busyId === item.id} onClick={() => void onInvoice(item)}><FileText size={14}/> Invoice</button>}{item.kind === "project" && item.source_lead_id && <button className="convert-button" onClick={() => onViewLeadAssets(item.source_lead_id!)}>Lead assets <Paperclip size={14}/></button>}{expandable && <button className="convert-button" onClick={() => setExpandedId(open ? null : item.id)} aria-expanded={open} aria-controls={`details-${item.id}`}>{open ? "Hide details" : "View details"}<ChevronDown size={14} className={open ? "chevron-open" : ""}/></button>}{item.kind !== "task" && <button className="icon-button" disabled={busyId === item.id} onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`} title="Edit"><Pencil size={16}/></button>}<button className="delete-button" disabled={busyId === item.id} onClick={() => void onDelete(item)} aria-label={`Delete ${item.title}`}><X size={16}/></button></div></td>
    </tr>{expandable && open && <tr className="details-row" id={`details-${item.id}`}><td colSpan={6}><div className="details-content"><div className="details-grid"><div><span>Title</span><strong>{item.title}</strong></div><div><span>Customer</span><strong>{item.client || "—"}</strong></div><div><span>Service</span><strong>{item.service || "—"}</strong></div>{(item.kind === "project" || item.kind === "booking") && <div><span>Vendor</span><strong>{item.vendor_id ? vendors.find(vendor => vendor.id === item.vendor_id)?.name || "Unavailable" : "Unassigned"}</strong></div>}<div><span>{item.kind === "booking" ? "Booking date" : "Due date"}</span><strong>{item.due_date || "—"}</strong></div><div><span>Status</span><strong>{item.status}</strong></div><div><span>Created</span><strong>{new Date(item.created_at).toLocaleDateString()}</strong></div></div><div className="details-notes"><span>Notes</span><p>{item.notes || "No notes added."}</p></div>{(item.kind === "project" || item.kind === "booking") && <><ProjectFinancialPanel project={item} items={allItems} onAddFinance={() => onAddFinance(item.id)} onEditFinance={onEdit}/><DeliverablesPanel projectId={item.id} deliverables={deliverables.filter(deliverable => deliverable.project_id === item.id)} onChanged={onDeliverablesChanged}/></>}{(item.kind === "lead" || item.kind === "project" || item.kind === "booking") && <WorkAssetsPanel kind={item.kind} records={[item]} selectedId={item.id}/>}</div></td></tr>}</Fragment>;
  })}</tbody></table></div>;
}

function FinanceSummary({ items }: { items: Item[] }) {
  const orders = items.filter(item => item.kind === "project" || item.kind === "booking");
  const entries = items.filter(item => item.kind === "finance");
  const currencies = [...new Set([...orders, ...entries].map(item => item.currency || "GHS"))].sort();
  return <div className="finance-summary" aria-label="Financial summary">
    <div className="finance-heading"><h3>Financial summary</h3><p>Revenue includes order prices and completed general income. Expenses include order costs and completed general expenses. Profit is the difference.</p></div>
    {currencies.length ? currencies.map(currency => {
      const figures = financialSummary(items, currency);
      return <div className="finance-currency" key={currency}>
        <strong>{currency}</strong>
        <div className="finance-metrics"><div><span>Revenue</span><b>{money(figures.revenue, currency)}</b></div><div><span>Expenses</span><b>{money(figures.expenses, currency)}</b></div><div><span>Profit</span><b>{money(figures.profit, currency)}</b></div></div>
        {(figures.generalIncome > 0 || figures.generalExpenses > 0) && <p className="finance-pending">Included from general records: {money(figures.generalIncome, currency)} income · {money(figures.generalExpenses, currency)} expenses.</p>}
        {figures.linkedEntryCount > 0 && <p className="finance-pending">Order payments: {money(figures.received, currency)} received · {money(figures.paid, currency)} paid. These track payments against order totals.</p>}
        {figures.entryCount > 0 && (figures.pendingIncome > 0 || figures.pendingExpenses > 0) && <p className="finance-pending">Pending: {money(figures.pendingIncome, currency)} income · {money(figures.pendingExpenses, currency)} expenses. Pending records are excluded from totals.</p>}
      </div>;
    }) : <p>No orders or finance entries yet.</p>}
  </div>;
}

function ProjectFinancialPanel({ project, items, onAddFinance, onEditFinance }: { project: Item; items: Item[]; onAddFinance: () => void; onEditFinance: (item: Item) => void }) {
  const currency = project.currency || "GHS";
  const linked = items.filter(item => item.kind === "finance" && item.project_id === project.id);
  const payments = totals(linked);
  const revenue = cents(project.price);
  const expenses = cents(project.cost);
  return <section className="project-financials">
    <div className="finance-heading"><div><h3>Order finances</h3><p>Revenue is the order price. Expenses are the budgeted cost. Profit is the difference.</p></div><button type="button" className="outline-button" onClick={onAddFinance}><Plus size={16}/> Add entry</button></div>
    <div className="finance-metrics"><div><span>Revenue</span><b>{money(revenue, currency)}</b></div><div><span>Expenses</span><b>{money(expenses, currency)}</b></div><div><span>Profit</span><b>{money(revenue - expenses, currency)}</b></div></div>
    {linked.length > 0 ? <><p className="finance-pending">Payment entries: {money(payments.revenue, currency)} received · {money(payments.expenses, currency)} paid · {money(payments.pendingIncome, currency)} pending income · {money(payments.pendingExpenses, currency)} pending expenses</p><ul className="finance-entry-list">{linked.map(entry => <li key={entry.id}><span><strong>{entry.title}</strong><small>{entry.direction} · {entry.status}{entry.due_date ? ` · ${entry.due_date}` : ""}</small></span><b>{money(cents(entry.amount), currency)}</b><button type="button" className="icon-button" onClick={() => onEditFinance(entry)} aria-label={`Edit ${entry.title}`}><Pencil size={15}/></button></li>)}</ul></> : <p className="finance-pending">No payment entries linked yet.</p>}
  </section>;
}

function WorkAssetsPanel({ kind, records, selectedId }: { kind: "lead" | "project" | "booking"; records: Item[]; selectedId: string | null }) {
  const confirm = useSiteConfirm();
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
    if (!await confirm({ title: "Delete asset?", message: `“${asset.file_name}” will be removed from this ${kind === "lead" ? "lead" : "order"}.`, confirmLabel: "Delete asset", tone: "danger" })) return;
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
    <div className="assets-heading"><div><span className="section-number">{kind === "lead" ? "LEAD" : "ORDER"} FILES</span><h2><Paperclip size={21}/> Assets</h2><p>Briefs, references, and working files for this {kind === "lead" ? "lead" : "order"}.</p></div>{records.length > 1 && <label>{kind === "lead" ? "Lead" : "Order"}<select value={recordId} onChange={event => setRecordId(event.target.value)}>{records.map(record => <option key={record.id} value={record.id}>{record.title}{record.client ? ` · ${record.client}` : ""}</option>)}</select></label>}</div>
    {!records.length ? <div className="assets-empty">Add a {kind} above to start attaching files.</div> : <>
      <form className="upload-form" onSubmit={upload}><label className="file-picker"><Upload size={18}/><span>{selected ? selected.name : "Choose a file"}</span><input key={inputKey} type="file" onChange={event => setSelected(event.target.files?.[0] ?? null)} aria-label="Choose asset to upload"/></label><span className="file-limit">Up to 25 MB per file</span><button type="submit" className="primary-button" disabled={!selected || saving}>{saving ? "Saving…" : "Upload asset"}</button></form>
      {error && <AlertMessage message={error}/>}
      {loading ? <div className="assets-empty">Loading assets…</div> : assets.length ? <ul className="asset-list">{assets.map(asset => <li key={asset.id}><span className="asset-icon"><FileText size={18}/></span><div className="asset-details"><strong>{asset.file_name}</strong><small>{(asset.size_bytes / 1024 / 1024).toFixed(2)} MB · {new Date(asset.uploaded_at).toLocaleDateString()} · {asset.uploaded_by}</small></div><a href={`/api/${path}/${recordId}/assets/${asset.id}`} aria-label={`Download ${asset.file_name}`}><Download size={18}/><span>Download</span></a><button type="button" onClick={() => void removeAsset(asset)} disabled={saving} aria-label={`Delete ${asset.file_name}`}><Trash2 size={17}/></button></li>)}</ul> : <div className="assets-empty">No files attached to this {kind} yet.</div>}
    </>}
  </section>;
}

function useCustomers() {
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [customerError, setCustomerError] = useState("");
  const [customersLoading, setCustomersLoading] = useState(true);
  const reloadCustomers = useCallback(async () => {
    setCustomerError("");
    try {
      const response = await fetch("/api/contacts?kind=customer", { cache: "no-store" });
      const data = await response.json() as { contacts?: Contact[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load customers.");
      setCustomers(data.contacts || []);
      setCustomerError("");
    } catch (cause) { setCustomerError(cause instanceof Error ? cause.message : "Could not load customers."); }
    finally { setCustomersLoading(false); }
  }, []);
  useEffect(() => { void reloadCustomers(); }, [reloadCustomers]);
  return { customers, customerError, customersLoading, reloadCustomers };
}

function CustomerField({ value, onChange, customers, loading, onAdd }: { value: string; onChange: (name: string) => void; customers: Pick<Contact, "id" | "name">[]; loading: boolean; onAdd: () => void }) {
  const names = Array.from(new Map(customers.map(customer => [customer.name.trim().toLocaleLowerCase(), customer.name.trim()])).values()).filter(Boolean);
  if (value && !names.includes(value)) names.unshift(value);
  return <div className="customer-field"><label>Customer<select value={value} onChange={event => onChange(event.target.value)}><option value="">{loading ? "Loading customers…" : "Select customer"}</option>{names.map(name => <option key={name} value={name}>{name}</option>)}</select></label><button type="button" className="outline-button" onClick={onAdd}><Plus size={16}/> Add customer</button></div>;
}

function EditItemDialog({ item, projects, vendors, vendorError, onClose, onSaved }: { item: Item; projects: Item[]; vendors: Contact[]; vendorError: string; onClose: () => void; onSaved: () => void }) {
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
  const [vendorId, setVendorId] = useState(item.vendor_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<{ id: string; name: string } | null>(null);
  const { customers, customerError, customersLoading, reloadCustomers } = useCustomers();
  const customerOptions = createdCustomer && !customers.some(customer => customer.id === createdCustomer.id) ? [...customers, createdCustomer] : customers;
  const knownServices = serviceGroups.flatMap(group => group.items.map(name => `${group.name} / ${name}`));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await api(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ mode: "details", title, client, service, dueDate, notes, price, cost, amount, currency, direction, projectId, vendorId }) }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save changes."); }
    finally { setSaving(false); }
  }
  return <><div className="modal-backdrop" inert={showCustomerDialog} aria-hidden={showCustomerDialog} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
    <div className="modal-top"><div><span className="section-number">EDIT / {item.kind === "project" || item.kind === "booking" ? "ORDER" : item.kind.toUpperCase()}</span><h2 id="edit-item-title">Edit {labels[item.kind].toLowerCase()}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={submit}><PomaaForm kind={item.kind} disabled={saving} context={{title,client,service,dueDate,notes,amount,currency,direction,price,cost,projectId,vendorId}} fields={{title: setTitle, client: setClient, service: setService, dueDate: setDueDate, notes: setNotes, amount: setAmount, currency: setCurrency, direction: setDirection, price: setPrice, cost: setCost, projectId: setProjectId, vendorId: setVendorId}}/><label>Title <input autoFocus required maxLength={160} value={title} onChange={event => setTitle(event.target.value)}/></label><div className="customer-service-row"><CustomerField value={client} onChange={setClient} customers={customerOptions} loading={customersLoading} onAdd={() => setShowCustomerDialog(true)}/>{item.kind !== "finance" && <label>Service <select value={service} onChange={event => setService(event.target.value)}><option value="">Select subservice</option>{service && !knownServices.includes(service) && <option value={service}>{service}</option>}{serviceGroups.map(group => <optgroup key={group.name} label={group.name}>{group.items.map(name => <option key={name} value={`${group.name} / ${name}`}>{name}</option>)}</optgroup>)}</select></label>}</div>{customerError && <AlertMessage message={customerError} onRetry={reloadCustomers}/>} {(item.kind === "project" || item.kind === "booking") && <><label>Vendor <select value={vendorId} onChange={event => setVendorId(event.target.value)}><option value="">Unassigned</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>{vendorError && <AlertMessage message={vendorError}/>}</>}{(item.kind === "project" || item.kind === "booking") && <div className="form-row"><label>Order price <input type="number" min="0" step="0.01" required value={price} onChange={event => setPrice(event.target.value)}/></label><label>Budgeted cost <input type="number" min="0" step="0.01" required value={cost} onChange={event => setCost(event.target.value)}/></label></div>}{item.kind === "finance" && <><div className="form-row"><label>Type <select value={direction} onChange={event => setDirection(event.target.value)}><option>Income</option><option>Expense</option></select></label><label>Amount <input type="number" min="0" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)}/></label></div><label>Order <select value={projectId} onChange={event => { const id = event.target.value; setProjectId(id); const project = projects.find(candidate => candidate.id === id); if (project) setCurrency(project.currency || "GHS"); }}><option value="">General / unlinked</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title} {project.kind === "booking" ? "(booking)" : ""}</option>)}</select></label></>}{(item.kind === "project" || item.kind === "booking" || item.kind === "finance") && <label>Currency <input required maxLength={3} minLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} placeholder="GHS"/></label>}<label>{item.kind === "finance" ? "Transaction date" : item.kind === "booking" ? "Booking date" : "Due date"} <input type="date" required={item.kind === "booking"} value={dueDate} onChange={event => setDueDate(event.target.value)}/></label><label>Notes <textarea rows={4} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)}/></label>{error && <AlertMessage message={error}/>}<div className="modal-actions"><button className="cancel-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}<ArrowRight size={17}/></button></div></form>
    {(item.kind === "lead" || item.kind === "project" || item.kind === "booking") && <WorkAssetsPanel kind={item.kind} records={[item]} selectedId={item.id}/>}
  </div></div>
  {showCustomerDialog && <ContactDialog kind="customer" contact={null} onClose={() => setShowCustomerDialog(false)} onSaved={(id, name) => { setCreatedCustomer({ id, name }); setClient(name); setShowCustomerDialog(false); void reloadCustomers(); }}/>}</>;
}

function ContactsPanel({ kind }: { kind: ContactKind }) {
  const confirm = useSiteConfirm();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Contact | "new" | null>(null);
  const [busyId, setBusyId] = useState("");
  const noun = kind === "customer" ? "customer" : "vendor";
  const reload = useCallback(async () => {
    try { const response = await fetch(`/api/contacts?kind=${kind}`, { cache: "no-store" }); const data = await response.json() as { contacts?: Contact[]; error?: string }; if (!response.ok) throw new Error(data.error || "Could not load contacts."); setContacts(data.contacts || []); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load contacts."); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => { void reload(); }, [reload]);
  async function remove(contact: Contact) {
    if (!await confirm({ title: `Delete ${kind === "customer" ? "customer" : "vendor"}?`, message: `“${contact.name}” will be removed from ${kind === "customer" ? "customers" : "vendors"}.`, confirmLabel: "Delete", tone: "danger" })) return;
    setBusyId(contact.id);
    try { await api(`/api/contacts/${contact.id}`, { method: "DELETE" }); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete contact."); }
    finally { setBusyId(""); }
  }
  const visible = contacts.filter(contact => !query || [contact.name, contact.contact_person, contact.phone, contact.email, contact.specialty, contact.location, contact.notes].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <section className="records"><div className="records-head"><div><span className="section-number">01 / YOUR {noun.toUpperCase()}S</span><h2>{kind === "customer" ? "Customer directory" : "Vendor directory"}</h2></div><div className="records-actions"><label className="search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${noun}s`} aria-label={`Search ${noun}s`}/></label><button className="outline-button" onClick={() => setDialog("new")}><Plus size={17}/> Add {noun}</button></div></div>
    {error && <AlertMessage message={error} onRetry={() => { setError(""); return reload(); }}/>}
    {loading ? <div className="empty">Loading {noun}s…</div> : visible.length ? <div className="table-wrap"><table><thead><tr><th>NAME</th><th>CONTACT</th><th>PHONE / EMAIL</th><th>{kind === "partner" ? "SERVICES" : "DETAILS"}</th>{kind === "partner" && <th>LOCATION</th>}<th>ACTION</th></tr></thead><tbody>{visible.map(contact => <tr key={contact.id}><td><div className="item-title">{contact.name}</div>{contact.notes && <div className="item-kind" title={contact.notes}>{contact.notes}</div>}</td><td>{contact.contact_person || <span className="muted">—</span>}</td><td><div className="contact-links">{contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{!contact.phone && !contact.email && <span className="muted">—</span>}</div></td><td>{(kind === "partner" ? displayVendorServices(contact.specialty) : contact.specialty) || <span className="muted">—</span>}</td>{kind === "partner" && <td>{contact.location || <span className="muted">—</span>}</td>}<td><div className="row-actions"><button className="icon-button" onClick={() => setDialog(contact)} aria-label={`Edit ${contact.name}`} title="Edit"><Pencil size={16}/></button><button className="delete-button" disabled={busyId === contact.id} onClick={() => void remove(contact)} aria-label={`Delete ${contact.name}`}><X size={16}/></button></div></td></tr>)}</tbody></table></div> : <div className="empty"><span className="empty-symbol">{kind === "customer" ? <UserRound size={23}/> : <Handshake size={23}/>}</span><h3>{query ? "No matching contacts" : `No ${noun}s saved yet`}</h3><p>{query ? "Try another search term." : `Save your first ${noun} to keep their details handy.`}</p>{!query && <button onClick={() => setDialog("new")}><Plus size={16}/> Add {noun}</button>}</div>}
    {dialog && <ContactDialog key={dialog === "new" ? "new" : dialog.id} kind={kind} contact={dialog === "new" ? null : dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void reload(); }} />}
  </section>;
}

function ContactDialog({ kind, contact, onClose, onSaved, initialPrompt = "" }: { kind: ContactKind; contact: Contact | null; initialPrompt?: string; onClose: () => void; onSaved: (id: string, name: string) => void }) {
  const [name, setName] = useState(contact?.name || "");
  const [contactPerson, setContactPerson] = useState(contact?.contact_person || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [specialty, setSpecialty] = useState(contact?.specialty || "");
  const [vendorServices, setVendorServices] = useState(() => parseVendorServices(contact?.specialty || ""));
  const [location, setLocation] = useState(contact?.location || "");
  const [notes, setNotes] = useState(contact?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { const result = await api(contact ? `/api/contacts/${contact.id}` : "/api/contacts", { method: contact ? "PATCH" : "POST", body: JSON.stringify({ kind, name, contactPerson, phone, email, specialty: kind === "partner" ? serializeVendorServices(vendorServices) : specialty, location: kind === "partner" ? location : "", notes }) }); onSaved(result.id || contact?.id || "", name.trim()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save contact."); }
    finally { setSaving(false); }
  }
  function toggleVendorService(service: string) {
    setVendorServices(current => current.includes(service) ? current.filter(item => item !== service) : [...current, service]);
  }
  const legacyServices = vendorServices.filter(service => !vendorServiceOptions.some(option => option === service));
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <div className="modal-top"><div><span className="section-number">{contact ? "EDIT" : "NEW"} / {kind === "partner" ? "VENDOR" : "CUSTOMER"}</span><h2 id="contact-title">{contact ? "Edit" : "Add"} {kind === "partner" ? "vendor" : "customer"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <form onSubmit={submit}><PomaaForm initialPrompt={initialPrompt} kind={kind} disabled={saving} context={{name,contactPerson,phone,email,specialty,location,notes,vendorServices}} fields={{name: setName, contactPerson: setContactPerson, phone: setPhone, email: setEmail, specialty: setSpecialty, location: setLocation, notes: setNotes, vendorServices: value => setVendorServices(JSON.parse(value))}}/>
        <label>{kind === "customer" ? "Customer / business name" : "Vendor / business name"}<input autoFocus required maxLength={160} value={name} onChange={event => setName(event.target.value)}/></label>
        <div className="form-row"><label>Contact person<input maxLength={160} value={contactPerson} onChange={event => setContactPerson(event.target.value)}/></label>{kind === "customer" && <label>Details<input maxLength={160} value={specialty} onChange={event => setSpecialty(event.target.value)} placeholder="Organization or customer type"/></label>}</div>
        {kind === "partner" && <div className="vendor-services-field">
          <span className="vendor-services-label">Services</span>
          <details className="vendor-services-dropdown"><summary>{vendorServices.length ? `${vendorServices.length} service${vendorServices.length === 1 ? "" : "s"} selected` : "Select services"}<ChevronDown size={16}/></summary>
            <div className="vendor-services-list">
              {legacyServices.length > 0 && <fieldset><legend>Previously saved</legend>{legacyServices.map(service => <label className="vendor-service-option" key={service}><input type="checkbox" checked onChange={() => toggleVendorService(service)}/><span>{service}</span></label>)}</fieldset>}
              {serviceGroups.map(group => <fieldset key={group.name}><legend>{group.name}</legend>{group.items.map(item => { const service = `${group.name} / ${item}`; return <label className="vendor-service-option" key={service}><input type="checkbox" checked={vendorServices.includes(service)} onChange={() => toggleVendorService(service)}/><span>{item}</span></label>; })}</fieldset>)}
            </div>
          </details>
          {vendorServices.length > 0 && <p className="vendor-services-selected">{vendorServices.join(", ")}</p>}
        </div>}
        {kind === "partner" && <label>Location<input maxLength={255} value={location} onChange={event => setLocation(event.target.value)} placeholder="City, area, or address"/></label>}
        <div className="form-row"><label>Phone<input type="tel" maxLength={60} value={phone} onChange={event => setPhone(event.target.value)}/></label><label>Email<input type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label></div>
        <label>Notes<textarea rows={4} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Useful context for the team"/></label>
        {error && <AlertMessage message={error}/>}
        <div className="modal-actions"><button className="cancel-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : `Save ${kind === "partner" ? "vendor" : "customer"}`}<ArrowRight size={17}/></button></div>
      </form>
    </div>
  </div>;
}

function NewItemDialog({ kind, projects, vendors, vendorError, reloadVendors, initialProjectId, onClose, onCreated, initialPrompt = "" }: { kind: Kind; projects: Item[]; vendors: Contact[]; vendorError: string; reloadVendors: () => Promise<void>; initialProjectId: string; initialPrompt?: string; onClose: () => void; onCreated: () => void }) {
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
  const [vendorId,setVendorId] = useState("");
  const [showVendorDialog,setShowVendorDialog] = useState(false);
  const [showCustomerDialog,setShowCustomerDialog] = useState(false);
  const [createdVendor,setCreatedVendor] = useState<{id: string; name: string} | null>(null);
  const [createdCustomer,setCreatedCustomer] = useState<{id: string; name: string} | null>(null);
  const { customers, customerError, customersLoading, reloadCustomers } = useCustomers();
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const vendorOptions = createdVendor && !vendors.some(vendor => vendor.id === createdVendor.id) ? [...vendors, createdVendor] : vendors;
  const customerOptions = createdCustomer && !customers.some(customer => customer.id === createdCustomer.id) ? [...customers, createdCustomer] : customers;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.some(file => file.size === 0 || file.size > 25 * 1024 * 1024)) { setError("Each file must be between 1 byte and 25 MB."); return; }
    setSaving(true); setError("");
    let recordId = savedId;
    try {
      if (!recordId) {
        const result = await api("/api/items", { method: "POST", body: JSON.stringify({ kind,title,client,service,status,dueDate,notes,amount,currency,direction,price,cost,projectId,vendorId }) });
        if (!result.id) throw new Error("Could not save the record.");
        recordId = result.id;
        setSavedId(recordId);
      }
      if (kind === "lead" || kind === "project" || kind === "booking") {
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
  return <><div className="modal-backdrop" inert={showVendorDialog || showCustomerDialog} aria-hidden={showVendorDialog || showCustomerDialog} onMouseDown={e => { if(e.target === e.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-top"><div><span className="section-number">NEW / {labels[kind].toUpperCase()}</span><h2 id="modal-title">Add a {labels[kind].toLowerCase()}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <form onSubmit={submit}>{!savedId && <PomaaForm initialPrompt={initialPrompt} kind={kind} disabled={saving} context={{title,client,service,status,dueDate,notes,amount,currency,direction,price,cost,projectId,vendorId}} fields={{title: setTitle, client: setClient, service: setService, dueDate: setDueDate, notes: setNotes, amount: setAmount, currency: setCurrency, direction: setDirection, price: setPrice, cost: setCost, projectId: setProjectId, vendorId: setVendorId, status: setStatus}}/>}
        {!savedId && <><label>Title <input autoFocus required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind === "lead" ? "What does the client need?" : kind === "project" ? "Order name" : kind === "booking" ? "Booking title" : kind === "finance" ? "What was this for?" : "What needs to be done?"}/></label>
        <div className="customer-service-row"><CustomerField value={client} onChange={setClient} customers={customerOptions} loading={customersLoading} onAdd={() => setShowCustomerDialog(true)}/><label>Service <select value={service} onChange={e=>setService(e.target.value)}><option value="">Select subservice</option>{serviceGroups.map(group => <optgroup key={group.name} label={group.name}>{group.items.map(item => <option key={item} value={`${group.name} / ${item}`}>{item}</option>)}</optgroup>)}</select></label></div>
        {customerError && <AlertMessage message={customerError} onRetry={reloadCustomers}/>}
        {(kind === "project" || kind === "booking") && <><div className="vendor-field"><label>Vendor <select value={vendorId} onChange={e=>setVendorId(e.target.value)}><option value="">Unassigned</option>{vendorOptions.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><button type="button" className="outline-button" onClick={() => setShowVendorDialog(true)}><Plus size={16}/> Add vendor</button></div>{vendorError && <AlertMessage message={vendorError}/>}<div className="form-row"><label>Order price <input type="number" min="0" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Budgeted cost <input type="number" min="0" step="0.01" required value={cost} onChange={e=>setCost(e.target.value)}/></label></div><label>Currency <input required maxLength={3} minLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} placeholder="GHS"/></label></>}
        {kind === "finance" && <div className="form-row"><label>Type <select value={direction} onChange={e=>setDirection(e.target.value)}><option>Income</option><option>Expense</option></select></label><label>Amount <input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label></div>}
        {kind === "finance" && <label>Order <select value={projectId} onChange={e => { const id = e.target.value; setProjectId(id); const project = projects.find(candidate => candidate.id === id); if (project) setCurrency(project.currency || "GHS"); }}><option value="">General / unlinked</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title} {project.kind === "booking" ? "(booking)" : ""}</option>)}</select></label>}
        {kind === "finance" && <label>Currency <input required maxLength={3} minLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} placeholder="GHS"/></label>}
        <div className="form-row"><label>Status <select value={status} onChange={e=>setStatus(e.target.value)}>{statuses[kind].filter(s => kind !== "lead" || s !== "Won").map(s=><option key={s}>{s}</option>)}</select></label><label>{kind === "booking" ? "Booking date" : kind === "finance" ? "Transaction date" : "Due date"} <input type="date" required={kind === "booking"} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
        <label>Notes <textarea maxLength={4000} rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Brief, next step, or context"/></label></>}
        {(kind === "lead" || kind === "project" || kind === "booking") && <div className="form-assets"><strong><Paperclip size={16}/> Assets</strong><p>Attach briefs, references, or order files now. Each file can be up to 25 MB.</p><label className="file-picker"><Upload size={18}/><span>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose files"}</span><input type="file" multiple disabled={saving} onChange={event => setFiles(Array.from(event.target.files || []))} aria-label={`Choose ${kind} assets`}/></label>{files.length > 0 && <ul>{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name} <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></li>)}</ul>}</div>}
        {error && <AlertMessage message={error}/>}
        <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>{savedId ? "Close" : "Cancel"}</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : savedId ? "Retry uploads" : `Save ${labels[kind].toLowerCase()}`} <ArrowRight size={17}/></button></div>
      </form>
    </div>
  </div>
  {showVendorDialog && <ContactDialog kind="partner" contact={null} onClose={() => setShowVendorDialog(false)} onSaved={(id, name) => { setCreatedVendor({ id, name }); setVendorId(id); setShowVendorDialog(false); void reloadVendors(); }}/>}
  {showCustomerDialog && <ContactDialog kind="customer" contact={null} onClose={() => setShowCustomerDialog(false)} onSaved={(id, name) => { setCreatedCustomer({ id, name }); setClient(name); setShowCustomerDialog(false); void reloadCustomers(); }}/>}
  </>;
}
