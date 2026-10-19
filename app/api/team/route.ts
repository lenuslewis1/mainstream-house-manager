import { database as db } from "../../../db/client";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isTeamRole, superAdminEmail } from "../../../lib/roles";
export async function GET() {
 const user=await getChatGPTUser("manageTeam");
 if(!user)return Response.json({error:"Super admin access required."},{status:403});
 return Response.json({me:user.userId,members:(await db.prepare("SELECT id,CASE WHEN custom_name != '' THEN custom_name ELSE name END AS name,email,role FROM team_members ORDER BY name").all()).results},{headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(request:Request) {
 const user=await getChatGPTUser("manageTeam");
 if(!user)return Response.json({error:"Super admin access required."},{status:403});
 const input=await request.json().catch(()=>null) as Record<string,unknown>|null;
 if(!input || typeof input.id!=="string" || !isTeamRole(input.role) || !isTeamRole(input.previousRole))return Response.json({error:"Choose a team member and valid role."},{status:400});
 if(input.role === "Super admin")return Response.json({error:"Super admin is reserved for lenuslewis40@gmail.com."},{status:403});
 const target=await db.prepare("SELECT email FROM team_members WHERE id=$1").bind(input.id).first<{email:string}>();
 if(input.id===user.userId || target?.email.toLowerCase()===superAdminEmail)return Response.json({error:"The Super admin role cannot be changed."},{status:403});
 const results=await db.batch([
  db.prepare("SELECT pg_advisory_xact_lock(184726)") ,
  db.prepare("UPDATE team_members SET role=$1 WHERE id=$2 AND role=$3 AND EXISTS (SELECT 1 FROM team_members actor WHERE actor.id=$4 AND actor.role='Super admin' AND lower(actor.email)=$5) RETURNING id").bind(input.role,input.id,input.previousRole,user.userId,superAdminEmail)
 ]);
 if(!results[1].meta.changes)return Response.json({error:"This member changed. Refresh and try again."},{status:409});
 return Response.json({ok:true});
}
