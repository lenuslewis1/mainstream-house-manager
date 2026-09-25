import { cents, validMoney } from "./finance";

export type InvoiceLine = { description: string; quantity: number; unitPrice: string };
export type InvoiceRecord = {
  id: number;
  order_id: string;
  issue_date: string;
  due_date: string;
  bill_to_name: string;
  bill_to_details: string;
  currency: string;
  line_items: InvoiceLine[];
  payment_details: string;
  created_at: number;
  updated_at: number;
};

export const defaultPaymentDetails = "MTN MOMO\nMainstream House\n0598 599 616\n030057";

export function invoiceNumber(invoice: Pick<InvoiceRecord, "id" | "created_at">): string {
  return `${new Date(invoice.created_at).getUTCFullYear()}-${String(invoice.id).padStart(5, "0")}`;
}

export function invoiceTotal(lines: InvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * cents(line.unitPrice), 0);
}

export function parseInvoiceLines(value: unknown): InvoiceLine[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) return null;
  const lines: InvoiceLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const line = item as Record<string, unknown>;
    const description = String(line.description ?? "").trim();
    const quantity = Number(line.quantity);
    const unitPrice = String(line.unitPrice ?? "").trim();
    if (!description || description.length > 200 || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999 || !validMoney(unitPrice)) return null;
    lines.push({ description, quantity, unitPrice });
  }
  return Number.isSafeInteger(invoiceTotal(lines)) ? lines : null;
}
