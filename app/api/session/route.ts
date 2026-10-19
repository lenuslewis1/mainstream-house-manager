import { getChatGPTUser } from "../../chatgpt-auth";
export async function GET() {
  const user = await getChatGPTUser("workspace");
  return Response.json(user ? { user } : { error: "Sign in with an approved, verified account." }, { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
