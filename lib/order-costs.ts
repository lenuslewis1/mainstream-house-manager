import { cents, validMoney } from "./finance";
export type OrderCost = { description: string; amount: string };
export function parseOrderCosts(value: unknown): OrderCost[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const lines: OrderCost[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || typeof row.description !== "string" || !row.description.trim() || row.description.trim().length > 160 || typeof row.amount !== "string" || !validMoney(row.amount)) return null;
    lines.push({description: row.description.trim(), amount: row.amount});
  }
  return validMoney(costTotal(lines)) ? lines : null;
}
export function costTotal(lines: OrderCost[]): string { return (lines.reduce((sum, line) => sum + cents(line.amount), 0) / 100).toFixed(2); }
export function savedOrderCosts(json: string | undefined, total: string): OrderCost[] {
  try { const parsed = parseOrderCosts(JSON.parse(json || "[]")); if (parsed?.length) return parsed; } catch {}
  return cents(total) > 0 ? [{description: "Existing order cost", amount: total}] : [];
}
