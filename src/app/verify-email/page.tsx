import { Suspense } from "react";
import { VerifyEmailPage } from "@/components/verify-email-page";

export const metadata = {
  title: "Verify email — FlowDoverz",
};

export default function VerifyEmail() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#080810] text-slate-400">
          Verifying...
        </div>
      }
    >
      <VerifyEmailPage />
    </Suspense>
  );
}
