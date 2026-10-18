export const taskStages = ["To do", "On hold", "Blocked", "In progress", "Review", "Done"] as const;
export const taskPriorities = ["Low", "Normal", "High", "Urgent"] as const;
export type CheckItem = {id:string; text:string; done:boolean};
export type Task = {id:string; title:string; status:string; notes:string; due_date:string; task_assignee:string; task_priority:string; task_checklist:string; task_labels:string; task_source_kind:string; task_source_id:string|null; created_at:number; updated_at:number};
export type TaskInput = {title:string; status:string; notes:string; dueDate:string; assignee:string; priority:string; checklist:CheckItem[]; labels:string};
export function checklistOf(task: Pick<Task,"task_checklist">): CheckItem[] { try { const value=JSON.parse(task.task_checklist || "[]"); return Array.isArray(value)?value:[]; } catch { return []; } }
export function taskInput(task:Task):TaskInput {return {title:task.title,status:task.status,notes:task.notes,dueDate:task.due_date,assignee:task.task_assignee||"",priority:task.task_priority||"Normal",checklist:checklistOf(task),labels:task.task_labels||""};}
export function parseTask(value:unknown):TaskInput|null {
  if(!value || typeof value!=="object")return null;
  const v=value as TaskInput;
  for(const [key,max] of Object.entries({title:160,notes:4000,dueDate:10,assignee:160,priority:20,status:30,labels:300}))if(typeof v[key as keyof TaskInput]!=="string" || (v[key as keyof TaskInput] as string).length>max)return null;
  if(!v.title.trim() || !taskStages.includes(v.status as typeof taskStages[number]) || !taskPriorities.includes(v.priority as typeof taskPriorities[number]))return null;
  if(v.dueDate){const d=new Date(v.dueDate+"T00:00:00Z");if(!/^\d{4}-\d{2}-\d{2}$/.test(v.dueDate)||isNaN(d.getTime())||d.toISOString().slice(0,10)!==v.dueDate)return null;}
  if(!Array.isArray(v.checklist)||v.checklist.length>50 || v.checklist.some(c=>!c || typeof c.id!=="string" || !c.id || c.id.length>80 || typeof c.text!=="string" || !c.text.trim() || c.text.length>300 || typeof c.done!=="boolean") || new Set(v.checklist.map(c=>c.id)).size!==v.checklist.length)return null;
  return {title:v.title.trim(),notes:v.notes.trim(),dueDate:v.dueDate,assignee:v.assignee.trim(),priority:v.priority,status:v.status,labels:v.labels.trim(),checklist:v.checklist};
}
export function describeTaskChange(old:Task,next:TaskInput):string {
  const changes:string[]=[];
  if(old.status!==next.status)changes.push(`Moved from ${old.status} to ${next.status}`);
  if((old.task_assignee||"")!==next.assignee)changes.push(next.assignee?`Assigned to ${next.assignee}`:"Removed assignee");
  if((old.task_priority||"Normal")!==next.priority)changes.push(`Priority: ${next.priority}`);
  if(old.due_date!==next.dueDate)changes.push(next.dueDate?`Due date: ${next.dueDate}`:"Removed due date");
  if(old.title!==next.title)changes.push(`Renamed task to ${next.title}`);
  if(old.notes!==next.notes)changes.push("Updated description");
  if((old.task_labels||"")!==next.labels)changes.push("Updated labels");
  if(JSON.stringify(checklistOf(old))!==JSON.stringify(next.checklist))changes.push(`Checklist: ${next.checklist.filter(c=>c.done).length}/${next.checklist.length} complete`);
  return changes.join(" · ") || "Saved task";
}
