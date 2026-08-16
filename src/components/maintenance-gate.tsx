"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Construction } from "lucide-react";
import {
  MAINTENANCE_EVENT,
  type MaintenanceNotice,
} from "@/lib/maintenance-client";
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

    const apply = (next: PublicMaintenanceStatus) => {
      setStatus(next);
    };

    const refresh = async () => {
      try {
        const res = await fetch("/api/maintenance", { cache: "no-store" });
        const data = await res.json();
        if (data?.success) {
          apply({
            active: Boolean(data.active),
            message: String(data.message || ""),
            until: String(data.until || ""),
          });
        }
      } catch {
        // Keep last known status.
      }
    };

    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<MaintenanceNotice>).detail;
      if (!detail?.active) return;
      apply({
        active: true,
        message: String(detail.message || ""),
        until: String(detail.until || ""),
      });
      void refresh();
    };

    void refresh();
    window.addEventListener(MAINTENANCE_EVENT, onNotice);
    const poll = window.setInterval(refresh, 20_000);
    return () => {
      window.removeEventListener(MAINTENANCE_EVENT, onNotice);
      window.clearInterval(poll);
    };
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-[#05060a] px-4 py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-8%] h-[280px] w-[520px] -translate-x-1/2 rounded-full bg-amber-500/12 blur-[100px]" />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-title"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220] p-5 shadow-[0_0_60px_rgba(245,158,11,0.12)]"
      >
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300">
            <Construction className="h-4 w-4" />
          </div>
          <h1 id="maintenance-title" className="text-lg font-black text-white">
            We'll be back soon
          </h1>
        </div>
        <p className="text-center text-xs leading-relaxed text-slate-400">
          The site is <strong className="font-bold text-slate-200">under maintenance</strong>.
          Please check back shortly.
        </p>
        {status.message &&
        status.message !== "The site is under maintenance. Please check back shortly." ? (
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-300">
            {status.message}
          </p>
        ) : null}
        {(untilLabel || remaining) && (
          <div className="mt-4 rounded-lg border border-white/8 bg-black/25 px-3 py-2.5 text-center">
            {untilLabel ? (
              <p className="text-xs font-semibold text-slate-200">Expected back {untilLabel}</p>
            ) : null}
            {remaining ? <p className="mt-0.5 text-xs font-medium text-amber-300">{remaining}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
