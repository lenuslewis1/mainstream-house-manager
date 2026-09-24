export const validMoney = (value: string) => /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value);

export function cents(value: string | null | undefined): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function money(value: number, currency: string): string {
  return `${currency || "GHS"} ${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type FinanceRecord = { kind: string; status: string; direction: string; amount: string; currency: string; project_id: string | null };

export function totals(records: FinanceRecord[]) {
  return records.reduce((sum, record) => {
    if (record.kind !== "finance") return sum;
    const amount = cents(record.amount);
    if (record.status === "Completed") {
      if (record.direction === "Income") sum.revenue += amount;
      if (record.direction === "Expense") sum.expenses += amount;
    } else if (record.status === "Pending") {
      if (record.direction === "Income") sum.pendingIncome += amount;
      if (record.direction === "Expense") sum.pendingExpenses += amount;
    }
    return sum;
  }, { revenue: 0, expenses: 0, pendingIncome: 0, pendingExpenses: 0 });
}
