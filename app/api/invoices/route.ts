import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { defaultPaymentDetails } from "../../../lib/invoice";

export const runtime = "edge";

type Order = { title: string; client: string; price: string; currency: string };
type Customer = { contact_person: string; phone: string; email: string; location: string };

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as { orderId?: unknown } | null;
  const orderId = typeof input?.orderId === "string" ? input.orderId.trim() : "";
  if (!orderId) return Response.json({ error: "Choose an order." }, { status: 400 });
  try {
    const order = await env.DB!.prepare("SELECT title, client, price, currency FROM work_items WHERE id = ? AND kind IN ('project', 'booking')").bind(orderId).first<Order>();
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    const customer = order.client ? await env.DB!.prepare("SELECT contact_person, phone, email, location FROM contacts WHERE kind = 'customer' AND TRIM(name) = ? COLLATE NOCASE LIMIT 1").bind(order.client).first<Customer>() : null;
    const billToDetails = customer ? [customer.contact_person, customer.location, customer.phone, customer.email].filter(Boolean).join("\n") : "";
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    await env.DB!.prepare("INSERT OR IGNORE INTO invoices (order_id, issue_date, due_date, bill_to_name, bill_to_details, currency, line_items, payment_details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(orderId, today, today, order.client, billToDetails, order.currency || "GHS", JSON.stringify([{ description: order.title, quantity: 1, unitPrice: order.price || "0" }]), defaultPaymentDetails, now, now).run();
    const invoice = await env.DB!.prepare("SELECT id FROM invoices WHERE order_id = ?").bind(orderId).first<{ id: number }>();
    return Response.json({ id: invoice?.id });
  } catch (error) {
    console.error("Unable to create invoice", error);
    return Response.json({ error: "Could not create the invoice. Please try again." }, { status: 503 });
  }
}
