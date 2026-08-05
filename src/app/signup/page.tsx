import type { Metadata } from "next";
import { SignupPage } from "@/components/signup-page";

export const metadata: Metadata = {
  title: "Sign up — FlowDoverz",
  description: "Create your FlowDoverz workspace and start your free trial.",
};

export default function Signup() {
  return <SignupPage />;
}
