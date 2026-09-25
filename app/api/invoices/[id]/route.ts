import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { parseInvoiceLines, type InvoiceRecord } from "../../../../lib/invoice";

export const runtime = "edge";

type RawInvoice = Omit<InvoiceRecord, "line_items"> & { line_items: string };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

async function findInvoice(id: string) {
  if (!/^\d+$/.test(id)) return null;
  return env.DB!.prepare("SELECT * FROM invoices WHERE id = ?").bind(Number(id)).first<RawInvoice>();
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
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
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const id = (await params).id;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return Response.json({ error: "Invalid request." }, { status: 400 });
  const billToName = String(input.billToName ?? "").trim();
  const billToDetails = String(input.billToDetails ?? "").trim();
  const issueDate = String(input.issueDate ?? "");
  const dueDate = String(input.dueDate ?? "");
  const paymentDetails = String(input.paymentDetails ?? "").trim();
  const lines = parseInvoiceLines(input.lineItems);
  if (!billToName || billToName.length > 160 || billToDetails.length > 1000 || !validDate(issueDate) || !validDate(dueDate) || !paymentDetails || paymentDetails.length > 1000 || !lines) {
    return Response.json({ error: "Check the customer, dates, items, and payment details." }, { status: 400 });
  }
  try {
    if (!(await findInvoice(id))) return Response.json({ error: "Invoice not found." }, { status: 404 });
    await env.DB!.prepare("UPDATE invoices SET bill_to_name = ?, bill_to_details = ?, issue_date = ?, due_date = ?, line_items = ?, payment_details = ?, updated_at = ? WHERE id = ?")
      .bind(billToName, billToDetails, issueDate, dueDate, JSON.stringify(lines), paymentDetails, Date.now(), Number(id)).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to save invoice", error);
    return Response.json({ error: "Could not save the invoice. Please try again." }, { status: 503 });
  }
}
