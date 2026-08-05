import type { Metadata } from "next";
import { LoginPage } from "@/components/login-page";

export const metadata: Metadata = {
  title: "Login — FlowDoverz",
  description:
    "Sign in to your FlowDoverz account to access Google Flow AI video generation.",
};

export default function Login() {
  return <LoginPage />;
}
