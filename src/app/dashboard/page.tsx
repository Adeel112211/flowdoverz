import type { Metadata } from "next";
import { DashboardPage } from "@/components/dashboard-page";

export const metadata: Metadata = {
  title: "Dashboard — FlowDoverz",
  description: "Manage your FlowDoverz workspace.",
};

export default function Dashboard() {
  return <DashboardPage />;
}
