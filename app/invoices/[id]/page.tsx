import InvoiceEditor from "../invoice-editor";
import { requireChatGPTUser } from "../../chatgpt-auth";
import "../invoice.css";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireChatGPTUser(`/invoices/${(await params).id}`, "finance");
  return <InvoiceEditor id={(await params).id} />;
}
