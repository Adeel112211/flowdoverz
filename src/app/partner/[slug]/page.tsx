import { redirect } from "next/navigation";
import { getResellerUrl } from "@/lib/site-urls";

export default function LegacyPartnerPage() {
  redirect(getResellerUrl());
}
