import type { Metadata } from "next";
import { CookiesPage } from "@/components/cookies-page";

export const metadata: Metadata = {
  title: "Admin — Cookie manager — FlowDoverz",
  description: "Password-protected admin cookie manager for FlowDoverz.",
};

export default function Cookies() {
  return <CookiesPage />;
}
