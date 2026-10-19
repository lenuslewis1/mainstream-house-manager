import { getAuth } from "@/lib/auth/server";
import { canAccessWorkspace } from "@/lib/auth/access";

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  if (request.method === "POST" && path.join("/") === "sign-up/email") {
    const input = await request.clone().json().catch(() => null) as { email?: unknown } | null;
    if (typeof input?.email !== "string" || !canAccessWorkspace(input.email)) {
      return Response.json({ message: "This email is not approved for the workspace." }, { status: 403 });
    }
  }
  const handlers = getAuth().handler();
  const method = request.method as keyof typeof handlers;
  return handlers[method](request, context);
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
