import { database as db } from "../db/client";
import type { TaskInput } from "./kanban";

export type AssignmentEmailResult = { status: "sent" | "skipped" | "not-configured" | "failed" };

// Only actual assignment changes trigger mail, never comments or board moves.
export async function notifyTaskAssignee(input: {
  id: string; version: number; task: TaskInput; previousAssigneeId?: string; assignedBy: string;
}): Promise<AssignmentEmailResult> {
  if (!input.task.assigneeId || input.task.assigneeId === input.previousAssigneeId) return { status: "skipped" };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TASK_EMAIL_FROM;
  if (!apiKey || !from) return { status: "not-configured" };
  try {
    // Recipients come from the server's team directory, never a request email field.
    const member = await db.prepare("SELECT email,CASE WHEN custom_name != '' THEN custom_name ELSE name END AS name FROM team_members WHERE id=$1")
      .bind(input.task.assigneeId).first<{ email: string; name: string }>();
    if (!member || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) return { status: "failed" };
    const url = new URL(process.env.APP_URL || "https://mainstream-house-manager.netlify.app");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) return { status: "failed" };
    url.pathname = "/"; url.search = ""; url.hash = ""; url.searchParams.set("task", input.id);
    const text = [
      `Hi ${member.name || "there"},`, "",
      `${input.assignedBy} assigned you a task in Mainstream House Manager.`, "",
      input.task.title,
      `Priority: ${input.task.priority}`,
      `Due date: ${input.task.dueDate || "Not set"}`,
      ...(input.task.notes ? ["", input.task.notes] : []),
      ...(input.task.referenceUrl ? ["", `Reference: ${input.task.referenceUrl}`] : []),
      "", `View your task: ${url.toString()}`, "", "Sign in with your workspace account to view and update it.",
    ].join("\n");
    const body = JSON.stringify({ from, to: [member.email], subject: `Task assigned: ${input.task.title.replace(/[\r\n]/g, " ")}`, text });
    // Reuse the key when retrying a transient failure; Resend deduplicates sends.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `task-assigned/${input.id}/${input.version}` },
          body, signal: AbortSignal.timeout(8000),
        });
        const result = await response.json().catch(() => null) as { id?: string } | null;
        if (response.ok && result?.id) return { status: "sent" };
        if (response.status !== 429 && response.status < 500) return { status: "failed" };
      } catch { /* Retry once with the same idempotency key. */ }
    }
    return { status: "failed" };
  } catch { return { status: "failed" }; }
}
