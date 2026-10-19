import { database as db } from "../../../../db/client";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { rememberMember } from "../../../../lib/team";
export const runtime="edge";
export async function PATCH(request:Request){
 const user=await getChatGPTUser("workspace");if(!user)return Response.json({error:"Sign in required"},{status:401});
 const v=await request.json().catch(()=>null) as Record<string,unknown>|null;
 if(!v||typeof v.name!=="string"||!v.name.trim()||v.name.trim().length>100)return Response.json({error:"Enter your name (1–100 characters)."},{status:400});
 try{await rememberMember(user);await db.prepare("UPDATE team_members SET custom_name=$1 WHERE id=$2").bind(v.name.trim(),user.userId).run();return Response.json({ok:true});}catch{return Response.json({error:"Could not save your name."},{status:503});}
}
