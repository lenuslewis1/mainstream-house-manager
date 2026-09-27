import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { validMoney } from "../../../../lib/finance";
export const runtime = "edge";
export async function GET() {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  try { return Response.json({ budgets: (await env.DB!.prepare("SELECT * FROM finance_budgets ORDER BY month DESC, currency").all()).results }); }
  catch { return Response.json({ error: "Could not load budgets." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const month = String(input?.month ?? ""), currency = String(input?.currency ?? ""), revenueTarget = String(input?.revenueTarget ?? ""), expenseLimit = String(input?.expenseLimit ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^[A-Z]{3}$/.test(currency) || !validMoney(revenueTarget) || !validMoney(expenseLimit)) return Response.json({ error: "Enter a valid month, currency, and nonnegative targets." }, { status: 400 });
  try { await env.DB!.prepare("INSERT INTO finance_budgets (month, currency, revenue_target, expense_limit, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(month, currency) DO UPDATE SET revenue_target = excluded.revenue_target, expense_limit = excluded.expense_limit, updated_at = excluded.updated_at").bind(month,currency,revenueTarget,expenseLimit,Date.now()).run(); return Response.json({ ok: true }); }
  catch { return Response.json({ error: "Could not save budget." }, { status: 503 }); }
}
