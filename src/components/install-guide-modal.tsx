"use client";

import { useState } from "react";
import { CheckCircle2, DownloadCloud, ExternalLink, ImageIcon, X } from "lucide-react";

export type InstallGuideStep = {
  title: string;
  description: string;
  /** Put PNGs in /public/install/ — missing files show a placeholder. */
  image: string;
};

export const DEFAULT_INSTALL_GUIDE_STEPS: InstallGuideStep[] = [
  {
    title: "Unzip the download",
    description: "Open the ZIP file and extract the FlowDoverz folder to your computer.",
    image: "/install/step-1-unzip.png",
  },
  {
    title: "Open Chrome Extensions",
    description: "In the address bar, open chrome://extensions",
    image: "/install/step-2-extensions.png",
  },
  {
    title: "Turn on Developer mode",
    description: "Enable Developer mode in the top-right corner.",
    image: "/install/step-3-developer.png",
  },
  {
    title: "Load unpacked",
    description: "Click Load unpacked, then select the unzipped FlowDoverz folder.",
    image: "/install/step-4-load.png",
  },
];

type InstallGuideModalProps = {
  open: boolean;
  onClose: () => void;
  steps?: InstallGuideStep[];
  extensionVersion?: string | null;
  /** Future: Chrome Web Store listing URL from Admin → Extension */
  chromeStoreUrl?: string | null;
  /** Future hooks — wire when ready */
  onOpenChromeStore?: () => void;
  onOpenExtensionsPage?: () => void;
};

function StepScreenshot({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-slate-500">
        <ImageIcon size={28} className="opacity-60" />
        <p className="text-xs font-medium">Screenshot coming soon</p>
        <p className="text-[10px] text-slate-600 px-3 text-center truncate max-w-full">{src}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="aspect-[16/10] w-full rounded-xl border border-white/10 object-cover object-top bg-black/40"
    />
  );
}

export function InstallGuideModal({
  open,
  onClose,
  steps = DEFAULT_INSTALL_GUIDE_STEPS,
  extensionVersion,
  chromeStoreUrl,
  onOpenChromeStore,
  onOpenExtensionsPage,
}: InstallGuideModalProps) {
  if (!open) return null;

  const storeReady = Boolean(chromeStoreUrl);
  const extensionsReady = typeof onOpenExtensionsPage === "function";

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close install guide"
        className="absolute inset-0 bg-[#030308]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c16] shadow-2xl"
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
                Install FlowDoverz
                {extensionVersion ? (
                  <span className="ml-2 text-sm font-bold text-slate-500">v{extensionVersion}</span>
                ) : null}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Download started. Follow these steps to finish setup.
              </p>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-5">
          {steps.map((step, index) => (
            <div key={step.image + index} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-[11px] font-black text-cyan-300">
                  {index + 1}
                </span>
                <h3 className="text-sm font-bold text-white">{step.title}</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-8">{step.description}</p>
              <div className="pl-0 sm:pl-8">
                <StepScreenshot src={step.image} alt={step.title} />
              </div>
            </div>
          ))}
        </div>

        <div className="relative shrink-0 space-y-2 border-t border-white/5 p-4 sm:p-5">
          {/* Future actions — enable when URLs / handlers are ready */}
          <button
            type="button"
            disabled={!storeReady}
            onClick={() => {
              if (chromeStoreUrl) {
                onOpenChromeStore?.() ??
                  window.open(chromeStoreUrl, "_blank", "noopener,noreferrer");
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open Chrome Web Store
            <ExternalLink size={16} />
            {!storeReady ? <span className="text-[10px] font-semibold text-slate-500">Soon</span> : null}
          </button>

          <button
            type="button"
            disabled={!extensionsReady}
            onClick={() => onOpenExtensionsPage?.()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open chrome://extensions
            <ExternalLink size={16} />
            {!extensionsReady ? (
              <span className="text-[10px] font-semibold text-slate-500">Soon</span>
            ) : null}
          </button>

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
