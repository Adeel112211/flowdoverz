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

function extraMessage(custom: string) {
  const raw = custom.trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  const fallback = "the site is under maintenance. please check back shortly.";
  if (normalized === fallback) return "";
  if (normalized.startsWith(`${fallback} `)) {
    return raw.slice(raw.toLowerCase().indexOf("shortly.") + "shortly.".length).trim();
  }
  return raw;
}

function MaintenanceMark() {
  return (
    <div className="relative mx-auto mb-5 flex h-32 w-32 items-center justify-center">
      <div className="absolute inset-1 rounded-[2.1rem] bg-amber-400/25 blur-2xl" />
      <svg
        viewBox="0 0 112 112"
        className="relative h-32 w-32 drop-shadow-[0_0_32px_rgba(34,211,238,0.22)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mm-ring" x1="10" y1="102" x2="102" y2="10" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FBBF24" />
            <stop offset="0.5" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#34D399" />
          </linearGradient>
          <linearGradient id="mm-fill" x1="28" y1="24" x2="86" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE68A" />
            <stop offset="0.45" stopColor="#67E8F9" />
            <stop offset="1" stopColor="#34D399" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="96" height="96" rx="28" fill="#070b14" stroke="url(#mm-ring)" strokeWidth="3.2" />
        <path
          d="M40 34a12 12 0 1 1 8.5 20.5L70 76a7 7 0 0 0 10-10L58.5 44.5A12 12 0 0 1 40 34Z"
          fill="none"
          stroke="url(#mm-fill)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <circle cx="40" cy="40" r="5.5" fill="none" stroke="url(#mm-fill)" strokeWidth="4" />
        <circle cx="78" cy="72" r="3.6" fill="#22D3EE" />
        <circle cx="78" cy="72" r="7" fill="none" stroke="#22D3EE" strokeOpacity="0.3" />
      </svg>
    </div>
  );
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
  const note = extraMessage(status.message);

  if (isAdmin || !status.active) {
    return children;
  }

  const untilLabel = formatUntil(status.until);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-[#05060a] px-4 py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[16%] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-amber-500/16 blur-[100px]" />
        <div className="absolute bottom-[10%] right-[6%] h-[200px] w-[200px] rounded-full bg-cyan-500/10 blur-[90px]" />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-title"
        className="animate-fade-up relative z-10 w-full max-w-[360px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b101c]/92 px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <MaintenanceMark />
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/90">
          Under maintenance
        </p>
        <h1 id="maintenance-title" className="mt-2 text-[1.65rem] font-black tracking-tight text-white">
          We'll be back soon
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          The site is <strong className="font-bold text-white">under maintenance</strong>.
          Please check back shortly.
        </p>
        {note ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{note}</p>
        ) : null}
        {(untilLabel || remaining) && (
          <p className="mt-6 text-xs text-slate-500">
            {untilLabel ? (
              <>
                Expected back <span className="font-semibold text-slate-300">{untilLabel}</span>
              </>
            ) : null}
            {untilLabel && remaining ? <span className="px-1.5 text-slate-600">·</span> : null}
            {remaining ? <span className="font-semibold text-amber-300">{remaining.label} left</span> : null}
          </p>
        )}
      </div>
    </div>
  );
}
