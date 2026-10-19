"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { invoiceNumber, invoiceTotal, parseInvoiceLines, type InvoiceRecord } from "../../lib/invoice";
import { money } from "../../lib/finance";

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/invoices", { cache: "no-store" });
      const data = await response.json() as { invoices?: InvoiceRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load invoices.");
      setInvoices(data.invoices || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load invoices."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function create() {
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { id?: number; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "Could not create invoice.");
      window.location.assign(`/invoices/${data.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create invoice."); setCreating(false); }
  }
  return <main className="invoice-page">
    <header className="invoice-toolbar"><a href="/"><ArrowLeft size={17}/> Back to workspace</a><button type="button" className="invoice-print-button" disabled={creating} onClick={() => void create()}><Plus size={16}/>{creating ? "Creating…" : "New invoice"}</button></header>
    <section className="invoice-library">
      <p className="invoice-library-eyebrow">MAINSTREAM HOUSE / BILLING</p><h1>Invoices</h1><p>Create an invoice directly, or open one created from an order.</p>
      {error && <div role="alert" className="invoice-error">{error} <button onClick={() => void load()}>Retry</button></div>}
      {loading ? <p role="status">Loading invoices…</p> : invoices.length === 0 ? <div className="invoice-library-empty"><h2>No invoices yet</h2><p>You can create your first invoice without attaching an order.</p><button className="invoice-print-button" disabled={creating} onClick={() => void create()}><Plus size={16}/> New invoice</button></div> : <>
        <div className="invoice-library-rows">{invoices.map(invoice => <a className="invoice-library-row" href={`/invoices/${invoice.id}`} key={invoice.id}>
          <div><strong>{invoice.bill_to_name || "Untitled invoice"}</strong><span>{invoiceNumber(invoice)} · {invoice.order_id ? "Order attached" : "Standalone"}{!invoice.bill_to_name || !parseInvoiceLines(invoice.line_items) ? " · Draft" : ""}</span></div>
          <div><strong>{money(invoiceTotal(invoice.line_items), invoice.currency)}</strong><span>Due {invoice.due_date}</span></div><ArrowRight size={18}/>
        </a>)}</div><p className="invoice-library-note">Showing the most recent {invoices.length} invoices, up to 200.</p>
      </>}
    </section>
  </main>;
}
