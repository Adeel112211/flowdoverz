"use client";

import { ReactNode } from "react";

const WIDTH_CLASS = {
  md: "max-w-md",
  lg: "max-w-lg",
  "2xl": "max-w-2xl",
} as const;

type AdminGlassModalProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  maxWidth?: keyof typeof WIDTH_CLASS;
  zIndexClass?: string;
  closeOnBackdrop?: boolean;
  align?: "center" | "end";
  scrollable?: boolean;
};

export function AdminGlassPanel({
  children,
  className = "",
  accent = "cyan",
}: {
  children: ReactNode;
  className?: string;
  accent?: "cyan" | "emerald" | "violet" | "rose" | "slate";
}) {
  const accentGlow =
    accent === "emerald"
      ? "bg-emerald-400/10"
      : accent === "violet"
        ? "bg-violet-400/10"
        : accent === "rose"
          ? "bg-rose-400/10"
          : accent === "slate"
            ? "bg-slate-400/10"
            : "bg-cyan-400/10";

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-white/[0.02] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl max-md:p-4 sm:p-8 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className={`pointer-events-none absolute -top-20 -right-16 h-40 w-40 rounded-full ${accentGlow} blur-3xl`} />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Solid panel — matches app theme (#0F172A), no glass/blur */
export function AdminPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#0F172A] p-6 sm:p-8 max-md:p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function AdminGlassModal({
  open,
  onClose,
  children,
  maxWidth = "md",
  zIndexClass = "z-[70]",
  closeOnBackdrop = false,
  align = "center",
  scrollable = false,
}: AdminGlassModalProps) {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex justify-center p-3 sm:p-4 ${
        align === "end" ? "items-end sm:items-center" : "items-center"
      }`}
    >
      {closeOnBackdrop && onClose ? (
        <button
          type="button"
          aria-label="Close dialog backdrop"
          className="absolute inset-0 bg-[#030308]/75 backdrop-blur-xl"
          onClick={onClose}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-[#030308]/75 backdrop-blur-xl"
        />
      )}
      <div
        className={`relative w-full max-h-[92dvh] ${WIDTH_CLASS[maxWidth]} ${
          scrollable ? "admin-modal-scroll overflow-y-auto" : "max-md:overflow-y-auto"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
