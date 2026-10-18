import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { parseTask, describeTaskChange, type Task } from "../../../../lib/kanban";
import { columns, rememberMember, memberName } from "../../../../lib/team";
export const runtime="edge";
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});
 try {await rememberMember(user);const id=new URL(request.url).searchParams.get("id");
 if(id)return Response.json({updates:(await env.DB!.prepare("SELECT * FROM task_updates WHERE task_id=? ORDER BY created_at DESC,id DESC LIMIT 200").bind(id).all()).results});
 return Response.json({tasks:(await env.DB!.prepare("SELECT * FROM work_items WHERE kind='task' ORDER BY updated_at DESC").all()).results,me:user.userId,meEmail:user.email,columns:await columns(),members:(await env.DB!.prepare("SELECT id,CASE WHEN custom_name != '' THEN custom_name ELSE name END AS name,email FROM team_members ORDER BY name").all()).results});
 }catch{return Response.json({error:"Could not load the board. Please retry."},{status:503});}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});
 const input=await request.json().catch(()=>null) as Record<string,unknown>|null;const task=parseTask(input,(await columns()).map(c=>c.id));if(!task)return Response.json({error:"Check the task fields."},{status:400});
 const assigned=await resolveAssignee(task);if(!assigned)return Response.json({error:"Choose a signed-in team member."},{status:400});
 const id=crypto.randomUUID(),now=Date.now();
 try {await env.DB!.batch([
 env.DB!.prepare("INSERT INTO work_items(id,kind,title,status,notes,due_date,task_assignee,task_priority,task_checklist,task_labels,task_assignee_id,task_reference_url,task_reference_date,created_at,updated_at) VALUES(?,'task',?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,task.title,task.status,task.notes,task.dueDate,task.assignee,task.priority,JSON.stringify(task.checklist),task.labels,task.assigneeId,task.referenceUrl,task.referenceDate,now,now),
 env.DB!.prepare("INSERT INTO task_updates(id,task_id,author,body,kind,created_at) VALUES(?,?,?,?,'activity',?)").bind(crypto.randomUUID(),id,await memberName(user),`Created task${task.assignee?` · Assigned to ${task.assignee}`:""}`,now)
 ]);return Response.json({id},{status:201});}catch{return Response.json({error:"Could not save task."},{status:503});}
}
export async function PATCH(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});
 const input=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!input || typeof input.id!=="string")return Response.json({error:"Choose a task."},{status:400});
 try {
 const old=await env.DB!.prepare("SELECT * FROM work_items WHERE id=? AND kind='task'").bind(input.id).first<Task>();if(!old)return Response.json({error:"Task no longer exists."},{status:404});
 if(input.comment!==undefined){if(typeof input.comment!=="string" || !input.comment.trim() || input.comment.length>4000)return Response.json({error:"Write an update of 1–4,000 characters."},{status:400});
 await env.DB!.prepare("INSERT INTO task_updates(id,task_id,author,body,kind,created_at) VALUES(?,?,?,?,'comment',?)").bind(crypto.randomUUID(),input.id,await memberName(user),input.comment.trim(),Date.now()).run();return Response.json({ok:true});}
 const task=parseTask(input,(await columns()).map(c=>c.id));if(!task || (typeof input.version!=="number" || !Number.isSafeInteger(input.version)))return Response.json({error:"Check the task fields."},{status:400});
 if(input.version!==old.updated_at)return Response.json({error:"This task changed since you opened it. Close and reopen it to load the latest version."},{status:409});
 const assigned=await resolveAssignee(task,old);if(!assigned)return Response.json({error:"Choose a signed-in team member."},{status:400});
 const boardColumns=await columns();const columnName=(id:string)=>boardColumns.find(c=>c.id===id)?.name||id;
 const activity=describeTaskChange(old,task).replace(`Moved from ${old.status} to ${task.status}`,`Moved from ${columnName(old.status)} to ${columnName(task.status)}`);
 const now=Math.max(Date.now(),old.updated_at+1);
 const results=await env.DB!.batch([
 env.DB!.prepare("UPDATE work_items SET title=?,status=?,notes=?,due_date=?,task_assignee=?,task_priority=?,task_checklist=?,task_labels=?,task_assignee_id=?,task_reference_url=?,task_reference_date=?,updated_at=? WHERE id=? AND kind='task' AND updated_at=?").bind(task.title,task.status,task.notes,task.dueDate,task.assignee,task.priority,JSON.stringify(task.checklist),task.labels,task.assigneeId,task.referenceUrl,task.referenceDate,now,input.id,input.version),
 env.DB!.prepare("INSERT INTO task_updates(id,task_id,author,body,kind,created_at) SELECT ?,?,?,?,'activity',? WHERE changes()>0").bind(crypto.randomUUID(),input.id,await memberName(user),activity,now)
 ]);if(!results[0].meta.changes)return Response.json({error:"Someone updated this task. Refresh and retry."},{status:409});return Response.json({ok:true});
 }catch{return Response.json({error:"Could not save the update. Please retry."},{status:503});}
}

async function resolveAssignee(task:NonNullable<ReturnType<typeof parseTask>>,old?:Task){
 if(task.assigneeId){
 const member=await env.DB!.prepare("SELECT CASE WHEN custom_name != '' THEN custom_name ELSE name END AS name FROM team_members WHERE id=?").bind(task.assigneeId).first<{name:string}>();
 if(!member)return false;task.assignee=member.name;return true;
 }
 // Keep an existing legacy assignee until explicitly reassigned; new assignments use stable user IDs.
 if(task.assignee&&task.assignee!==old?.task_assignee)return false;
 return true;
}
