"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, Pencil, X, Tag, RefreshCw } from "lucide-react";
import { can, type TeamRole } from "../lib/roles";
import { serviceGroups } from "../lib/services";
import { pricingServices, priceCurrencies, type PriceInput, type ServicePrice } from "../lib/pricing";
import { cents, money } from "../lib/finance";
import { useSiteConfirm } from "./site-alert";
import "./pricing-workspace.css";

export default function PricingWorkspace({role}:{role:TeamRole}) {
  const editable=can(role,"finance"),confirm=useSiteConfirm();
  const [prices,setPrices]=useState<ServicePrice[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [query,setQuery]=useState(""),[category,setCategory]=useState(""),[notice,setNotice]=useState("");
  const [draft,setDraft]=useState<PriceInput|null>(null),[busy,setBusy]=useState(false),[formError,setFormError]=useState("");
  const dialog=useRef<HTMLDialogElement>(null);
  const reload=useCallback(async()=>{
    try { const response=await fetch("/api/pricing",{cache:"no-store"});const data=await response.json() as {prices:ServicePrice[];error?:string};if(!response.ok)throw new Error(data.error||"Could not load prices.");setPrices(data.prices);setError(""); }
    catch(e){setError(e instanceof Error?e.message:"Could not load prices.");}finally{setLoading(false);}
  },[]);
  useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)void reload();});return()=>{active=false;};},[reload]);
  useEffect(()=>{if(draft)dialog.current?.showModal();else dialog.current?.close();},[draft]);
  function edit(service:string,price?:ServicePrice,extra=false){
    const base=pricingServices.find(row=>row.service===service)!;
    setFormError("");setDraft(price?{...price,version:price.updated_at}:{id:extra?crypto.randomUUID():base.id,service,option:"",amount:"",currency:"GHS",unit:"per project",mode:"fixed",minimum:1,notes:"",version:0});
  }
  async function save(event:React.FormEvent){
    event.preventDefault();if(!draft)return;setBusy(true);setFormError("");setNotice("");
    try {const response=await fetch("/api/pricing",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Could not save this change.");setDraft(null);await reload();setNotice("Price saved for the team.");}
    catch(e){setFormError(e instanceof Error?e.message:"Could not save the price.");}finally{setBusy(false);}
  }
  async function remove(price:ServicePrice){
    const base=price.id.startsWith("base:");
    if(!await confirm({title:base?"Reset this rate?":"Delete this price option?",message:base?"This service will stay in the list with its price marked Not set.":`Remove “${price.option}” from the price list?`,confirmLabel:base?"Reset rate":"Delete option",tone:"danger"}))return;
    setBusy(true);setNotice("");try {const response=await fetch("/api/pricing",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:price.id,version:price.updated_at})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Could not save this change.");await reload();setNotice(base?"Rate reset.":"Price option removed.");}catch(e){setError(e instanceof Error?e.message:"Could not remove price.");}finally{setBusy(false);}
  }
  const services=pricingServices.filter(row=>(!category||row.category===category)&&(!query||[row.service,...prices.filter(p=>p.service===row.service).map(p=>`${p.option} ${p.notes} ${p.unit}`)].join(" ").toLowerCase().includes(query.toLowerCase())));
  const configured=new Set(prices.map(p=>p.service)).size;
  return <section className="pricing-workspace" aria-label="Service pricing">
    <div className="pricing-summary"><div><Tag size={20}/><strong>{pricingServices.length}</strong><span>services</span></div><div><strong>{configured}</strong><span>with saved rates</span></div><div><strong>{pricingServices.length-configured}</strong><span>need pricing</span></div></div>
    <div className="pricing-toolbar"><label className="search"><Search size={17}/><input aria-label="Search services and prices" placeholder="Search services, options…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Pricing category" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{serviceGroups.map(group=><option key={group.name}>{group.name}</option>)}</select><button className="outline-button" onClick={()=>void reload()} disabled={busy} aria-label="Refresh prices"><RefreshCw size={16}/></button></div>
    <p className="pricing-hint">{editable?"Set your standard rates, then add options for quantities, sizes, materials, or packages. Prices here do not change existing orders or invoices.":"Your team’s service price list. Ask a manager to update rates."}</p>
    {notice&&<p role="status" className="pricing-notice">{notice}</p>}
    {error&&<p role="alert" className="pricing-error">{error} <button className="outline-button" onClick={()=>void reload()}>Retry</button></p>}
    {loading?<p role="status">Loading service prices…</p>:error?null:services.length?serviceGroups.filter(group=>services.some(row=>row.category===group.name)).map(group=><section key={group.name} className="pricing-category"><header><span className="section-number">SERVICE CATEGORY</span><h2>{group.name}</h2></header><div className="pricing-service-list">{services.filter(row=>row.category===group.name).map(service=>{
      const saved=prices.filter(p=>p.service===service.service);const base=saved.find(p=>p.id===service.id);
      const rows:(ServicePrice|null)[]=[base||null,...saved.filter(p=>p.id!==service.id)];
      return <article key={service.id} className="pricing-service"><div className="pricing-service-head"><h3>{service.name}</h3>{editable&&<button className="outline-button" disabled={busy} onClick={()=>edit(service.service,undefined,true)}><Plus size={14}/>Add option<span className="sr-only"> for {service.name}</span></button>}</div>{rows.map((price,index)=><div className="pricing-rate" key={price?.id||"base"}><div className="pricing-rate-description"><strong>{price?.option||"Standard rate"}</strong><span>{price?.unit||"Set a unit"}{price&&price.minimum>1?` · Minimum ${price.minimum}`:""}</span>{price?.notes&&<p>{price.notes}</p>}</div><div className={`pricing-amount ${!price?"pricing-unset":""}`}>{!price?"Not set":price.mode==="quote"?"Custom quote":<>{price.mode==="from"&&<small>From </small>}{money(cents(price.amount),price.currency)}</>}</div>{editable&&<div className="pricing-rate-actions"><button className="outline-button" disabled={busy} aria-label={`${price?"Edit":"Set"} ${service.name} ${price?.option||"standard rate"}`} onClick={()=>edit(service.service,price||undefined)}><Pencil size={14}/>{price?"Edit":"Set price"}</button>{price&&<button className="icon-button" disabled={busy} aria-label={`${index===0?"Reset":"Delete"} ${service.name} ${price.option||"standard rate"}`} onClick={()=>void remove(price)}><X size={16}/></button>}</div>}</div>)}</article>;
    })}</div></section>):<p className="empty">No services match your search.</p>}
    <dialog ref={dialog} className="pricing-dialog" aria-labelledby="pricing-dialog-title" onCancel={e=>{e.preventDefault();if(!busy)setDraft(null);}}>{draft&&<><header><div><span className="section-number">SERVICE PRICE</span><h2 id="pricing-dialog-title">{draft.version?"Edit rate":"Set a rate"}</h2><p>{draft.service}</p></div><button className="icon-button" aria-label="Close price editor" disabled={busy} onClick={()=>setDraft(null)}><X size={20}/></button></header><form onSubmit={save}><fieldset disabled={busy}><label>Option / package<input autoFocus required={!draft.id.startsWith("base:")} maxLength={100} placeholder={draft.id.startsWith("base:")?"Standard rate":"e.g. 500 pieces · full colour"} value={draft.option} onChange={e=>setDraft({...draft,option:e.target.value})}/></label><div className="pricing-fields"><label>Price type<select value={draft.mode} onChange={e=>setDraft({...draft,mode:e.target.value})}><option value="fixed">Fixed price</option><option value="from">Starting from</option><option value="quote">Custom quote</option></select></label><label>Currency<select value={draft.currency} onChange={e=>setDraft({...draft,currency:e.target.value})}>{priceCurrencies.map(currency=><option key={currency}>{currency}</option>)}</select></label>{draft.mode!=="quote"&&<label>Price<input required type="number" min="0" max="999999999999.99" step="0.01" value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})}/></label>}<label>Unit<input required maxLength={60} placeholder="per item, per month, per project…" value={draft.unit} onChange={e=>setDraft({...draft,unit:e.target.value})}/></label><label>Minimum quantity<input required type="number" min="1" max="100000000" step="1" value={draft.minimum} onChange={e=>setDraft({...draft,minimum:Number(e.target.value)})}/></label></div><label>Notes / inclusions<textarea rows={3} maxLength={2000} placeholder="What is included? Add quantity breaks, exclusions, tax or delivery terms." value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>{formError&&<p role="alert" className="pricing-error">{formError}</p>}<div className="pricing-form-actions"><button type="button" className="outline-button" onClick={()=>setDraft(null)}>Cancel</button><button className="primary-button" type="submit">{busy?"Saving…":"Save price"}</button></div></fieldset></form></>}</dialog>
  </section>;
}
