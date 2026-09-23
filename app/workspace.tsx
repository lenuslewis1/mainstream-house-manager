"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckSquare2, CircleHelp, Command, LayoutDashboard, Menu, Plus, Search, Users, Wallet, X } from "lucide-react";

type Kind = "lead" | "project" | "task" | "booking" | "finance";
type Item = { id: string; kind: Kind; title: string; client: string; service: string; status: string; due_date: string; notes: string; amount: string; currency: string; direction: string; created_at: number; updated_at: number };
const services = ["Technology", "Graphic Design", "Website Development", "General Printing", "Large Format Printing", "Packaging", "Social Media Management"];
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
  { key: "task", label: "Tasks", icon: CheckSquare2 },
  { key: "booking", label: "Bookings", icon: CalendarDays },
  { key: "finance", label: "Finances", icon: Wallet },
] as const;

async function api(path: string, options?: RequestInit): Promise<{items?: Item[]; error?: string; id?: string; ok?: boolean}> {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await response.json().catch(() => ({})) as {items?: Item[]; error?: string; id?: string; ok?: boolean};
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function Workspace() {
  const [section, setSection] = useState<"overview" | Kind>("overview");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Kind | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [busyId, setBusyId] = useState("");

  const reload = useCallback(async () => {
    try { const data = await api("/api/items"); setItems(data.items || []); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load records."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const context = (document as Document & {modelContext?: {registerTool: (tool: Record<string, unknown>, options: {signal: AbortSignal}) => void | Promise<void>}}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_mainstream_work_item",
      title: "Create Mainstream House work item",
      description: "Save a lead, project, task, booking, or finance entry in the Mainstream House workspace.",
      inputSchema: {type:"object", properties:{kind:{type:"string",enum:["lead","project","task","booking","finance"]},title:{type:"string"},client:{type:"string"},service:{type:"string"},status:{type:"string"},dueDate:{type:"string"},notes:{type:"string"},amount:{type:"string"},currency:{type:"string"},direction:{type:"string"}},required:["kind","title","status"],additionalProperties:false},
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
  async function changeStatus(item: Item, status: string) {
    setBusyId(item.id);
    try { await api(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update."); }
    finally { setBusyId(""); }
  }
  async function remove(item: Item) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    setBusyId(item.id);
    try { await api(`/api/items/${item.id}`, { method: "DELETE" }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to delete."); }
    finally { setBusyId(""); }
  }
  const title = section === "overview" ? "Workspace overview" : nav.find(n => n.key === section)?.label || "Workspace";
  return <div className="shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark">M<span>.</span></div><div className="brand-word"><strong>MAINSTREAM</strong><span>HOUSE / STUDIO</span></div></div>
      <div className="side-caption">WORKSPACE</div>
      <nav className="navigation" aria-label="Main navigation">{nav.map(link => <button key={link.key} className={section === link.key ? "nav-link active" : "nav-link"} onClick={() => { setSection(link.key); setMobileNav(false); }}><link.icon size={18} strokeWidth={1.8}/><span>{link.label}</span>{link.key === "lead" && counts.leads > 0 ? <em>{counts.leads}</em> : null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={17}/><div><strong>Keep work together</strong><p>Track enquiries, delivery, bookings, and money.</p></div></div><div className="side-footer">MAINSTREAM HOUSE <span>© 2026</span></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileNav(v => !v)} aria-label="Toggle menu"><Menu size={21}/></button><span className="breadcrumb">Workspace</span><span className="slash">/</span><strong>{title}</strong></div><div className="topbar-right"><span className="private-pill"><span/> Private workspace</span><div className="avatar" aria-label="Mainstream House">MH</div></div></header>
      <div className="content">
        <div className="intro"><div><div className="eyebrow"><span className="eyebrow-line"/> MAINSTREAM HOUSE / OPERATIONS</div><h1>{section === "overview" ? <>Good work starts<br/><i>with a clear view.</i></> : title}</h1><p>{section === "overview" ? "Enquiries, delivery, bookings, and finances in one shared workspace." : section === "lead" ? "Follow each enquiry from first contact to decision." : section === "project" ? "Keep delivery moving from brief to handoff." : section === "task" ? "Stay on top of the work that needs attention." : section === "booking" ? "Track scheduled client work and appointments." : "Record income and expenses for the team to review."}</p></div><button className="primary-button" onClick={() => setDialog(section === "overview" ? "lead" : section)}><Plus size={18}/> New {section === "overview" ? "lead" : labels[section].toLowerCase()} <ArrowRight size={18}/></button></div>
        {section === "overview" && <section className="stat-grid" aria-label="Current work"><button onClick={() => setSection("lead")} className="stat-card"><span className="stat-icon lime"><Users size={19}/></span><span className="stat-label">OPEN LEADS</span><strong>{counts.leads.toString().padStart(2,"0")}</strong><span className="stat-foot">Enquiries to follow up <ArrowRight size={16}/></span></button><button onClick={() => setSection("project")} className="stat-card"><span className="stat-icon violet"><BriefcaseBusiness size={19}/></span><span className="stat-label">ACTIVE PROJECTS</span><strong>{counts.projects.toString().padStart(2,"0")}</strong><span className="stat-foot">Work in motion <ArrowRight size={16}/></span></button><button onClick={() => setSection("task")} className="stat-card"><span className="stat-icon orange"><CheckSquare2 size={19}/></span><span className="stat-label">OPEN TASKS</span><strong>{counts.tasks.toString().padStart(2,"0")}</strong><span className="stat-foot">Next actions <ArrowRight size={16}/></span></button></section>}
        {section === "overview" && <div className="quick-row"><button onClick={() => setSection("booking")}><CalendarDays size={18}/><span><strong>{counts.bookings} upcoming bookings</strong><small>View schedule</small></span><ArrowRight size={17}/></button><button onClick={() => setSection("finance")}><Wallet size={18}/><span><strong>{counts.finances} finance entries</strong><small>View income and expenses</small></span><ArrowRight size={17}/></button></div>}
        <section className="records"><div className="records-head"><div><span className="section-number">01 / YOUR WORK</span><h2>{section === "overview" ? "Recent activity" : `All ${title.toLowerCase()}`}</h2></div><div className="records-actions"><label className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search work" aria-label="Search work"/></label><button className="outline-button" onClick={() => setDialog(section === "overview" ? "project" : section)}><Plus size={17}/> Add {section === "overview" ? "project" : labels[section].toLowerCase()}</button></div></div>
          {error && <div className="error" role="alert">{error} <button onClick={() => void reload()}>Try again</button></div>}
          {loading ? <div className="empty">Loading your work…</div> : visible.length === 0 ? <div className="empty"><span className="empty-symbol"><Command size={23}/></span><h3>{query ? "No matching work" : "Nothing on the board yet"}</h3><p>{query ? "Try another search term." : "Add your first record to begin tracking work here."}</p>{!query && <button onClick={() => setDialog(section === "overview" ? "lead" : section)}><Plus size={16}/> Add {section === "overview" ? "a lead" : `a ${labels[section].toLowerCase()}`}</button>}</div> : <div className="table-wrap"><table><thead><tr><th>WORK</th><th>CLIENT</th><th>SERVICE / TYPE</th><th>DATE / AMOUNT</th><th>STATUS</th><th/></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><div className="item-title">{item.title}</div><div className="item-kind">{labels[item.kind]}{item.notes ? ` · ${item.notes}` : ""}</div></td><td>{item.client || <span className="muted">—</span>}</td><td>{item.kind === "finance" ? item.direction : item.service || <span className="muted">—</span>}</td><td>{item.kind === "finance" ? `${item.currency} ${item.amount}` : item.due_date ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}) : <span className="muted">—</span>}</td><td><select className={`status status-${item.status.toLowerCase().replaceAll(" ","-")}`} aria-label={`Status for ${item.title}`} disabled={busyId === item.id} value={item.status} onChange={e => void changeStatus(item,e.target.value)}>{statuses[item.kind].map(s => <option key={s}>{s}</option>)}</select></td><td><button className="delete-button" disabled={busyId === item.id} onClick={() => void remove(item)} aria-label={`Delete ${item.title}`}><X size={16}/></button></td></tr>)}</tbody></table></div>}
        </section>
        <footer className="footer"><span>MAINSTREAM HOUSE / WORKSPACE</span><span>Built for the work behind the work.</span></footer>
      </div>
    </main>
    {dialog && <NewItemDialog kind={dialog} onClose={() => setDialog(null)} onCreated={() => { setDialog(null); void reload(); }} />}
  </div>;
}

function NewItemDialog({ kind, onClose, onCreated }: { kind: Kind; onClose: () => void; onCreated: () => void }) {
  const [title,setTitle] = useState("");
  const [client,setClient] = useState("");
  const [service,setService] = useState("");
  const [status,setStatus] = useState(statuses[kind][0]);
  const [dueDate,setDueDate] = useState("");
  const [notes,setNotes] = useState("");
  const [amount,setAmount] = useState("");
  const [currency,setCurrency] = useState("GHS");
  const [direction,setDirection] = useState("Income");
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true); setError(""); try { await api("/api/items", { method: "POST", body: JSON.stringify({ kind,title,client,service,status,dueDate,notes,amount,currency,direction }) }); onCreated(); } catch(e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); } }
  return <div className="modal-backdrop" onMouseDown={e => { if(e.target === e.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-top"><div><span className="section-number">NEW / {labels[kind].toUpperCase()}</span><h2 id="modal-title">Add a {labels[kind].toLowerCase()}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <form onSubmit={submit}>
        <label>Title <input autoFocus required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind === "lead" ? "What does the client need?" : kind === "project" ? "Project name" : kind === "booking" ? "Meeting or booking title" : kind === "finance" ? "What was this for?" : "What needs to be done?"}/></label>
        <div className="form-row"><label>Client <input maxLength={160} value={client} onChange={e=>setClient(e.target.value)} placeholder="Client or business name"/></label><label>Service <select value={service} onChange={e=>setService(e.target.value)}><option value="">Select service</option>{services.map(s=><option key={s}>{s}</option>)}</select></label></div>
        {kind === "finance" && <div className="form-row"><label>Type <select value={direction} onChange={e=>setDirection(e.target.value)}><option>Income</option><option>Expense</option></select></label><label>Amount <input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label></div>}
        {kind === "finance" && <label>Currency <input required maxLength={3} minLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} placeholder="GHS"/></label>}
        <div className="form-row"><label>Status <select value={status} onChange={e=>setStatus(e.target.value)}>{statuses[kind].map(s=><option key={s}>{s}</option>)}</select></label><label>{kind === "booking" ? "Booking date" : kind === "finance" ? "Transaction date" : "Due date"} <input type="date" required={kind === "booking"} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
        <label>Notes <textarea maxLength={4000} rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Brief, next step, or context"/></label>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : `Save ${labels[kind].toLowerCase()}`} <ArrowRight size={17}/></button></div>
      </form>
    </div>
  </div>;
}
