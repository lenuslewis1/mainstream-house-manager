export const validMoney = (value: string) => /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value);

export function cents(value: string | null | undefined): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function money(value: number, currency: string): string {
  return `${currency || "GHS"} ${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type FinanceRecord = { kind: string; status: string; direction: string; amount: string; currency: string; project_id?: string | null; price?: string; cost?: string };

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

export function financialSummary(records: FinanceRecord[], currency: string) {
  const inCurrency = records.filter(record => (record.currency || "GHS") === currency);
  const orders = inCurrency.filter(record => record.kind === "project" || record.kind === "booking");
  const entries = inCurrency.filter(record => record.kind === "finance");
  const general = totals(entries.filter(record => !record.project_id));
  const linkedPayments = totals(entries.filter(record => record.project_id));
  const cash = totals(entries);
  const orderRevenue = orders.reduce((sum, order) => sum + cents(order.price), 0);
  const orderExpenses = orders.reduce((sum, order) => sum + cents(order.cost), 0);
  const revenue = cash.revenue;
  const expenses = cash.expenses;
  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    orderRevenue,
    orderExpenses,
    generalIncome: general.revenue,
    generalExpenses: general.expenses,
    received: cash.revenue,
    paid: cash.expenses,
    linkedReceived: linkedPayments.revenue,
    linkedPaid: linkedPayments.expenses,
    pendingIncome: cash.pendingIncome,
    pendingExpenses: cash.pendingExpenses,
    entryCount: entries.length,
    linkedEntryCount: entries.filter(record => record.project_id).length,
  };
}
