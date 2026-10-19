export const validMoney = (value: string) => /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value);

export function cents(value: string | null | undefined): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function money(value: number, currency: string): string {
  return `${currency || "GHS"} ${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type FinanceRecord = { kind: string; status: string; direction: string; amount: string; currency: string; project_id?: string | null; price?: string; cost?: string; id?:string; title?:string; created_at?:number; due_date?:string; auto_order_cost?:boolean };

// Order costs are expenses. Existing completed expenses linked to an order
// cover that same cost; only the uncovered amount becomes an automatic entry.
// Derived entries are rebuilt when their order is present, making this idempotent.
export function withOrderExpenses<T extends FinanceRecord>(records:T[]):T[] {
  const orders=records.filter(r=>r.kind === "project" || r.kind === "booking");
  const ids=new Set(orders.map((r,index)=>r.id || `unidentified-order-${index}`));
  const base=records.filter(r=>!r.auto_order_cost || !ids.has(r.project_id || ""));
  const automatic=orders.flatMap((order,index)=>{
    const currency=order.currency || "GHS",id=order.id || `unidentified-order-${index}`;
    const recorded=base.filter(r=>r.kind === "finance" && r.project_id === id && (r.currency || "GHS") === currency && r.direction === "Expense" && r.status === "Completed").reduce((n,r)=>n+cents(r.amount),0);
    const remaining=Math.max(0,cents(order.cost)-recorded);
    if(!remaining)return [];
    const created=order.created_at || 0;
    return [{...order,id:`order-expense:${id}`,kind:"finance",title:`Order expenses · ${order.title || "Order"}`,status:"Completed",direction:"Expense",amount:(remaining/100).toFixed(2),currency,project_id:id,price:"0",cost:"0",auto_order_cost:true,client:"",category:"Order costs",payment_method:"",reference:"",due_date:new Date(created).toISOString().slice(0,10),created_at:created,notes:"Included automatically from this order's saved costs. Existing linked expenses count toward the same total."}];
  });
  return [...base,...automatic];
}

export function totals(records: FinanceRecord[]) {
  return withOrderExpenses(records).reduce((sum, record) => {
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
  const inCurrency = withOrderExpenses(records).filter(record => (record.currency || "GHS") === currency);
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
