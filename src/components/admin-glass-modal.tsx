"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  sheet = false,
}: {
  children: ReactNode;
  className?: string;
  accent?: "cyan" | "emerald" | "violet" | "rose" | "slate";
  /** Bottom-sheet styling for mobile modals */
  sheet?: boolean;
}) {
  const shadowGlow = sheet
    ? ""
    : accent === "emerald"
      ? "shadow-[0_0_60px_rgba(16,185,129,0.15)]"
      : accent === "violet"
        ? "shadow-[0_0_60px_rgba(139,92,246,0.15)]"
        : accent === "rose"
          ? "shadow-[0_0_60px_rgba(244,63,94,0.15)]"
          : accent === "slate"
            ? "shadow-[0_0_60px_rgba(148,163,184,0.15)]"
            : "shadow-[0_0_60px_rgba(34,211,238,0.15)]";

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

  const shape = sheet
    ? "rounded-none border-0 bg-transparent p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8 md:p-10"
    : "overflow-hidden rounded-3xl border border-white/10 bg-[#06080d] p-6 sm:p-8 md:p-10";

  return (
    <div className={`relative isolate group ${shadowGlow} ${shape} ${className}`}>
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${hoverGlow} to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100 ${
          sheet ? "" : "rounded-3xl"
        }`}
      />
      <div className="relative z-10">
        {sheet ? (
          <div
            aria-hidden
            className="mx-auto mb-4 mt-0.5 h-1 w-10 rounded-full bg-white/25 sm:hidden"
          />
        ) : null}
        {children}
      </div>
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
      // shrink-0: overflow-hidden flex children otherwise get min-height:0 and
      // collapse to the viewport, clipping content so the page cannot scroll.
      className={`shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A] p-6 sm:p-8 max-md:p-4 ${className}`}
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
  zIndexClass = "z-[100]",
  closeOnBackdrop = false,
  align = "center",
  scrollable = true,
}: AdminGlassModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const desktopAlign =
    align === "end" ? "sm:items-end sm:pb-6 md:items-center md:pb-4" : "sm:items-center";

  const modal = (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-end justify-center p-0 sm:p-4 ${desktopAlign}`}
      role="dialog"
      aria-modal="true"
    >
      {closeOnBackdrop && onClose ? (
        <button
          type="button"
          aria-label="Close dialog backdrop"
          className="absolute inset-0 bg-[#030308]/80 backdrop-blur-xl"
          onClick={onClose}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[#030308]/80 backdrop-blur-xl" />
      )}

      {/* Shell owns radius + border so corners clip cleanly */}
      <div
        className={`relative z-10 flex w-full min-h-0 flex-col overflow-hidden border border-white/10 bg-[#06080d] ${WIDTH_CLASS[maxWidth]} max-h-[min(90dvh,100%)] rounded-t-3xl rounded-b-none sm:rounded-3xl`}
      >
        <div
          className={`min-h-0 flex-1 overscroll-contain [-webkit-overflow-scrolling:touch] touch-pan-y ${
            scrollable
              ? "admin-modal-scroll overflow-x-hidden overflow-y-auto"
              : "overflow-x-hidden overflow-y-auto"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
