import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reseller Program | FlowDoverz",
  description:
    "Wholesale FlowDoverz seats for sellers. Sell with your own branding, website, and pricing — or under the FlowDoverz brand. Solo and Team plans with your own reseller panel.",
};

export default function ResellersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
