import { serviceGroups } from "./services";
import { validMoney } from "./finance";

export const pricingServices = serviceGroups.flatMap(group => group.items.map(name => ({
  category: group.name, name, service: `${group.name} / ${name}`, id: `base:${group.name}:${name}`,
})));
export const priceCurrencies = ["GHS", "USD", "EUR", "GBP"] as const;
export type PriceInput = { id:string; service:string; option:string; amount:string; currency:string; unit:string; mode:string; minimum:number; notes:string; version:number };
export type ServicePrice = Omit<PriceInput,"version"> & { updated_at:number };
export function parsePrice(value:unknown):PriceInput|null {
  if (!value || typeof value!=="object") return null;
  const v=value as PriceInput;
  const service=pricingServices.find(row=>row.service===v.service);
  if (!service || typeof v.id!=="string" || (v.id!==service.id && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v.id))) return null;
  for (const [key,max] of Object.entries({option:100,unit:60,notes:2000})) if (typeof v[key as keyof PriceInput]!=="string" || (v[key as keyof PriceInput] as string).length>max) return null;
  if (!priceCurrencies.includes(v.currency as typeof priceCurrencies[number]) || !["fixed","from","quote"].includes(v.mode)) return null;
  if (typeof v.amount!=="string" || (v.mode!=="quote" && !validMoney(v.amount))) return null;
  if (!Number.isSafeInteger(v.minimum) || v.minimum<1 || v.minimum>100000000 || !Number.isSafeInteger(v.version) || v.version<0) return null;
  if (!v.unit.trim() || (v.id!==service.id && !v.option.trim())) return null;
  return {...v,option:v.option.trim(),amount:v.mode==="quote"?"":v.amount,currency:v.currency,unit:v.unit.trim(),notes:v.notes.trim()};
}
