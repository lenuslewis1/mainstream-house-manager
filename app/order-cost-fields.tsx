"use client";

import { Plus, Trash2 } from "lucide-react";

import { costTotal, type OrderCost } from "../lib/order-costs";

import { cents, money } from "../lib/finance";

export default function OrderCostFields({lines, onChange, currency}: {lines: OrderCost[]; onChange: (lines: OrderCost[]) => void; currency: string}) {

  return <section className="order-cost-fields"><div className="finance-heading"><h3>Order expenses</h3><button type="button" className="outline-button" disabled={lines.length >= 100} onClick={() => onChange([...lines,{description:"",amount:"0"}])}><Plus size={16}/> Add cost</button></div>

    {lines.length ? lines.map((line,index) => <div className="order-cost-row" key={index}><label>Description<input required maxLength={160} value={line.description} placeholder="Printing, materials, delivery…" onChange={e => onChange(lines.map((row,i) => i === index ? {...row,description:e.target.value} : row))}/></label><label>Amount<input required type="number" min="0" step="0.01" value={line.amount} onChange={e => onChange(lines.map((row,i) => i === index ? {...row,amount:e.target.value} : row))}/></label><button type="button" className="icon-button" aria-label={`Remove cost ${index + 1}`} onClick={() => onChange(lines.filter((_,i) => i !== index))}><Trash2 size={16}/></button></div>) : <p className="finance-pending">No costs added.</p>}

    <p className="finance-pending">Saved order costs automatically count as expenses and reduce profit. Existing completed expenses linked to this order count toward the same total.</p><div className="order-cost-total"><span>Total order expenses</span><strong>{money(cents(costTotal(lines)),currency)}</strong></div>

  </section>;

}

