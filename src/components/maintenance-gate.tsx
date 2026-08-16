"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
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
    <div className="fixed inset-0 z-[200] min-h-dvh overflow-y-auto bg-[#080810]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.16)_0%,transparent_48%),radial-gradient(circle_at_50%_100%,rgba(20,184,166,0.12)_0%,transparent_42%)]" />
      </div>

      <div
        role="main"
        aria-labelledby="maintenance-title"
        className="animate-fade-up relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center"
      >
        <BrandLogo size="xl" stacked showTagline={false} />
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-400">
          Under maintenance
        </p>
        <h1
          id="maintenance-title"
          className="mt-3 max-w-xl text-4xl font-black tracking-tight text-white sm:text-5xl"
        >
          We'll be back soon
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-slate-400">
          The site is <strong className="font-bold text-white">under maintenance</strong>.
          Please check back shortly.
        </p>
        {note ? (
          <p className="mt-2 max-w-md text-base leading-relaxed text-slate-300">{note}</p>
        ) : null}

        {remaining ? (
          <div className="mt-10">
            <p className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl">
              {remaining.label}
            </p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-400">
              left
            </p>
            {untilLabel ? (
              <p className="mt-4 text-sm text-slate-400">
                Expected back <span className="font-semibold text-slate-200">{untilLabel}</span>
              </p>
            ) : null}
          </div>
        ) : untilLabel ? (
          <p className="mt-10 text-sm text-slate-400">
            Expected back <span className="font-semibold text-slate-200">{untilLabel}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
