import { requireChatGPTUser } from "../chatgpt-auth";
import InvoiceList from "./invoice-list";
import "./invoice.css";

export const dynamic = "force-dynamic";
export default async function InvoicesPage() {
  await requireChatGPTUser("/invoices", "finance");
  return <InvoiceList />;
}
