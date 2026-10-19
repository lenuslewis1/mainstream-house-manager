import { database as db } from "../../../../db/client";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { parseInvoiceLines, type InvoiceRecord } from "../../../../lib/invoice";

export const runtime = "edge";

type RawInvoice = Omit<InvoiceRecord, "line_items"> & { line_items: string };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

async function findInvoice(id: string) {
  if (!/^\d+$/.test(id)) return null;
  return db.prepare("SELECT * FROM invoices WHERE id = $1").bind(Number(id)).first<RawInvoice>();
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser("finance"))) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const invoice = await findInvoice((await params).id);
    if (!invoice) return Response.json({ error: "Invoice not found." }, { status: 404 });
    return Response.json({ invoice: { ...invoice, line_items: JSON.parse(invoice.line_items) } });
  } catch (error) {
    console.error("Unable to load invoice", error);
    return Response.json({ error: "Could not load the invoice." }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser("finance"))) return Response.json({ error: "Sign in required" }, { status: 401 });
  const id = (await params).id;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return Response.json({ error: "Invalid request." }, { status: 400 });
  const billToName = String(input.billToName ?? "").trim();
  const billToDetails = String(input.billToDetails ?? "").trim();
  const issueDate = String(input.issueDate ?? "");
  const dueDate = String(input.dueDate ?? "");
  const paymentDetails = String(input.paymentDetails ?? "").trim();
  const currency = input.currency === undefined ? undefined : String(input.currency).trim().toUpperCase();
  const lines = parseInvoiceLines(input.lineItems);
  if (!billToName || billToName.length > 160 || billToDetails.length > 1000 || !validDate(issueDate) || !validDate(dueDate) || !paymentDetails || paymentDetails.length > 1000 || !lines || (currency !== undefined && !/^[A-Z]{3}$/.test(currency))) {
    return Response.json({ error: "Check the customer, dates, items, and payment details." }, { status: 400 });
  }
  try {
    const invoice = await findInvoice(id);
    if (!invoice) return Response.json({ error: "Invoice not found." }, { status: 404 });
    if (invoice.order_id && currency !== undefined && currency !== invoice.currency) return Response.json({ error: "An order invoice must keep its order currency." }, { status: 400 });
    await db.prepare("UPDATE invoices SET bill_to_name = $1, bill_to_details = $2, issue_date = $3, due_date = $4, line_items = $5, payment_details = $6, updated_at = $7, currency = $8 WHERE id = $9")
      .bind(billToName, billToDetails, issueDate, dueDate, JSON.stringify(lines), paymentDetails, Date.now(), currency ?? invoice.currency, Number(id)).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to save invoice", error);
    return Response.json({ error: "Could not save the invoice. Please try again." }, { status: 503 });
  }
}
