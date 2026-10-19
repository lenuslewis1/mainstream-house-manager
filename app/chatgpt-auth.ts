// Existing route imports use this module; identity now comes only from Neon.
import { database as db } from "../db/client";
import { rememberMember } from "../lib/team";
import { can, isTeamRole, effectiveRole, type TeamRole, type Capability } from "../lib/roles";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/server";
import { canAccessWorkspace } from "@/lib/auth/access";
import { safeReturnTo } from "@/lib/auth/return-to";

export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null; role: TeamRole };

export async function getChatGPTUser(capability: Capability = "operations"): Promise<ChatGPTUser | null> {
  const { data: session, error } = await getAuth().getSession();
  if (error) throw new Error("Neon Auth session could not be verified.");
  const user = session?.user;
  if (!user || !user.emailVerified || !canAccessWorkspace(user.email)) return null;
  const identity = { userId: user.id, displayName: user.name || user.email, email: user.email, fullName: user.name || null };
  await rememberMember(identity);
  const membership = await db.prepare("SELECT role FROM team_members WHERE id=$1").bind(user.id).first<{role:string}>();
  if (!membership || !isTeamRole(membership.role)) return null;
  const role = effectiveRole(user.email, membership.role);
  if (!can(role, capability)) return null;
  return { ...identity, role };
}

export async function requireChatGPTUser(returnTo: string, capability: Capability = "workspace"): Promise<ChatGPTUser> {
  const user = await getChatGPTUser("workspace");
  if (user && can(user.role, capability)) return user;
  if (user) redirect("/");
  redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo: string) {
  return `/auth/sign-in?return_to=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
