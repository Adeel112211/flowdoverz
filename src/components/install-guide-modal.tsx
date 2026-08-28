"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  DownloadCloud,
  MonitorSmartphone,
  Smartphone,
  X,
} from "lucide-react";

type InstallGuideModalProps = {
  open: boolean;
  onClose: () => void;
  extensionVersion?: string | null;
  brandName?: string;
};

function detectIsMobile() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 768px)").matches;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarse && narrow);
}

function GuideVideo({
  device,
  emptyLabel,
}: {
  device: "pc" | "mobile";
  emptyLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = `/api/install-video?device=${device}`;

  useEffect(() => {
    setFailed(false);
  }, [device]);

  if (failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 px-4 text-center text-slate-500">
        <MonitorSmartphone size={28} className="opacity-60" />
        <p className="text-sm font-medium text-slate-400">{emptyLabel}</p>
        <p className="text-[11px] text-slate-600 font-mono">
          /public/install/{device === "pc" ? "pc-guide.mp4" : "mobile-guide.mp4"}
        </p>
      </div>
    );
  }

  return (
    <video
      key={src}
      className="aspect-video w-full bg-black"
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      onError={() => setFailed(true)}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

export function InstallGuideModal({
  open,
  onClose,
  extensionVersion,
  brandName = "FlowDoverz",
}: InstallGuideModalProps) {
  const [tab, setTab] = useState<"pc" | "mobile">("pc");

  useEffect(() => {
    if (!open) return;
    setTab(detectIsMobile() ? "mobile" : "pc");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close install guide"
        className="absolute inset-0 bg-[#030308]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(92dvh,900px)] w-full max-w-lg sm:max-w-3xl lg:max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c16] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
      >
        <div className="absolute top-0 right-0 h-48 w-48 -mr-16 -mt-16 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />

        <div className="relative shrink-0 border-b border-white/5 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-10">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
              <DownloadCloud size={22} />
            </div>
            <div>
              <h2 id="install-guide-title" className="text-xl font-black text-white">
                Install {brandName}
                {extensionVersion ? (
                  <span className="ml-2 text-sm font-bold text-slate-500">v{extensionVersion}</span>
                ) : null}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Watch the install video for your device.
              </p>
            </div>
          </div>

          <div className="mt-4 flex rounded-xl border border-white/10 bg-[#080810]/80 p-1">
            <button
              type="button"
              onClick={() => setTab("pc")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                tab === "pc"
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <MonitorSmartphone size={16} />
              PC
            </button>
            <button
              type="button"
              onClick={() => setTab("mobile")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                tab === "mobile"
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Smartphone size={16} />
              Mobile
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {tab === "pc" ? (
              <GuideVideo device="pc" emptyLabel="PC install video coming soon" />
            ) : (
              <GuideVideo device="mobile" emptyLabel="Mobile install video coming soon" />
            )}
          </div>
        </div>

        <div className="relative shrink-0 border-t border-white/5 p-4 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3.5 text-sm font-black text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:-translate-y-0.5 transition-all"
          >
            <CheckCircle2 size={18} />
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
