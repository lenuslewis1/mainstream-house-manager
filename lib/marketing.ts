import { serviceGroups } from "./services";
export const marketingServices = serviceGroups.flatMap(g => g.items.map(s => `${g.name} / ${s}`));
export const channels = ["Instagram", "Facebook", "TikTok", "LinkedIn", "WhatsApp", "Email"];
export const formats = ["Image", "Carousel", "Short video", "Story", "Text", "Email"];
export const postStatuses = ["Draft", "Ready", "Published"];
export type MarketingPost = { id?: string; title: string; service: string; date: string; channel: string; format: string; caption: string; brief: string; campaign: string; status: string };
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function parseMarketingPost(value: unknown): MarketingPost | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const limits: Record<string,number> = {title:160,service:160,caption:6000,brief:3000,campaign:160};
  for (const [key,max] of Object.entries(limits)) if (typeof row[key] !== "string" || (row[key] as string).length > max) return null;
  if (!(row.title as string).trim() || !validDate(row.date) || !channels.includes(String(row.channel)) || !formats.includes(String(row.format)) || !postStatuses.includes(String(row.status)) || (row.service && !marketingServices.includes(String(row.service)))) return null;
  return Object.fromEntries(["title","service","date","channel","format","caption","brief","campaign","status"].map(key=>[key,String(row[key]).trim()])) as MarketingPost;
}
export function calendarDays(month: string): string[] {
  const first = new Date(`${month}-01T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay()+6)%7);
  return Array.from({length:42},(_,i)=>{const day=new Date(first);day.setUTCDate(day.getUTCDate()+i);return day.toISOString().slice(0,10);});
}
