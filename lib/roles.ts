export const teamRoles = ["Super admin", "Manager", "Team member", "Intern"] as const;
export type TeamRole = typeof teamRoles[number];
export const superAdminEmail = "lenuslewis40@gmail.com";
export const assignableRoles = teamRoles.filter(role => role !== "Super admin");
export function isSuperAdminEmail(email:string):boolean { return email.trim().toLowerCase() === superAdminEmail; }
export function effectiveRole(email:string, role:TeamRole):TeamRole {
  if (isSuperAdminEmail(email)) return "Super admin";
  return role === "Super admin" ? "Manager" : role;
}
export type Capability = "workspace" | "operations" | "finance" | "manageTeam";
export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === "string" && teamRoles.includes(value as TeamRole);
}
export function can(role: TeamRole, capability: Capability): boolean {
  if (capability === "workspace") return true;
  if (role === "Super admin") return true;
  if (capability === "manageTeam") return false;
  if (role === "Manager") return true;
  return role === "Team member" && capability === "operations";
}
export const roleDescriptions: Record<TeamRole, string> = {
  "Super admin": "Full workspace access and exclusive control over team roles. Reserved for lenuslewis40@gmail.com.",
  Manager: "Full operational access, finances, and invoices. Role assignments require the Super admin.",
  "Team member": "Leads, orders, customers, vendors, marketing, and tasks. No finance records, invoices, or role management.",
  Intern: "View assigned tasks, move them between stages, complete checklist steps, and post updates.",
};
