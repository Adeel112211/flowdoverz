"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import {
  MAINTENANCE_EVENT,
  type MaintenanceNotice,
} from "@/lib/maintenance-client";
import { subscribeLive } from "@/lib/live-client";
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
        const res = await fetch("/api/maintenance");
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

    window.addEventListener(MAINTENANCE_EVENT, onNotice);
    const unsub = subscribeLive((event) => {
      if (event.topic === "maintenance" || event.topic === "settings") {
        void refresh();
      }
    });
    if (!initial.active) {
      return () => {
        window.removeEventListener(MAINTENANCE_EVENT, onNotice);
        unsub();
      };
    }

    void refresh();
    return () => {
      window.removeEventListener(MAINTENANCE_EVENT, onNotice);
      unsub();
    };
  }, [isAdmin, initial.active]);

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
    <div className="fixed inset-0 z-[200] h-dvh overflow-hidden bg-[#080810]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.16)_0%,transparent_48%),radial-gradient(circle_at_50%_100%,rgba(20,184,166,0.12)_0%,transparent_42%)]" />
      </div>

      <div
        role="main"
        aria-labelledby="maintenance-title"
        className="animate-fade-up relative z-10 flex h-full flex-col items-center justify-center px-4 py-4 text-center sm:px-6"
      >
        <BrandLogo size="sm" stacked showTagline={false} />
        <MaintenanceHero />
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-400 sm:text-[11px]">
          Under maintenance
        </p>
        <h1
          id="maintenance-title"
          className="mt-1 max-w-xl text-2xl font-black tracking-tight text-white sm:text-4xl"
        >
          We'll be back soon
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
          The site is <strong className="font-bold text-white">under maintenance</strong>.
          Please check back shortly.
        </p>
        {note ? (
          <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-300">{note}</p>
        ) : null}

        {remaining ? (
          <div className="mt-4 sm:mt-5">
            <p className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
              {remaining.label}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-400 sm:text-[11px]">
              left
            </p>
            {untilLabel ? (
              <p className="mt-2 text-xs text-slate-400 sm:text-sm">
                Expected back <span className="font-semibold text-slate-200">{untilLabel}</span>
              </p>
            ) : null}
          </div>
        ) : untilLabel ? (
          <p className="mt-4 text-xs text-slate-400 sm:text-sm">
            Expected back <span className="font-semibold text-slate-200">{untilLabel}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MaintenanceHero() {
  return (
    <div className="relative mx-auto mt-1 inline-block max-h-[34dvh] max-w-[min(100%,40rem)] sm:max-h-[38dvh]">
      <img
        src="/maintenance-hero.png"
        alt=""
        width={1410}
        height={989}
        aria-hidden="true"
        className="maintenance-bob mx-auto h-auto max-h-[34dvh] w-auto max-w-full object-contain sm:max-h-[38dvh]"
      />

      <span className="maintenance-hook pointer-events-none absolute left-[31%] top-[14%] hidden h-10 w-10 sm:block">
        <svg viewBox="0 0 40 40" className="h-full w-full drop-shadow-[0_8px_16px_rgba(6,182,212,0.45)]">
          <rect x="4" y="4" width="32" height="32" rx="8" fill="#06b6d4" />
          <path d="M10 26l7-8 5 5 8-10" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="14" cy="13" r="2.2" fill="white" />
        </svg>
      </span>

      <span className="maintenance-drift pointer-events-none absolute right-[10%] top-[4%] h-9 w-14 sm:h-11 sm:w-16">
        <svg viewBox="0 0 64 40" className="h-full w-full">
          <ellipse cx="32" cy="22" rx="22" ry="12" fill="white" />
          <ellipse cx="20" cy="18" rx="12" ry="10" fill="white" />
          <ellipse cx="44" cy="17" rx="11" ry="9" fill="white" />
        </svg>
      </span>

      <span className="maintenance-spin pointer-events-none absolute right-[18%] top-[22%] h-8 w-8 text-slate-300 sm:h-10 sm:w-10">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full opacity-90 drop-shadow-[0_4px_10px_rgba(148,163,184,0.4)]">
          <path d="M11 2h2l.4 2.3a7 7 0 0 1 1.8.8L17.4 4l1.4 1.4-1.1 2.2a7 7 0 0 1 .8 1.8L21 11v2l-2.3.4a7 7 0 0 1-.8 1.8L19 17.4 17.6 18.8l-2.2-1.1a7 7 0 0 1-1.8.8L13 21h-2l-.4-2.3a7 7 0 0 1-1.8-.8L6.6 20 5.2 18.6l1.1-2.2a7 7 0 0 1-.8-1.8L3 13v-2l2.3-.4a7 7 0 0 1 .8-1.8L5 6.6 6.4 5.2l2.2 1.1a7 7 0 0 1 1.8-.8L11 2Zm1 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
        </svg>
      </span>

      <span className="maintenance-drift-alt pointer-events-none absolute right-[6%] top-[42%] h-9 w-9 sm:h-11 sm:w-11">
        <svg viewBox="0 0 40 40" className="h-full w-full drop-shadow-[0_8px_16px_rgba(6,182,212,0.4)]">
          <rect x="2" y="2" width="36" height="36" rx="10" fill="#0891b2" />
          <text x="20" y="26" textAnchor="middle" fontSize="13" fontWeight="800" fill="white" fontFamily="ui-monospace, monospace">
            {"</>"}
          </text>
        </svg>
      </span>

      <span className="maintenance-blink pointer-events-none absolute bottom-[22%] right-[21%] h-2 w-2 rounded-full bg-emerald-400 sm:bottom-[24%] sm:right-[22%]" />
      <span
        className="maintenance-blink pointer-events-none absolute bottom-[22%] right-[17%] h-2 w-2 rounded-full bg-emerald-400 sm:bottom-[24%] sm:right-[18%]"
        style={{ animationDelay: "0.7s" }}
      />
    </div>
  );
}
