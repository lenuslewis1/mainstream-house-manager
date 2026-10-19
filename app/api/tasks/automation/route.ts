import { database as db } from "../../../../db/client";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { autoTasks } from "../../../../lib/auto-tasks";
export const runtime="edge";
const candidates=`SELECT 'order' AS kind,w.id,w.title FROM work_items w LEFT JOIN task_generations g ON g.source_key='order:'||w.id WHERE w.kind IN ('project','booking') AND w.status NOT IN ('Delivered','Completed','Cancelled') AND g.source_key IS NULL UNION ALL SELECT 'content' AS kind,m.id,m.title FROM marketing_posts m LEFT JOIN task_generations g ON g.source_key='content:'||m.id WHERE m.status!='Published' AND g.source_key IS NULL`;
export async function GET(){
  if(!(await getChatGPTUser("finance")))return Response.json({error:"Sign in required"},{status:401});
  try{const [jobs,pending]=await Promise.all([db.prepare("SELECT source_key,source_kind,source_id,source_title,status,error,updated_at FROM task_generations WHERE status != 'Done' ORDER BY updated_at DESC LIMIT 100").all(),db.prepare(`SELECT COUNT(*) AS count FROM (${candidates})`).first<{count:number}>()]);return Response.json({jobs:jobs.results,remaining:pending?.count||0});}catch{return Response.json({error:"Could not load task generation status."},{status:503});}
}
export async function POST(request:Request){
  if(!(await getChatGPTUser("finance")))return Response.json({error:"Sign in required"},{status:401});
  const input=await request.json().catch(()=>null) as {kind?:unknown;id?:unknown;mode?:unknown}|null;
  try{
    if(input?.mode==="existing"){const sources=await db.prepare(`${candidates} LIMIT 8`).all<{kind:"order"|"content";id:string}>();const results=await Promise.all(sources.results.map(s=>autoTasks(s.kind,s.id)));return Response.json({added:results.reduce((n,r)=>n+r.added,0),failed:results.filter(r=>r.state==="Failed").length});}
    if(!input||!["order","content"].includes(String(input.kind))||typeof input.id!=="string"||!input.id)return Response.json({error:"Choose an order or content post."},{status:400});
    const result=await autoTasks(input.kind as "order"|"content",input.id);return Response.json(result,{status:result.state==="Failed"?503:200});
  }catch{return Response.json({error:"Could not generate tasks. Try again."},{status:503});}
}
