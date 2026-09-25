"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, Copy, FileSearch, MessageCircle, Send, Sparkles, WandSparkles } from "lucide-react";

type Mode = "order" | "ask" | "draft" | "extract";
type Item = { id: string; kind: string; title: string; client: string };
type Asset = { id: string; kind: "lead" | "order"; parent_id: string; parent_title: string; file_name: string; size_bytes: number };
type CreatedOrder = { id: string; title: string; client: string; service: string; dueDate: string; price: string; cost: string; currency: string; warnings: string[] };
const modes: { key: Mode; title: string; description: string; icon: typeof Sparkles }[] = [
  { key: "order", title: "Add an order", description: "Turn a written summary into an order", icon: ClipboardList },
  { key: "ask", title: "Ask the workspace", description: "Get answers from saved records", icon: MessageCircle },
  { key: "draft", title: "Draft copy", description: "Write a message or proposal", icon: WandSparkles },
  { key: "extract", title: "Read an asset", description: "Pull details from an uploaded file", icon: FileSearch },
];
const prompts: Record<Mode, string> = {
  order: "Example: 200 A5 stickers for Veetas Splash, GHS 400, printing costs GHS 260, due 30 September. Use Bright Prints.",
  ask: "Example: Which orders are due this week and what is our projected profit?",
  draft: "Example: Tell the customer their order is ready and ask them to confirm delivery details.",
  extract: "Optional: What quantities, specifications, and deadlines does this file mention?",
};

export default function AIWorkspace({ items, onOrderAdded, onOpenOrder }: { items: Item[]; onOrderAdded: () => void; onOpenOrder: (id: string) => void }) {
  const [mode, setMode] = useState<Mode>("order");
  const [prompt, setPrompt] = useState("");
  const [recordId, setRecordId] = useState("");
  const [draftType, setDraftType] = useState("customer_message");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [assetError, setAssetError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [created, setCreated] = useState<CreatedOrder | null>(null);
  useEffect(() => {
    if (mode !== "extract") return;
    let active = true;
    void fetch("/api/ai/assets", { cache: "no-store" }).then(async response => {
      const data = await response.json() as { assets?: Asset[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load assets.");
      if (active) { setAssets(data.assets || []); setAssetError(""); }
    }).catch(cause => { if (active) setAssetError(cause instanceof Error ? cause.message : "Could not load assets."); });
    return () => { active = false; };
  }, [mode]);
  function selectMode(next: Mode) { setMode(next); setResult(""); setCreated(null); setError(""); setPrompt(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(""); setCreated(null);
    try {
      const asset = assets.find(candidate => candidate.id === assetId);
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, prompt, recordId, draftType, assetId, assetKind: asset?.kind }) });
      const data = await response.json() as { text?: string; error?: string } & Partial<CreatedOrder>;
      if (!response.ok) throw new Error(data.error || "AI could not complete the request.");
      if (mode === "order" && data.id) { setCreated(data as CreatedOrder); onOrderAdded(); }
      else setResult(data.text || "No result returned.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not complete the request."); }
    finally { setBusy(false); }
  }
  async function copyResult() { try { await navigator.clipboard.writeText(result); } catch { setError("Could not copy the text. Please select it manually."); } }
  return <section className="ai-workspace" aria-label="AI assistant">
    <div className="ai-heading"><span className="section-number"><Sparkles size={14}/> MAINSTREAM HOUSE AI</span><h2>Work faster with your workspace</h2><p>Use your saved records to answer questions, create orders, draft copy, and read attached files.</p></div>
    <div className="ai-mode-grid" role="tablist" aria-label="AI actions">{modes.map(option => <button key={option.key} type="button" role="tab" aria-selected={mode === option.key} className={mode === option.key ? "ai-mode active" : "ai-mode"} onClick={() => selectMode(option.key)}><option.icon size={20}/><strong>{option.title}</strong><span>{option.description}</span></button>)}</div>
    <div className="ai-form-card"><div className="ai-form-heading"><div><span className="section-number">{modes.find(option => option.key === mode)?.title.toUpperCase()}</span><h3>{mode === "order" ? "Describe the order" : mode === "ask" ? "Ask a question" : mode === "draft" ? "Tell us what to write" : "Choose a file"}</h3></div><Sparkles size={24}/></div>
      <form onSubmit={event => void submit(event)}>
        {mode === "draft" && <div className="ai-fields"><label>Format<select value={draftType} onChange={event => setDraftType(event.target.value)}><option value="customer_message">Customer message</option><option value="proposal">Proposal</option></select></label><label>Related record<select value={recordId} onChange={event => setRecordId(event.target.value)}><option value="">No record selected</option>{items.filter(item => ["lead", "project", "booking"].includes(item.kind)).map(item => <option key={item.id} value={item.id}>{item.title}{item.client ? ` · ${item.client}` : ""}</option>)}</select></label></div>}
        {mode === "extract" && <label>Uploaded asset<select value={assetId} onChange={event => setAssetId(event.target.value)} required><option value="">Select a file</option>{assets.map(asset => <option key={`${asset.kind}-${asset.id}`} value={asset.id}>{asset.file_name} · {asset.parent_title} ({asset.kind})</option>)}</select></label>}
        {mode === "extract" && !assets.length && <p className="ai-hint">No lead or order assets are available yet. Upload one from a lead or order first.</p>}
        {assetError && mode === "extract" && <p className="ai-error" role="alert">{assetError}</p>}
        <label>{mode === "extract" ? "Question or focus (optional)" : mode === "order" ? "Order summary" : "Request"}<textarea value={prompt} onChange={event => setPrompt(event.target.value)} required={mode !== "extract"} maxLength={mode === "order" ? 3000 : 2000} rows={mode === "order" ? 6 : 5} placeholder={prompts[mode]}/></label>
        {mode === "order" && <p className="ai-hint">Selecting Add order saves it immediately. Missing prices are saved as 0.00 and can be edited in Orders.</p>}
        {mode === "ask" && <p className="ai-hint">Answers use the latest saved records and financial totals. Check important details against the source records.</p>}
        {mode === "draft" && <p className="ai-hint">Drafts are for your review; nothing is sent to a customer.</p>}
        {mode === "extract" && <p className="ai-hint">Images, PDF, Word, spreadsheets, presentations, and text files up to 10 MB are supported.</p>}
        {error && <p className="ai-error" role="alert">{error}</p>}
        <button className="primary-button ai-submit" type="submit" disabled={busy || (mode === "extract" && !assetId)}>{busy ? "Working…" : mode === "order" ? "Add order" : mode === "ask" ? "Get answer" : mode === "draft" ? "Create draft" : "Extract details"}<Send size={16}/></button>
      </form>
    </div>
    {created && <div className="ai-result ai-created" role="status"><span className="section-number">ADDED TO ORDERS</span><h3>{created.title}</h3><p>{created.client || "Customer not specified"} · {created.service || "Service not specified"} · {created.currency} {Number(created.price).toFixed(2)} order price</p>{created.warnings?.length > 0 && <ul>{created.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}<button type="button" className="outline-button" onClick={() => onOpenOrder(created.id)}>View order <ArrowRight size={16}/></button></div>}
    {result && <div className="ai-result" role="status"><div className="ai-result-head"><span className="section-number">AI RESULT</span><button type="button" onClick={() => void copyResult()}><Copy size={15}/> Copy</button></div><div className="ai-result-text">{result}</div></div>}
  </section>;
}
