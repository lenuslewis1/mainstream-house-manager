import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { taskStages, type TaskColumn } from "./kanban";
export async function rememberMember(user:ChatGPTUser) {
 await env.DB!.prepare("INSERT INTO team_members(id,name,email,last_seen) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,last_seen=excluded.last_seen").bind(user.userId,user.displayName,user.email,Date.now()).run();
}
export async function columns():Promise<TaskColumn[]> {
 await env.DB!.batch(taskStages.map((s,i)=>env.DB!.prepare("INSERT OR IGNORE INTO task_columns(id,name,position,updated_at) VALUES(?,?,?,0)").bind(s,s==="Done"?"Complete":s,i)));
 return (await env.DB!.prepare("SELECT * FROM task_columns ORDER BY position,id").all<TaskColumn>()).results;
}

export async function memberName(user:ChatGPTUser):Promise<string>{
 return (await env.DB!.prepare("SELECT CASE WHEN custom_name != '' THEN custom_name ELSE name END AS name FROM team_members WHERE id=?").bind(user.userId).first<{name:string}>())?.name||user.displayName;
}
