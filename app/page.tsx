import Workspace from "./workspace";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home({searchParams}: {searchParams: Promise<{task?: string | string[]}>}) {
  const {task} = await searchParams;
  const returnTo = typeof task === "string" && task.length <= 200 ? `/?task=${encodeURIComponent(task)}` : "/";
  const user = await requireChatGPTUser(returnTo);
  return <Workspace role={user.role} />;
}
