"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AlertMessage } from "./site-alert";

export type FormSetters = Record<string, (value: string) => void>;
export default function PomaaForm({ kind, fields, context = {}, disabled = false, initialPrompt = "" }: { kind: string; fields: FormSetters; context?: unknown; disabled?: boolean; initialPrompt?: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function fill() {
    if (!prompt.trim()) { setError("Describe the details you want Pomaa to fill."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/ai/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, prompt, context, keys: Object.keys(fields) }) });
      const data = await response.json() as { fields?: Record<string, string>; warnings?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Pomaa could not fill this form.");
      let count = 0;
      for (const [key, value] of Object.entries(data.fields || {})) if (fields[key] && typeof value === "string") { fields[key](value); count++; }
      setNotice(`${count ? `${count} fields filled. Review the details before saving.` : "No fields could be filled. Add more details to your description."}${data.warnings?.length ? ` ${data.warnings.join(" ")}` : ""}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not fill this form."); }
    finally { setBusy(false); }
  }
  return <details className="pomaa-form" open={initialPrompt ? true : undefined}><summary><Sparkles size={16}/> Fill with Pomaa</summary><div className="pomaa-form-body"><label>Tell Pomaa what to enter<textarea rows={3} maxLength={4000} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Describe the details, amounts, dates, and people for this form…" disabled={busy || disabled}/></label><button className="outline-button" type="button" disabled={busy || disabled} onClick={() => void fill()}><Sparkles size={16}/>{busy ? "Pomaa is filling…" : "Fill form"}</button><p role="status">{notice || "Pomaa fills supplied details. Your changes are saved only when you save this form. Attach files using the file picker."}</p>{error && <AlertMessage message={error}/>}</div></details>;
}
