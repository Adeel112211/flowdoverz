"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Construction } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import type { PublicMaintenanceStatus } from "@/lib/maintenance";

function formatUntil(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function remainingText(iso: string, now: number) {
  if (!iso) return "";
  const untilMs = Date.parse(iso);
  if (Number.isNaN(untilMs)) return "";
  const diff = untilMs - now;
  if (diff <= 0) return "";
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${Math.max(1, minutes)}m remaining`;
}

export function MaintenanceGate({
  initial,
  children,
}: {
  initial: PublicMaintenanceStatus;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = Boolean(pathname?.startsWith("/admin"));
  const [status, setStatus] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setStatus(initial);
  }, [initial]);

  useEffect(() => {
    if (isAdmin) return;

    const refresh = async () => {
      try {
        const res = await fetch("/api/maintenance", { cache: "no-store" });
        const data = await res.json();
        if (data?.success) {
          setStatus({
            active: Boolean(data.active),
            message: String(data.message || ""),
            until: String(data.until || ""),
          });
        }
      } catch {
        // Keep last known status.
      }
    };

    const poll = window.setInterval(refresh, 20_000);
    return () => window.clearInterval(poll);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || !status.active) return;
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, [isAdmin, status.active]);

  const remaining = remainingText(status.until, now);

  if (isAdmin || !status.active) {
    return children;
  }

  const untilLabel = formatUntil(status.until);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-[#05060a] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0F172A] p-6 shadow-[0_0_80px_rgba(245,158,11,0.15)] sm:p-8"
      >
        <div className="mb-6 flex justify-center">
          <BrandLogo size="md" />
        </div>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-300">
          <Construction className="h-6 w-6" />
        </div>
        <h1 id="maintenance-title" className="text-center text-2xl font-black text-white">
          We'll be back soon
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-400 sm:text-base">
          {status.message || "We're performing scheduled maintenance. Please check back shortly."}
        </p>
        {(untilLabel || remaining) && (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center">
            {untilLabel ? (
              <p className="text-sm font-semibold text-slate-200">Expected back {untilLabel}</p>
            ) : null}
            {remaining ? <p className="mt-1 text-xs text-amber-300">{remaining}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
