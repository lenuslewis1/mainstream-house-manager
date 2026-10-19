"use client";

import PomaaForm from "../pomaa-form";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Printer, Save, Trash2 } from "lucide-react";
import { invoiceNumber, invoiceTotal, parseInvoiceLines, type InvoiceLine, type InvoiceRecord } from "../../lib/invoice";
import { money } from "../../lib/finance";
import { AlertMessage } from "../site-alert";

type Draft = Pick<InvoiceRecord, "currency" | "issue_date" | "due_date" | "bill_to_name" | "bill_to_details" | "line_items" | "payment_details">;

function formattedDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function InvoicePaper({ invoice, draft }: { invoice: InvoiceRecord; draft: Draft }) {
  const total = invoiceTotal(draft.line_items);
  return <article className="invoice-paper" aria-label={`Invoice ${invoiceNumber(invoice)}`}>
    <h1>Invoice</h1>
    <div className="invoice-frame">
      <div className="invoice-brand">
        <img src="/mainstream-house-logo.svg" alt="Mainstream House" />
        <p># 17 Spintex Road, Accra<br/>Mobile/Whatsapp: 059-859-9616<br/>www.mainstreamhouse.com | info@mainstreamhouse.com</p>
      </div>
      <div className="invoice-parties">
        <div className="invoice-customer"><strong>Invoice To:</strong><span>{draft.bill_to_name || "Customer name"}</span><span className="invoice-multiline">{draft.bill_to_details}</span></div>
        <div className="invoice-meta"><div><strong>Invoice#:</strong><span>{invoiceNumber(invoice)}</span></div><div><strong>Date:</strong><span>{formattedDate(draft.issue_date)}</span></div><div><strong>Due Date:</strong><span>{formattedDate(draft.due_date)}</span></div></div>
      </div>
      <table className="invoice-items"><colgroup><col style={{ width: "46%" }}/><col style={{ width: "14%" }}/><col style={{ width: "20%" }}/><col style={{ width: "20%" }}/></colgroup><thead><tr><th>DESCRIPTION</th><th>QUANTITY</th><th>UNIT PRICE</th><th>AMOUNT</th></tr></thead><tbody>{draft.line_items.map((line, index) => <tr key={index}><td>{line.description}</td><td>{line.quantity}</td><td>{money(Math.round(Number(line.unitPrice || 0) * 100), draft.currency)}</td><td>{money(line.quantity * Math.round(Number(line.unitPrice || 0) * 100), draft.currency)}</td></tr>)}</tbody></table>
      <div className="invoice-bottom"><div className="invoice-payment"><strong>Payment Details:</strong><span className="invoice-multiline">{draft.payment_details}</span></div><div className="invoice-totals"><div><span>Sub Total</span><strong>{money(total, draft.currency)}</strong></div><div className="invoice-grand"><span>Grand Total</span><strong>{money(total, draft.currency)}</strong></div></div></div>
    </div>
  </article>;
}

export default function InvoiceEditor({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/invoices/${id}`, { cache: "no-store" });
      const data = await response.json() as { invoice?: InvoiceRecord; error?: string };
      if (!response.ok || !data.invoice) throw new Error(data.error || "Could not load invoice.");
      setInvoice(data.invoice);
      setDraft({ currency: data.invoice.currency, issue_date: data.invoice.issue_date, due_date: data.invoice.due_date, bill_to_name: data.invoice.bill_to_name, bill_to_details: data.invoice.bill_to_details, line_items: data.invoice.line_items, payment_details: data.invoice.payment_details });
      setSaved(Boolean(data.invoice.bill_to_name.trim() && data.invoice.payment_details.trim() && parseInvoiceLines(data.invoice.line_items)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load invoice."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  function change<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(current => current ? { ...current, [key]: value } : current); setSaved(false); }
  function lineChange(index: number, key: keyof InvoiceLine, value: string) {
    if (!draft) return;
    change("line_items", draft.line_items.map((line, current) => current === index ? { ...line, [key]: key === "quantity" ? Number(value) : value } : line));
  }
  async function save() {
    if (!draft) return false;
    if (!/^[A-Z]{3}$/.test(draft.currency) || !draft.bill_to_name.trim() || !draft.payment_details.trim() || !draft.issue_date || !draft.due_date || !parseInvoiceLines(draft.line_items)) { setError("Complete the customer, dates, line items, and payment details before saving."); return false; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billToName: draft.bill_to_name, billToDetails: draft.bill_to_details, issueDate: draft.issue_date, dueDate: draft.due_date, lineItems: draft.line_items, paymentDetails: draft.payment_details, currency: draft.currency }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save invoice.");
      setSaved(true); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save invoice."); return false; }
    finally { setSaving(false); }
  }
  async function print() { if (saved || await save()) window.print(); }
  if (!invoice || !draft) return <div className="invoice-loading"><a href="/">← Back to workspace</a><p>{error || "Loading invoice…"}</p></div>;
  return <main className="invoice-page">
    <header className="invoice-toolbar"><a href="/"><ArrowLeft size={17}/> Back to workspace</a><div><a href="/invoices">All invoices</a><span className="invoice-save-state">{saved ? "Saved" : "Unsaved changes"}</span><button type="button" disabled={saving} onClick={() => void save()}><Save size={16}/> Save</button><button type="button" disabled={saving} className="invoice-print-button" onClick={() => void print()}><Printer size={16}/> Print / Save PDF</button></div></header>
    {error && <AlertMessage message={error}/>}
    <div className="invoice-workarea">
      <section className="invoice-controls" aria-label="Invoice details"><div className="invoice-controls-heading"><span>INVOICE {invoiceNumber(invoice)}</span><h2>Edit invoice</h2><p>{invoice.order_id ? "Created from your order. Review the details, save, then print or save as PDF." : "Standalone invoice. Enter your customer and line items, save, then print or save as PDF."}</p></div>
        <PomaaForm kind="invoice" disabled={saving} context={draft} fields={{billToName: value => change("bill_to_name",value), billToDetails: value => change("bill_to_details",value), issueDate: value => change("issue_date",value), dueDate: value => change("due_date",value), paymentDetails: value => change("payment_details",value), lineItems: value => change("line_items", JSON.parse(value))}}/><label>Customer name<input value={draft.bill_to_name} onChange={event => change("bill_to_name", event.target.value)} maxLength={160}/></label>
        <label>Currency<input value={draft.currency} onChange={event => change("currency", event.target.value.toUpperCase())} maxLength={3} pattern="[A-Z]{3}" readOnly={Boolean(invoice.order_id)} aria-label="Invoice currency" placeholder="GHS"/></label><label>Billing details<textarea value={draft.bill_to_details} onChange={event => change("bill_to_details", event.target.value)} rows={3} maxLength={1000} placeholder="Address, contact person, phone or email"/></label>
        <div className="invoice-date-fields"><label>Invoice date<input type="date" value={draft.issue_date} onChange={event => change("issue_date", event.target.value)}/></label><label>Due date<input type="date" value={draft.due_date} onChange={event => change("due_date", event.target.value)}/></label></div>
        <div className="invoice-line-heading"><h3>Line items</h3><button type="button" disabled={draft.line_items.length >= 10} onClick={() => change("line_items", [...draft.line_items, { description: "", quantity: 1, unitPrice: "0" }])}><Plus size={15}/> Add item</button></div>
        {draft.line_items.map((line, index) => <div className="invoice-line-editor" key={index}><label>Description<input value={line.description} onChange={event => lineChange(index, "description", event.target.value)} maxLength={200}/></label><div><label>Qty<input type="number" min="1" max="9999" step="1" value={line.quantity} onChange={event => lineChange(index, "quantity", event.target.value)}/></label><label>Unit price ({draft.currency})<input type="number" min="0" step="0.01" value={line.unitPrice} onChange={event => lineChange(index, "unitPrice", event.target.value)}/></label><button type="button" aria-label={`Remove item ${index + 1}`} disabled={draft.line_items.length === 1} onClick={() => change("line_items", draft.line_items.filter((_, current) => current !== index))}><Trash2 size={16}/></button></div></div>)}
        <label>Payment details<textarea value={draft.payment_details} onChange={event => change("payment_details", event.target.value)} rows={4} maxLength={1000}/></label>
        <p className="invoice-editor-total">Grand total <strong>{money(invoiceTotal(draft.line_items), draft.currency)}</strong></p>
      </section>
      <div className="invoice-preview"><span>PRINT PREVIEW · A4</span><InvoicePaper invoice={invoice} draft={draft}/></div>
    </div>
  </main>;
}
