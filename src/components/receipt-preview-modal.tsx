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
      ? "rounded-3xl border border-white/10 bg-[#0F172A] shadow-2xl"
      : "rounded-3xl border border-white/10 bg-[#0c0c16] shadow-2xl";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close receipt preview"
        className="absolute inset-0 bg-[#030308]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative max-h-[92dvh] w-full max-w-lg overflow-y-auto ${panelClass}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-inherit px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Receipt preview</p>
            <p className="text-sm font-bold text-white">{purchase.receiptNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center space-y-8 px-5 py-6">
          <div className="flex w-full flex-col items-center">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-cyan-400/80">
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
