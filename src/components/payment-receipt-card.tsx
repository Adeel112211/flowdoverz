"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { getReceiptWebsiteUrl } from "@/lib/receipt-barcode";
import { RECEIPT_THEME as T } from "@/lib/receipt-theme";

export type PaymentReceiptData = {
  receiptNumber: string;
  planName: string;
  amountLabel: string;
  transactionId: string;
  paymentDateLabel: string;
  expiryDateLabel?: string;
  refundDateLabel?: string;
  originalReceiptNumber?: string;
  userName: string;
  accountNumber: string;
  scanUrl?: string;
  status?: "paid" | "refunded";
};

function MetaRow({
  label,
  value,
  labelClass = "text-slate-500",
  valueClass = "text-slate-200",
  largeValue = false,
}: {
  label: string;
  value: string;
  labelClass?: string;
  valueClass?: string;
  largeValue?: boolean;
}) {
  return (
    <div className="flex w-full items-start justify-between gap-4 py-1 text-[12px] font-mono leading-relaxed">
      <span className={`shrink-0 ${labelClass}`}>{label}</span>
      <span
        className={`text-right font-semibold break-all ${valueClass} ${
          largeValue ? "text-[15px] font-bold" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ReceiptScanCode({ scanUrl }: { scanUrl: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const label = scanUrl.replace(/^https?:\/\//, "");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/receipt/qr?url=${encodeURIComponent(scanUrl)}`)
      .then((res) => (res.ok ? res.blob() : Promise.reject()))
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      )
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scanUrl]);

  return (
    <div className="mx-auto mt-4 text-center">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`Scan to visit ${label}`}
          width={168}
          height={168}
          className="mx-auto block"
        />
      ) : (
        <div
          className="mx-auto block h-[168px] w-[168px] animate-pulse rounded bg-slate-800/80"
          aria-hidden="true"
        />
      )}
      <p className="mt-2 font-mono text-[10px] text-slate-500">Scan to visit {label}</p>
    </div>
  );
}

export function PaymentReceiptCard({
  receipt,
  downloadable = false,
}: {
  receipt: PaymentReceiptData;
  downloadable?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const scanUrl = receipt.scanUrl || getReceiptWebsiteUrl();
  const isRefund = receipt.status === "refunded";

  async function downloadImage() {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      await new Promise((resolve) => setTimeout(resolve, 300));
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#080810",
      });
      const link = document.createElement("a");
      link.download = `${receipt.receiptNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to download receipt image", error);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[380px] flex-col items-center gap-3">
      <div
        ref={cardRef}
        className="mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl"
        style={{ filter: `drop-shadow(${T.glow})` }}
      >
      <div
        className="min-h-[420px] px-7 pb-8 pt-6 text-center"
        style={{ backgroundColor: T.paper }}
      >
        <p className="font-mono text-[11px] tracking-[0.35em] text-slate-500">***</p>
        <p className="mt-2 font-mono text-sm font-bold tracking-[0.35em] text-slate-100">
          {isRefund ? "REFUND" : "RECEIPT"}
        </p>
        <p
          className={`mt-2 font-mono text-base font-extrabold tracking-[0.18em] ${
            isRefund ? "text-rose-400" : "text-cyan-400"
          }`}
        >
          FLOWDOVERZ
        </p>
        <div
          className={`mx-auto mt-4 h-1 w-32 rounded-full bg-gradient-to-r ${
            isRefund ? "from-rose-500 to-orange-500" : "from-cyan-500 to-teal-500"
          }`}
        />

        <div className="mt-6 space-y-3.5 text-left">
          <MetaRow label="Name" value={receipt.userName} />
          <MetaRow
            label="Account#"
            value={receipt.accountNumber}
            valueClass="text-cyan-400"
          />
        </div>

        <div className="my-5 border-t border-slate-600/50" />

        <div className="space-y-3.5 text-left">
          <MetaRow
            label={`${receipt.planName} plan`}
            value={receipt.amountLabel}
            labelClass="text-slate-300"
            valueClass={isRefund ? "text-rose-400 font-bold" : "text-cyan-400 font-bold"}
          />
          <MetaRow
            label={isRefund ? "Refunded" : "Total"}
            value={receipt.amountLabel}
            labelClass="text-slate-100 font-bold"
            valueClass={isRefund ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}
            largeValue
          />
        </div>

        <div className="my-5 border-t border-slate-600/50" />

        <div className="space-y-3.5 text-left">
          {isRefund ? (
            <>
              <MetaRow label="Refund receipt" value={receipt.receiptNumber} />
              {receipt.originalReceiptNumber ? (
                <MetaRow label="Original receipt" value={receipt.originalReceiptNumber} />
              ) : null}
              <MetaRow label="Paid on" value={receipt.paymentDateLabel} />
              {receipt.refundDateLabel ? (
                <MetaRow
                  label="Refunded on"
                  value={receipt.refundDateLabel}
                  valueClass="text-rose-400"
                />
              ) : null}
            </>
          ) : (
            <>
              <MetaRow label="Receipt" value={receipt.receiptNumber} />
              <MetaRow label="Paid on" value={receipt.paymentDateLabel} />
              {receipt.expiryDateLabel ? (
                <MetaRow label="Valid until" value={receipt.expiryDateLabel} />
              ) : null}
            </>
          )}
        </div>

        <p className="mt-6 font-mono text-[11px] tracking-[0.35em] text-slate-500">***</p>
        <ReceiptScanCode scanUrl={scanUrl} />
      </div>
      </div>

      {downloadable ? (
        <button
          type="button"
          onClick={downloadImage}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Preparing…" : "Download PNG"}
        </button>
      ) : null}
    </div>
  );
}
