import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reseller Program | FlowDoverz",
  description:
    "Wholesale FlowDoverz seats for sellers. Offer Solo and Team plans to your clients with your own reseller panel.",
};

export default function ResellersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
