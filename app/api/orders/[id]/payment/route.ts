import { database as db } from "@/db/client";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { validMoney } from "@/lib/finance";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatGPTUser("finance"))) return Response.json({ error: "Manager access required." }, { status: 403 });
  const { id } = await params;
  const input = await request.json().catch(() => null) as { expectedAmount?: unknown } | null;
  if (typeof input?.expectedAmount !== "string" || !validMoney(input.expectedAmount)) return Response.json({ error: "Refresh the order before confirming payment." }, { status: 400 });
  try {
    const now = Date.now();
    const paymentId = crypto.randomUUID();
    const results = await db.batch([
      // A separate statement acquires the order lock before the next statement's
      // READ COMMITTED snapshot calculates the balance. Concurrent retries see
      // the first payment and cannot record the same outstanding balance twice.
      db.prepare("SELECT id FROM work_items WHERE id=$1 AND kind IN ('project','booking') FOR UPDATE").bind(id),
      db.prepare(`WITH balance AS MATERIALIZED (
        SELECT o.*, COALESCE(NULLIF(o.price,''),'0')::numeric AS quoted,
          GREATEST(0,COALESCE(NULLIF(o.price,''),'0')::numeric-COALESCE((SELECT SUM(COALESCE(NULLIF(p.amount,''),'0')::numeric) FROM work_items p WHERE p.kind='finance' AND p.direction='Income' AND p.status='Completed' AND p.project_id=o.id AND COALESCE(NULLIF(p.currency,''),'GHS')=COALESCE(NULLIF(o.currency,''),'GHS')),0)) AS remaining,
          EXISTS(SELECT 1 FROM work_items p WHERE p.kind='finance' AND p.direction='Income' AND p.status='Pending' AND p.project_id=o.id) AS pending
        FROM work_items o WHERE o.id=$1 AND o.kind IN ('project','booking')
      ), added AS (
        INSERT INTO work_items(id,kind,title,client,status,due_date,notes,amount,currency,direction,project_id,category,created_at,updated_at)
        SELECT $2,'finance',LEFT('Payment for '||title,160),client,'Completed',$3,'Payment confirmed from Orders.',remaining::text,COALESCE(NULLIF(currency,''),'GHS'),'Income',id,'Sales',$4,$4
        FROM balance WHERE quoted>0 AND remaining>0 AND NOT pending AND remaining=$5::numeric
        RETURNING id,amount,currency
      ) SELECT CASE WHEN quoted<=0 THEN 'no-price' WHEN remaining<=0 THEN 'already-paid' WHEN pending THEN 'pending' WHEN remaining!=$5::numeric THEN 'changed' ELSE 'recorded' END AS outcome,
        (SELECT id FROM added) AS id,(SELECT amount FROM added) AS amount,(SELECT currency FROM added) AS currency FROM balance`)
        .bind(id, paymentId, new Date(now).toISOString().slice(0, 10), now, input.expectedAmount),
    ]);
    const result = results[1].results[0] as { outcome: string; id: string | null; amount: string | null; currency: string | null } | undefined;
    if (!result) return Response.json({ error: "Order not found." }, { status: 404 });
    if (result.outcome === "already-paid") return Response.json({ ok: true, alreadyPaid: true });
    if (result.outcome === "pending") return Response.json({ error: "Review the pending payment before confirming another payment." }, { status: 409 });
    if (result.outcome === "no-price") return Response.json({ error: "Set an order price before confirming payment." }, { status: 400 });
    if (result.outcome === "changed") return Response.json({ error: "The balance changed. Review the refreshed order and confirm again." }, { status: 409 });
    return Response.json({ ok: true, id: result.id, amount: result.amount, currency: result.currency }, { status: 201 });
  } catch (error) {
    console.error("Unable to confirm order payment", error);
    return Response.json({ error: "Could not confirm payment. Please refresh and try again." }, { status: 503 });
  }
}
