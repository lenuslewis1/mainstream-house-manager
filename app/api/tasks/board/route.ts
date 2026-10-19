import { database as db } from "../../../../db/client";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { parseTask, describeTaskChange, taskInput, type Task } from "../../../../lib/kanban";
import { columns, rememberMember, memberName } from "../../../../lib/team";
export const runtime="edge";
export async function GET(request:Request){
 const user=await getChatGPTUser("workspace");if(!user)return Response.json({error:"Sign in required"},{status:401});
 try {await rememberMember(user);const id=new URL(request.url).searchParams.get("id");
 if(id && user.role === "Intern" && !(await db.prepare("SELECT id FROM work_items WHERE id=$1 AND kind='task' AND task_assignee_id=$2").bind(id,user.userId).first())) return Response.json({error:"Task not found."},{status:404});
 if(id)return Response.json({updates:(await db.prepare("SELECT * FROM task_updates WHERE task_id=$1 AND ($2 != 'Intern' OR EXISTS (SELECT 1 FROM work_items WHERE id=$1 AND task_assignee_id=$3)) ORDER BY created_at DESC,id DESC LIMIT 200").bind(id,user.role,user.userId).all()).results});
 return Response.json({tasks:(await db.prepare("SELECT * FROM work_items WHERE kind='task' AND ($1 != 'Intern' OR task_assignee_id=$2) ORDER BY updated_at DESC").bind(user.role,user.userId).all()).results,me:user.userId,meEmail:user.email,role:user.role,columns:await columns(),members:(await db.prepare("SELECT id,CASE WHEN custom_name != '' THEN custom_name ELSE name END AS name,email,role FROM team_members WHERE ($1 != 'Intern' OR id=$2) ORDER BY name").bind(user.role,user.userId).all()).results});
 }catch{return Response.json({error:"Could not load the board. Please retry."},{status:503});}
}
export async function POST(request:Request){
 const user=await getChatGPTUser("workspace");if(!user)return Response.json({error:"Sign in required"},{status:401});
 if(user.role === "Intern") return Response.json({error:"Only managers and team members can create tasks."},{status:403});
 const input=await request.json().catch(()=>null) as Record<string,unknown>|null;const task=parseTask(input,(await columns()).map(c=>c.id));if(!task)return Response.json({error:"Check the task fields."},{status:400});
 const assigned=await resolveAssignee(task);if(!assigned)return Response.json({error:"Choose a signed-in team member."},{status:400});
 const id=crypto.randomUUID(),now=Date.now();
 try {await db.batch([
 db.prepare("INSERT INTO work_items(id,kind,title,status,notes,due_date,task_assignee,task_priority,task_checklist,task_labels,task_assignee_id,task_reference_url,task_reference_date,created_at,updated_at) VALUES($1,'task',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)").bind(id,task.title,task.status,task.notes,task.dueDate,task.assignee,task.priority,JSON.stringify(task.checklist),task.labels,task.assigneeId,task.referenceUrl,task.referenceDate,now,now),
 db.prepare("INSERT INTO task_updates(id,task_id,author,body,kind,created_at) VALUES($1,$2,$3,$4,'activity',$5)").bind(crypto.randomUUID(),id,await memberName(user),`Created task${task.assignee?` · Assigned to ${task.assignee}`:""}`,now)
 ]);return Response.json({id},{status:201});}catch{return Response.json({error:"Could not save task."},{status:503});}
}
export async function PATCH(request:Request){
 const user=await getChatGPTUser("workspace");if(!user)return Response.json({error:"Sign in required"},{status:401});
 const input=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!input || typeof input.id!=="string")return Response.json({error:"Choose a task."},{status:400});
 try {
 const old=await db.prepare("SELECT * FROM work_items WHERE id=$1 AND kind='task'").bind(input.id).first<Task>();if(!old)return Response.json({error:"Task no longer exists."},{status:404});
 if(user.role === "Intern" && old.task_assignee_id !== user.userId) return Response.json({error:"Task not found."},{status:404});
 if(input.comment!==undefined){if(typeof input.comment!=="string" || !input.comment.trim() || input.comment.length>4000)return Response.json({error:"Write an update of 1–4,000 characters."},{status:400});
 const commentResult=await db.prepare("INSERT INTO task_updates(id,task_id,author,body,kind,created_at) SELECT $1,id,$3,$4,'comment',$5 FROM work_items WHERE id=$2 AND kind='task' AND ($6 != 'Intern' OR task_assignee_id=$7)").bind(crypto.randomUUID(),input.id,await memberName(user),input.comment.trim(),Date.now(),user.role,user.userId).run();
 if(!commentResult.meta.changes)return Response.json({error:"Task not found."},{status:404});return Response.json({ok:true});}
 const task=parseTask(input,(await columns()).map(c=>c.id));if(!task || (typeof input.version!=="number" || !Number.isSafeInteger(input.version)))return Response.json({error:"Check the task fields."},{status:400});
 if(input.version!==old.updated_at)return Response.json({error:"This task changed since you opened it. Close and reopen it to load the latest version."},{status:409});
 const assigned=await resolveAssignee(task,old);if(!assigned)return Response.json({error:"Choose a signed-in team member."},{status:400});
 if(user.role === "Intern") {
   const before=taskInput(old);
   const unchanged=["title","notes","dueDate","assignee","assigneeId","referenceUrl","referenceDate","priority","labels"] as const;
   if(unchanged.some(key=>before[key]!==task[key]) || task.checklist.length!==before.checklist.length || task.checklist.some((step,i)=>step.id!==before.checklist[i].id || step.text!==before.checklist[i].text)) return Response.json({error:"Interns can update task status, checklist completion, and comments only."},{status:403});
 }
 const boardColumns=await columns();const columnName=(id:string)=>boardColumns.find(c=>c.id===id)?.name||id;
 const activity=describeTaskChange(old,task).replace(`Moved from ${old.status} to ${task.status}`,`Moved from ${columnName(old.status)} to ${columnName(task.status)}`);
 const now=Math.max(Date.now(),old.updated_at+1);
 const result=await db.prepare("WITH changed AS (UPDATE work_items SET title=$1,status=$2,notes=$3,due_date=$4,task_assignee=$5,task_priority=$6,task_checklist=$7,task_labels=$8,task_assignee_id=$9,task_reference_url=$10,task_reference_date=$11,updated_at=$12 WHERE id=$13 AND kind='task' AND updated_at=$14 RETURNING id) INSERT INTO task_updates(id,task_id,author,body,kind,created_at) SELECT $15,id,$16,$17,'activity',$12 FROM changed")
 .bind(task.title,task.status,task.notes,task.dueDate,task.assignee,task.priority,JSON.stringify(task.checklist),task.labels,task.assigneeId,task.referenceUrl,task.referenceDate,now,input.id,input.version,crypto.randomUUID(),await memberName(user),activity).run();
 if(!result.meta.changes)return Response.json({error:"Someone updated this task. Refresh and retry."},{status:409});return Response.json({ok:true});
 }catch{return Response.json({error:"Could not save the update. Please retry."},{status:503});}
}

async function resolveAssignee(task:NonNullable<ReturnType<typeof parseTask>>,old?:Task){
 if(task.assigneeId){
 const member=await db.prepare("SELECT CASE WHEN custom_name != '' THEN custom_name ELSE name END AS name FROM team_members WHERE id=$1").bind(task.assigneeId).first<{name:string}>();
 if(!member)return false;task.assignee=member.name;return true;
 }
 // Keep an existing legacy assignee until explicitly reassigned; new assignments use stable user IDs.
 if(task.assignee&&task.assignee!==old?.task_assignee)return false;
 return true;
}
