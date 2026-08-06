"use client";

import { X } from "lucide-react";
import { PaymentReceiptCard } from "@/components/payment-receipt-card";
import type { PurchaseRecord } from "@/lib/client-receipts";

type Props = {
  open: boolean;
  onClose: () => void;
  purchase: PurchaseRecord | null;
  variant?: "admin" | "client";
};

export function ReceiptPreviewModal({
  open,
  onClose,
  purchase,
  variant = "client",
}: Props) {
  if (!open || !purchase) return null;

  const panelClass =
    variant === "admin"
      ? "border border-white/10 bg-[#0F172A] shadow-2xl"
      : "border border-white/10 bg-[#0c0c16] shadow-2xl";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close receipt preview"
        className="absolute inset-0 z-0 bg-[#030308]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[78dvh] w-full max-w-lg flex-col rounded-t-3xl sm:max-h-[90dvh] sm:rounded-3xl ${panelClass}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Receipt preview</p>
            <p className="truncate text-sm font-bold text-white">{purchase.receiptNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt preview"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/15"
          >
            <X size={20} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center space-y-8 overflow-y-auto px-4 py-4 max-md:space-y-4 sm:px-5 sm:py-6">
          <div className="flex w-full flex-col items-center">
            <p className="mb-3 max-md:mb-2 text-center text-xs font-bold uppercase tracking-wide text-cyan-400/80">
              Payment Receipt
            </p>
            <PaymentReceiptCard receipt={purchase.paymentReceipt} downloadable />
          </div>

          {purchase.refundReceipt ? (
            <div className="flex w-full flex-col items-center">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-rose-400/80">
                Refund Receipt
              </p>
              <PaymentReceiptCard receipt={purchase.refundReceipt} downloadable />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
