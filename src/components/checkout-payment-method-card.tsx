"use client";

import { useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { checkoutQrSrc, type CheckoutPaymentMethod } from "@/lib/payment-methods-config";

function MethodLogo({ method }: { method: CheckoutPaymentMethod }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={method.logoUrl}
        alt={`${method.name} logo`}
        width={40}
        height={40}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function DetailRow({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value.replace(/-/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`flex items-center justify-between gap-4 border-b border-white/[0.06] last:border-b-0 ${compact ? "py-2" : "py-3"}`}>
      <span className={`shrink-0 text-slate-500 ${compact ? "text-xs" : "text-sm"}`}>{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`truncate text-right font-semibold text-white ${compact ? "text-xs" : "text-sm"}`}>{value}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-cyan-300"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function SelectionCircle({
  selected,
  ringClass,
  dotClass,
}: {
  selected: boolean;
  ringClass: string;
  dotClass: string;
}) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        selected ? ringClass : "border-white/25"
      }`}
      aria-hidden
    >
      {selected ? <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} /> : null}
    </span>
  );
}

export function CheckoutPaymentMethodCard({
  method,
  amountLabel,
  selected,
  onSelect,
  compact = false,
}: {
  method: CheckoutPaymentMethod;
  amountLabel: string;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const t = method.theme;
  const qrSrc = checkoutQrSrc(method);
  const panelId = `payment-method-${method.id}`;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-[#0a0a12]/95 transition-all duration-300 ${t.border} ${
        selected ? "shadow-[0_0_24px_rgba(0,0,0,0.35)]" : "hover:border-white/20"
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.glow}`} />

      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        aria-controls={panelId}
        className={`relative flex w-full items-center gap-3 text-left ${compact ? "px-3 py-3 sm:px-4" : "px-4 py-4 sm:px-5"}`}
      >
        <MethodLogo method={method} />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-black text-white">{method.name}</h3>
        </div>

        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide sm:text-sm ${t.badge}`}>
          {amountLabel}
        </span>

        <SelectionCircle selected={selected} ringClass={t.selectRing} dotClass={t.selectDot} />
      </button>

      <div
        id={panelId}
        className={`relative grid transition-[grid-template-rows] duration-300 ease-in-out ${
          selected ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.06] px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
            <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between ${compact ? "gap-3" : "gap-5"}`}>
              <div className="min-w-0 flex-1">
                <DetailRow label="Account Name:" value={method.accountName} compact={compact} />
                <DetailRow label="Account Number:" value={method.accountNumber} compact={compact} />
              </div>

              {qrSrc ? (
                <div className="flex shrink-0 flex-col items-center sm:pt-1">
                  <div className={`rounded-2xl bg-[#0d1118] p-2 ring-1 ${t.qrRing}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrSrc}
                      alt={`${method.name} payment QR`}
                      width={compact ? 96 : 132}
                      height={compact ? 96 : 132}
                      className={`block rounded-xl object-contain ${compact ? "h-24 w-24" : "h-[132px] w-[132px]"}`}
                    />
                  </div>
                  {!compact ? (
                    <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <QrCode className="h-3.5 w-3.5 shrink-0" />
                      {method.qrImageUrl ? "Scan to pay" : "Temporary QR · replace with your wallet QR"}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CheckoutPaymentMethods({
  methods,
  amountLabel,
  selectedId,
  onSelect,
  compact = false,
}: {
  methods: CheckoutPaymentMethod[];
  amountLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      {methods.map((method) => (
        <CheckoutPaymentMethodCard
          key={method.id}
          method={method}
          amountLabel={amountLabel}
          selected={selectedId === method.id}
          onSelect={() => onSelect(method.id)}
          compact={compact}
        />
      ))}
    </div>
  );
}
