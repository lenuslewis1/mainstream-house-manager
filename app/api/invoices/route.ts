import { database as db } from "../../../db/client";
import { getChatGPTUser } from "../../chatgpt-auth";
import { defaultPaymentDetails, type InvoiceRecord } from "../../../lib/invoice";

export const runtime = "edge";

type Order = { title: string; client: string; price: string; currency: string };
type Customer = { contact_person: string; phone: string; email: string; location: string };

export async function GET() {
  if (!(await getChatGPTUser("finance"))) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const data = await db.prepare("SELECT * FROM invoices ORDER BY updated_at DESC, id DESC LIMIT 200").all<Omit<InvoiceRecord, "line_items"> & { line_items: string }>();
    return Response.json({ invoices: data.results.map(invoice => ({ ...invoice, line_items: JSON.parse(invoice.line_items) })) });
  } catch (error) {
    console.error("Unable to list invoices", error);
    return Response.json({ error: "Could not load invoices. Please retry." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await getChatGPTUser("finance"))) return Response.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as { orderId?: unknown } | null;
  if (!input || typeof input !== "object" || Array.isArray(input) || (input.orderId != null && typeof input.orderId !== "string")) {
    return Response.json({ error: "Invalid invoice request." }, { status: 400 });
  }
  const orderId = typeof input?.orderId === "string" ? input.orderId.trim() : "";
  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    if (!orderId) {
      const invoice = await db.prepare("INSERT INTO invoices (order_id, issue_date, due_date, bill_to_name, bill_to_details, currency, line_items, payment_details, created_at, updated_at) VALUES (NULL, $1, $1, '', '', 'GHS', $2, $3, $4, $4) RETURNING id")
        .bind(today, JSON.stringify([{ description: "", quantity: 1, unitPrice: "0" }]), defaultPaymentDetails, now).first<{ id: number }>();
      return Response.json({ id: invoice!.id }, { status: 201 });
    }
    const order = await db.prepare("SELECT title, client, price, currency FROM work_items WHERE id = $1 AND kind IN ('project', 'booking')").bind(orderId).first<Order>();
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    const customer = order.client ? await db.prepare("SELECT contact_person, phone, email, location FROM contacts WHERE kind = 'customer' AND LOWER(TRIM(name)) = LOWER($1) LIMIT 1").bind(order.client).first<Customer>() : null;
    const billToDetails = customer ? [customer.contact_person, customer.location, customer.phone, customer.email].filter(Boolean).join("\n") : "";
    await db.prepare("INSERT INTO invoices (order_id, issue_date, due_date, bill_to_name, bill_to_details, currency, line_items, payment_details, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING")
      .bind(orderId, today, today, order.client, billToDetails, order.currency || "GHS", JSON.stringify([{ description: order.title, quantity: 1, unitPrice: order.price || "0" }]), defaultPaymentDetails, now, now).run();
    const invoice = await db.prepare("SELECT id FROM invoices WHERE order_id = $1").bind(orderId).first<{ id: number }>();
    return Response.json({ id: invoice?.id });
  } catch (error) {
    console.error("Unable to create invoice", error);
    return Response.json({ error: "Could not create the invoice. Please try again." }, { status: 503 });
  }
}
