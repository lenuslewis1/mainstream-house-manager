import { cents, totals, type FinanceRecord } from "./finance";
export const financeCategories = ["Sales", "Printing & production", "Materials", "Delivery", "Design & technology", "Marketing", "Rent & utilities", "Salary", "Allowance", "Staff", "Fees", "Other"];
export const paymentMethods = ["Cash", "Mobile money", "Bank transfer", "Card", "Other"];
export type ReportRecord = FinanceRecord & { id: string; title: string; client: string; due_date: string; created_at: number; category?: string; payment_method?: string; reference?: string; vendor_id?: string | null; notes: string; service: string };
export function recordDate(record: Pick<ReportRecord, "due_date" | "created_at" | "kind">) { return record.kind === "finance" && record.due_date ? record.due_date : new Date(record.created_at).toISOString().slice(0,10); }
export function inPeriod(record: ReportRecord, start: string, end: string) { const date = recordDate(record); return (!start || date >= start) && (!end || date <= end); }
export function orderBalances(records: ReportRecord[], currency: string) {
  return records.filter(record => ["project","booking"].includes(record.kind) && (record.currency || "GHS") === currency).map(order => {
    const linked = records.filter(record => record.kind === "finance" && record.project_id === order.id && (record.currency || "GHS") === currency);
    const paid = totals(linked), price = cents(order.price), cost = cents(order.cost);
    const paymentCount = linked.filter(record => record.direction === "Income").length;
    const pendingPaymentCount = linked.filter(record => record.direction === "Income" && record.status === "Pending").length;
    return { order, price, cost, received: paid.revenue, paid: paid.expenses, balance: Math.max(0,price-paid.revenue), credit: Math.max(0,paid.revenue-price), costRemaining: Math.max(0,cost-paid.expenses), variance: cost-paid.expenses, profit: price-cost, pendingIncome: paid.pendingIncome, pendingExpenses: paid.pendingExpenses, paymentCount, pendingPaymentCount };
  });
}
export function csvText(rows: unknown[][]) { return "\uFEFF" + rows.map(row => row.map(value => { let text = String(value ?? ""); if ((/^[\s]*[=+@]/.test(text) || (/^[\s]*-/.test(text) && !/^-\d+(?:\.\d+)?$/.test(text)))) text = "'" + text; return `"${text.replaceAll('"','""')}"`; }).join(",")).join("\r\n"); }
export function parseFinanceDetails(input: Record<string, unknown>) {
  const category = String(input.category ?? ""), paymentMethod = String(input.paymentMethod ?? ""), reference = String(input.reference ?? "").trim();
  return (category && !financeCategories.includes(category)) || (paymentMethod && !paymentMethods.includes(paymentMethod)) || reference.length > 160 ? null : { category, paymentMethod, reference };
}
