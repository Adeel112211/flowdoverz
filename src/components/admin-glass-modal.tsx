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
  const shadowGlow =
    accent === "emerald"
      ? "shadow-[0_0_60px_rgba(16,185,129,0.15)] max-md:shadow-[0_10px_40px_rgba(16,185,129,0.2)]"
      : accent === "violet"
        ? "shadow-[0_0_60px_rgba(139,92,246,0.15)] max-md:shadow-[0_10px_40px_rgba(139,92,246,0.2)]"
        : accent === "rose"
          ? "shadow-[0_0_60px_rgba(244,63,94,0.15)] max-md:shadow-[0_10px_40px_rgba(244,63,94,0.2)]"
          : accent === "slate"
            ? "shadow-[0_0_60px_rgba(148,163,184,0.15)] max-md:shadow-[0_10px_40px_rgba(148,163,184,0.2)]"
            : "shadow-[0_0_60px_rgba(34,211,238,0.15)] max-md:shadow-[0_10px_40px_rgba(34,211,238,0.2)]";

  const hoverGlow =
    accent === "emerald"
      ? "from-emerald-500/10"
      : accent === "violet"
        ? "from-violet-500/10"
        : accent === "rose"
          ? "from-rose-500/10"
          : accent === "slate"
            ? "from-slate-500/10"
            : "from-cyan-500/10";

  return (
    <div
      className={`relative isolate transform-gpu overflow-hidden rounded-[2rem] border border-white/10 bg-[#06080d]/80 p-6 sm:p-8 md:p-10 backdrop-blur-3xl group ${shadowGlow} ${className}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${hoverGlow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />
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
        className={`relative w-full max-h-[92dvh] rounded-[2rem] ${WIDTH_CLASS[maxWidth]} ${
          scrollable ? "admin-modal-scroll overflow-y-auto" : "max-md:overflow-y-auto"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
