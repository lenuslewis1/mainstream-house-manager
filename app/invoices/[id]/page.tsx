import InvoiceEditor from "../invoice-editor";
import "../invoice.css";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return <InvoiceEditor id={(await params).id} />;
}
