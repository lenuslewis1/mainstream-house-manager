import { database as db } from "../db/client";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { isSuperAdminEmail } from "./roles";
import { taskStages, type TaskColumn } from "./kanban";
export async function rememberMember(user:Omit<ChatGPTUser,"role">) {
 await db.prepare("INSERT INTO team_members(id,name,email,last_seen,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,last_seen=excluded.last_seen,role=CASE WHEN lower(excluded.email)='lenuslewis40@gmail.com' THEN 'Super admin' ELSE team_members.role END").bind(user.userId,user.displayName,user.email,Date.now(),isSuperAdminEmail(user.email) ? "Super admin" : (process.env.WORKSPACE_MANAGER_EMAILS || "lenuslewis40@gmail.com,mainstreammediahouse7@gmail.com").split(",").map(email=>email.trim().toLowerCase()).includes(user.email.toLowerCase()) ? "Manager" : "Team member").run();
}
export async function columns():Promise<TaskColumn[]> {
 await db.batch(taskStages.map((s,i)=>db.prepare("INSERT INTO task_columns(id,name,position,updated_at) VALUES($1,$2,$3,0) ON CONFLICT DO NOTHING").bind(s,s==="Done"?"Complete":s,i)));
 return (await db.prepare("SELECT * FROM task_columns ORDER BY position,id").all<TaskColumn>()).results;
}

export async function memberName(user:ChatGPTUser):Promise<string>{
 return (await db.prepare("SELECT CASE WHEN custom_name != '' THEN custom_name ELSE name END AS name FROM team_members WHERE id=$1").bind(user.userId).first<{name:string}>())?.name||user.displayName;
}
