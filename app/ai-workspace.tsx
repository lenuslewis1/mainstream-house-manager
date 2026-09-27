"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ClipboardList, Copy, FileSearch, MessageCircle, Mic, MicOff, Send, Sparkles, WandSparkles } from "lucide-react";
import { AlertMessage } from "./site-alert";

type Mode = "form" | "order" | "ask" | "draft" | "extract";
type Item = { id: string; kind: string; title: string; client: string };
type Asset = { id: string; kind: "lead" | "order"; parent_id: string; parent_title: string; file_name: string; size_bytes: number };
type CreatedOrder = { id: string; title: string; client: string; service: string; dueDate: string; price: string; cost: string; currency: string; warnings: string[] };
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { results: ArrayLike<SpeechResult> };
type SpeechRecognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer };
export type PomaaFormKind = "lead" | "project" | "booking" | "task" | "finance" | "customer" | "partner";
const modes: { key: Mode; title: string; description: string; icon: typeof Sparkles }[] = [
  { key: "form", title: "Fill a form", description: "Prepare any dashboard record", icon: ClipboardList },
  { key: "order", title: "Add an order", description: "Turn a written summary into an order", icon: ClipboardList },
  { key: "ask", title: "Ask the workspace", description: "Get answers from saved records", icon: MessageCircle },
  { key: "draft", title: "Draft copy", description: "Write a message or proposal", icon: WandSparkles },
  { key: "extract", title: "Read an asset", description: "Pull details from an uploaded file", icon: FileSearch },
];
const prompts: Record<Mode, string> = {
  form: "Describe the customer, vendor, lead, order, booking, task, or finance entry you want to fill.",
  order: "Example: 200 A5 stickers for Veetas Splash, GHS 400, printing costs GHS 260, due 30 September. Use Bright Prints.",
  ask: "Example: Which orders are due this week and what is our projected profit?",
  draft: "Example: Tell the customer their order is ready and ask them to confirm delivery details.",
  extract: "Optional: What quantities, specifications, and deadlines does this file mention?",
};

export default function AIWorkspace({ items, onOrderAdded, onOpenOrder, onOpenForm }: { items: Item[]; onOrderAdded: () => void; onOpenOrder: (id: string) => void; onOpenForm: (kind: PomaaFormKind, prompt: string) => void }) {
  const [mode, setMode] = useState<Mode>("form");
  const [formKind, setFormKind] = useState<PomaaFormKind>("project");
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
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<SpeechRecognizer | null>(null);
  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSpeechAvailable(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); }
      recognitionRef.current = null;
    };
  }, []);
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
  function stopListening() { recognitionRef.current?.stop(); }
  function startListening() {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setSpeechError("Voice input is not available in this browser. You can type your request instead."); return; }
    setSpeechError("");
    const recognition = new Recognition();
    const existing = prompt.trim();
    recognition.lang = navigator.language || "en-GH";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = event => {
      if (recognitionRef.current !== recognition) return;
      const spoken = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").trim();
      setPrompt([existing, spoken].filter(Boolean).join(" ").slice(0, mode === "order" ? 3000 : 2000));
    };
    recognition.onerror = event => {
      if (event.error !== "aborted") setSpeechError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone access was denied. Allow it in your browser settings to use voice input." : event.error === "no-speech" ? "No speech was heard. Try again or type your request." : "Voice input stopped. Please try again or type your request.");
    };
    recognition.onend = () => { if (recognitionRef.current === recognition) recognitionRef.current = null; setListening(false); };
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); }
    catch { recognitionRef.current = null; setListening(false); setSpeechError("Could not start voice input. Please try again or type your request."); }
  }
  function selectMode(next: Mode) { recognitionRef.current?.abort(); setListening(false); setSpeechError(""); setMode(next); setResult(""); setCreated(null); setError(""); setPrompt(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); recognitionRef.current?.abort(); setListening(false); if (mode === "form") { onOpenForm(formKind, prompt); return; } setListening(false); setBusy(true); setError(""); setResult(""); setCreated(null);
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
  return <section className="ai-workspace" aria-label="Pomaa AI assistant">
    <div className="ai-heading"><span className="section-number"><Sparkles size={14}/> MAINSTREAM HOUSE AI</span><h2>Meet Pomaa</h2><p>Your AI assistant for dashboard forms, answers, drafts, and attached files.</p></div>
    <div className="ai-mode-grid" role="tablist" aria-label="AI actions">{modes.map(option => <button key={option.key} type="button" role="tab" aria-selected={mode === option.key} className={mode === option.key ? "ai-mode active" : "ai-mode"} onClick={() => selectMode(option.key)}><option.icon size={20}/><strong>{option.title}</strong><span>{option.description}</span></button>)}</div>
    <div className="ai-form-card"><div className="ai-form-heading"><div><span className="section-number">{modes.find(option => option.key === mode)?.title.toUpperCase()}</span><h3>{mode === "form" ? "Describe the entry" : mode === "order" ? "Describe the order" : mode === "ask" ? "Ask a question" : mode === "draft" ? "Tell us what to write" : "Choose a file"}</h3></div><Sparkles size={24}/></div>
      <form onSubmit={event => void submit(event)}>{mode === "form" && <label>Form<select value={formKind} onChange={event => setFormKind(event.target.value as PomaaFormKind)}><option value="project">Order</option><option value="lead">Lead</option><option value="booking">Booking</option><option value="task">Task</option><option value="finance">Finance entry</option><option value="customer">Customer</option><option value="partner">Vendor</option></select></label>}
        {mode === "draft" && <div className="ai-fields"><label>Format<select value={draftType} onChange={event => setDraftType(event.target.value)}><option value="customer_message">Customer message</option><option value="proposal">Proposal</option></select></label><label>Related record<select value={recordId} onChange={event => setRecordId(event.target.value)}><option value="">No record selected</option>{items.filter(item => ["lead", "project", "booking"].includes(item.kind)).map(item => <option key={item.id} value={item.id}>{item.title}{item.client ? ` · ${item.client}` : ""}</option>)}</select></label></div>}
        {mode === "extract" && <label>Uploaded asset<select value={assetId} onChange={event => setAssetId(event.target.value)} required><option value="">Select a file</option>{assets.map(asset => <option key={`${asset.kind}-${asset.id}`} value={asset.id}>{asset.file_name} · {asset.parent_title} ({asset.kind})</option>)}</select></label>}
        {mode === "extract" && !assets.length && <p className="ai-hint">No lead or order assets are available yet. Upload one from a lead or order first.</p>}
        {assetError && mode === "extract" && <AlertMessage message={assetError}/>}
        <label>{mode === "extract" ? "Question or focus (optional)" : mode === "order" ? "Order summary" : "Request"}<textarea value={prompt} onChange={event => setPrompt(event.target.value)} required={mode !== "extract"} maxLength={mode === "order" ? 3000 : 2000} rows={mode === "order" ? 6 : 5} placeholder={prompts[mode]}/></label>
        <div className="ai-voice-row"><button type="button" className={listening ? "ai-voice-button listening" : "ai-voice-button"} onClick={listening ? stopListening : startListening} disabled={busy || !speechAvailable} aria-pressed={listening} aria-label={listening ? "Stop voice input" : "Start voice input"}>{listening ? <MicOff size={17}/> : <Mic size={17}/>} {listening ? "Stop listening" : "Use voice input"}</button><span role="status">{listening ? "Listening… Speak now. Your words will appear above." : speechAvailable ? "Pomaa will add your words above for review." : "Voice input is unavailable in this browser."}</span></div>
        {speechError && <AlertMessage message={speechError}/>}
        {mode === "form" && <p className="ai-hint">Open the form, then select Fill form to let Pomaa enter your details. Deliverables and invoice editors also have Fill with Pomaa.</p>}{mode === "order" && <p className="ai-hint">Selecting Add order saves it immediately. Missing prices are saved as 0.00 and can be edited in Orders.</p>}
        {mode === "ask" && <p className="ai-hint">Answers use the latest saved records and financial totals. Check important details against the source records.</p>}
        {mode === "draft" && <p className="ai-hint">Drafts are for your review; nothing is sent to a customer.</p>}
        {mode === "extract" && <p className="ai-hint">Images, PDF, Word, spreadsheets, presentations, and text files up to 10 MB are supported.</p>}
        {error && <AlertMessage message={error}/>}
        <button className="primary-button ai-submit" type="submit" disabled={busy || (mode === "extract" && !assetId)}>{busy ? "Working…" : mode === "form" ? "Open form" : mode === "order" ? "Add order" : mode === "ask" ? "Get answer" : mode === "draft" ? "Create draft" : "Extract details"}<Send size={16}/></button>
      </form>
    </div>
    {created && <div className="ai-result ai-created" role="status"><span className="section-number">ADDED TO ORDERS</span><h3>{created.title}</h3><p>{created.client || "Customer not specified"} · {created.service || "Service not specified"} · {created.currency} {Number(created.price).toFixed(2)} order price</p>{created.warnings?.length > 0 && <ul>{created.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}<button type="button" className="outline-button" onClick={() => onOpenOrder(created.id)}>View order <ArrowRight size={16}/></button></div>}
    {result && <div className="ai-result" role="status"><div className="ai-result-head"><span className="section-number">AI RESULT</span><button type="button" onClick={() => void copyResult()}><Copy size={15}/> Copy</button></div><div className="ai-result-text">{result}</div></div>}
  </section>;
}
