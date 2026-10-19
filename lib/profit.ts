import { cents, totals, withOrderExpenses } from "./finance";
import { inPeriod, type ReportRecord } from "./finance-reports";
export function profitReport(records:ReportRecord[],currency:string,start="",end="") {
 records=withOrderExpenses(records);
 const entries=records.filter(r=>r.kind==="finance"&&(r.currency||"GHS")===currency&&inPeriod(r,start,end));
 const cash=totals(entries);
 const costs=[{label:"Order costs & production",categories:["Order costs","Printing & production","Materials"]},{label:"Salaries",categories:["Salary"]},{label:"Allowances & staff",categories:["Allowance","Staff"]},{label:"Other expenses",categories:[]}].map((group,index)=>({...group,amount:entries.filter(r=>r.status==="Completed"&&r.direction==="Expense"&&(index===3?!["Order costs","Printing & production","Materials","Salary","Allowance","Staff"].includes(r.category||""):group.categories.includes(r.category||""))).reduce((n,r)=>n+cents(r.amount),0)}));
 const orders=records.filter(r=>["project","booking"].includes(r.kind)&&(r.currency||"GHS")===currency).map(order=>{
  const linked=entries.filter(r=>r.project_id===order.id),cash=totals(linked);
  return {order,received:cash.revenue,spent:cash.expenses,profit:cash.revenue-cash.expenses,pendingCosts:cash.pendingExpenses,margin:cash.revenue>0?(cash.revenue-cash.expenses)/cash.revenue*100:null,recordCount:linked.length};
 });
 const ids=new Set(orders.map(r=>r.order.id));
 const shared=totals(entries.filter(r=>!r.project_id||!ids.has(r.project_id)));
 return {revenue:cash.revenue,expenses:cash.expenses,profit:cash.revenue-cash.expenses,pendingCosts:cash.pendingExpenses,margin:cash.revenue>0?(cash.revenue-cash.expenses)/cash.revenue*100:null,costs,orders,sharedIncome:shared.revenue,sharedExpenses:shared.expenses};
}
