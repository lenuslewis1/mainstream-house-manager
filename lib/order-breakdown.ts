export type OrderBreakdown = { description: string; dimensions: string; quantity: number };
export function parseOrderBreakdown(value: unknown): OrderBreakdown[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const result: OrderBreakdown[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const { description, dimensions, quantity } = row as Record<string, unknown>;
    if (typeof description !== "string" || !description.trim() || description.trim().length > 120 || typeof dimensions !== "string" || dimensions.trim().length > 100 || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) return null;
    result.push({ description: description.trim(), dimensions: dimensions.trim(), quantity });
  }
  return result;
}
export function savedBreakdown(value?: string): OrderBreakdown[] {
  try { return parseOrderBreakdown(JSON.parse(value || "[]")) || []; } catch { return []; }
}
