"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { AuthPageBackground } from "@/components/auth-page-background";
import { appPath } from "@/lib/site-urls";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");
    if (!token || !email) {
      setState("error");
      setMessage("This verification link is incomplete.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setState("success");
          setMessage(data.message || "Email verified. Your trial is now active.");
          setTimeout(() => router.replace("/dashboard"), 2500);
        } else {
          setState("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Could not verify your email. Try again from the dashboard.");
      });
  }, [router, searchParams]);

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center px-4 py-10">
      <AuthPageBackground />
      <div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#06080d]/80 p-8 text-center shadow-[0_0_60px_rgba(34,211,238,0.15)] backdrop-blur-3xl">
        <BrandLogo size="xl" stacked className="mx-auto mb-6" />
        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border ${
            state === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : state === "error"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          }`}
        >
          {state === "success" ? (
            <CheckCircle2 className="h-8 w-8" />
          ) : (
            <AlertCircle className="h-8 w-8" />
          )}
        </div>
        <h1 className="text-2xl font-black text-white">
          {state === "loading" ? "Verifying..." : state === "success" ? "Email verified" : "Verification failed"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{message}</p>
        {state !== "loading" && (
          <Link
            href={appPath("/dashboard")}
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black text-slate-950"
          >
            Go to dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
