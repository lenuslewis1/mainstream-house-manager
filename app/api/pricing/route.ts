import { database as db } from "../../../db/client";
import { getChatGPTUser } from "../../chatgpt-auth";
import { parsePrice } from "../../../lib/pricing";
export const runtime="edge";
export async function GET() {
  if (!(await getChatGPTUser("operations"))) return Response.json({error:"Workspace access required."},{status:403});
  try { return Response.json({prices:(await db.prepare("SELECT * FROM service_prices ORDER BY service,option").all()).results}); }
  catch { return Response.json({error:"Could not load prices. Please retry."},{status:503}); }
}
export async function PUT(request:Request) {
  if (!(await getChatGPTUser("finance"))) return Response.json({error:"Manager access required to edit prices."},{status:403});
  const price=parsePrice(await request.json().catch(()=>null));
  if (!price) return Response.json({error:"Check the service, price, unit, and minimum quantity."},{status:400});
  try {
    const now=Math.max(Date.now(),price.version+1);
    const result=price.version===0
      ? await db.prepare("INSERT INTO service_prices(id,service,option,amount,currency,unit,mode,minimum,notes,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO NOTHING RETURNING id")
          .bind(price.id,price.service,price.option,price.amount,price.currency,price.unit,price.mode,price.minimum,price.notes,now).run()
      : await db.prepare("UPDATE service_prices SET option=$1,amount=$2,currency=$3,unit=$4,mode=$5,minimum=$6,notes=$7,updated_at=$8 WHERE id=$9 AND service=$10 AND updated_at=$11 RETURNING id")
          .bind(price.option,price.amount,price.currency,price.unit,price.mode,price.minimum,price.notes,now,price.id,price.service,price.version).run();
    if(result.meta.changes)return Response.json({ok:true});
    return Response.json({error:"This price changed. Refresh the list and reopen it before saving."},{status:409});
  } catch { return Response.json({error:"Could not save the price. Please retry."},{status:503}); }
}
export async function DELETE(request:Request) {
  if (!(await getChatGPTUser("finance"))) return Response.json({error:"Manager access required to edit prices."},{status:403});
  const input=await request.json().catch(()=>null) as {id?:unknown;version?:unknown}|null;
  if (typeof input?.id!=="string" || typeof input.version!=="number" || !Number.isSafeInteger(input.version)) return Response.json({error:"Choose a saved price."},{status:400});
  try {
    const result=await db.prepare("DELETE FROM service_prices WHERE id=$1 AND updated_at=$2 RETURNING id").bind(input.id,input.version).run();
    return result.meta.changes?Response.json({ok:true}):Response.json({error:"This price changed. Refresh and retry."},{status:409});
  } catch { return Response.json({error:"Could not remove the price."},{status:503}); }
}
