import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { columns } from "../../../../lib/team";
export const runtime="edge";
export async function POST(request:Request){return save(request,false);}
export async function PATCH(request:Request){return save(request,true);}
async function save(request:Request,rename:boolean){
 if(!await getChatGPTUser())return Response.json({error:"Sign in required"},{status:401});
 const v=await request.json().catch(()=>null) as Record<string,unknown>|null;
 if(!v||typeof v.name!=="string"||!v.name.trim()||v.name.trim().length>40)return Response.json({error:"Use a column name of 1–40 characters."},{status:400});
 try{
 const all=await columns();const name=v.name.trim();
 if(all.some(c=>c.id!==v.id&&c.name.toLowerCase()===name.toLowerCase()))return Response.json({error:"A column already uses that name."},{status:409});
 if(rename){
 if(typeof v.id!=="string"||typeof v.version!=="number")return Response.json({error:"Choose a column."},{status:400});
 const old=all.find(c=>c.id===v.id);if(!old)return Response.json({error:"Column not found."},{status:404});
 const r=await env.DB!.prepare("UPDATE task_columns SET name=?,updated_at=? WHERE id=? AND updated_at=?").bind(name,Math.max(Date.now(),old.updated_at+1),v.id,v.version).run();
 if(!r.meta.changes)return Response.json({error:"This column changed. Refresh and try again."},{status:409});
 }else{
 if(all.length>=30)return Response.json({error:"The board can hold up to 30 columns."},{status:400});
 await env.DB!.prepare("INSERT INTO task_columns(id,name,position,updated_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(),name,Math.max(...all.map(c=>c.position))+1,Date.now()).run();
 }
 return Response.json({ok:true});
 }catch{return Response.json({error:"Could not save column. Please retry."},{status:503});}
}
