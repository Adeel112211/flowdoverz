import type { Metadata } from "next";
import { ReceiptsPage } from "@/components/receipts-page";

export const metadata: Metadata = {
  title: "My Receipts — FlowDoverz",
  description: "View and download your payment and refund receipts.",
};

export default function Receipts() {
  return <ReceiptsPage />;
}
