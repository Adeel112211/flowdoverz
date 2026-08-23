"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatActivityAction } from "@/components/admin-activity-filters";

export function AdminMobileCardShell({ children }: { children: ReactNode }) {
  return (
    <article className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#0F172A]/90 shadow-lg backdrop-blur-xl">
      {children}
    </article>
  );
}

export function AdminMobileCardBody({
  children,
  href,
}: {
  children: ReactNode;
  href?: string;
}) {
  const className = "block p-3.5 active:bg-white/[0.02]";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

export function AdminMobileCardHeader({
  title,
  subtitle,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-bold text-white">{title}</div>
        {subtitle ? (
          <div className="mt-1 break-all text-xs leading-relaxed text-slate-400">{subtitle}</div>
        ) : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}

export function AdminMobileMetaGrid({
  cols = 3,
  children,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const colClass =
    cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 min-[400px]:grid-cols-3";
  return <div className={`mt-3 grid ${colClass} gap-2`}>{children}</div>;
}

export function AdminMobileMetaTile({
  label,
  value,
  valueClassName = "text-slate-200",
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className={`mt-0.5 text-xs font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}

export function AdminMobileCardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-white/10 bg-black/20 p-2">{children}</div>
  );
}

export function AdminMobileActionGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 gap-1">{children}</div>;
}

export function AdminMobileActionButton({
  label,
  shortLabel,
  icon: Icon,
  onClick,
  bgClass,
  colorClass,
}: {
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  onClick: () => void;
  bgClass: string;
  colorClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 transition-colors hover:brightness-125 ${bgClass} ${colorClass}`}
    >
      <Icon size={18} strokeWidth={2.25} />
      <span className="text-[9px] font-bold leading-none">{shortLabel || label.split(" ")[0]}</span>
    </button>
  );
}

export function AdminMobileActionRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

export function AdminMobileActionStack({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-2">{children}</div>;
}

export function AdminMobileFooterButton({
  children,
  onClick,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "default" | "success" | "danger" | "muted" | "cyan";
  className?: string;
}) {
  const styles = {
    default: "border-white/15 bg-white/[0.06] text-slate-200",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    danger: "border-rose-500/20 bg-rose-500/10 text-rose-400",
    muted: "border-slate-500/20 bg-slate-500/10 text-slate-300",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors hover:brightness-110 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function activityTone(action: string) {
  if (action.includes("approved") || action.includes("created") || action.includes("unsuspend")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (action.includes("rejected") || action.includes("deleted") || action.includes("suspend")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  if (action.includes("refunded") || action.includes("cleared") || action.includes("logout")) {
    return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
  if (action.includes("payment") || action.includes("cookie")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
}

export function AdminMobileActivityBadge({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${activityTone(action)}`}
    >
      {formatActivityAction(action)}
    </span>
  );
}

export function AdminMobilePlanBadge({ plan }: { plan: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
      {plan}
    </span>
  );
}
