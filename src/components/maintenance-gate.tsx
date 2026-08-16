"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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

function remainingParts(iso: string, now: number) {
  if (!iso) return null;
  const untilMs = Date.parse(iso);
  if (Number.isNaN(untilMs)) return null;
  const diff = untilMs - now;
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.max(hours > 0 ? 0 : 1, Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000)));
  return {
    label: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
  };
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
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(tick);
  }, [isAdmin, status.active]);

  const remaining = remainingParts(status.until, now);

  if (isAdmin || !status.active) {
    return children;
  }

  const untilLabel = formatUntil(status.until);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-[#05060a] px-4 py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[18%] h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-amber-500/16 blur-[90px]" />
        <div className="absolute bottom-[12%] right-[8%] h-[180px] w-[180px] rounded-full bg-cyan-500/8 blur-[80px]" />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-title"
        className="animate-fade-up relative z-10 w-full max-w-[340px] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#0b101c]/92 px-6 py-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/90">
          Under maintenance
        </p>
        <h1 id="maintenance-title" className="mt-2 text-xl font-black tracking-tight text-white">
          We'll be back soon
        </h1>
        {remaining ? (
          <p className="mt-5 font-black tracking-tight text-amber-200">
            <span className="block text-3xl leading-none">{remaining.label}</span>
            <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/70">
              remaining
            </span>
          </p>
        ) : null}
        <p className="mt-5 text-sm leading-relaxed text-slate-400">
          The site is <strong className="font-bold text-white">under maintenance</strong>.
          Please check back shortly.
        </p>
        {status.message &&
        status.message !== "The site is under maintenance. Please check back shortly." ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {status.message}
          </p>
        ) : null}
        {untilLabel ? (
          <p className="mt-5 text-xs text-slate-500">
            Expected back <span className="font-semibold text-slate-300">{untilLabel}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
