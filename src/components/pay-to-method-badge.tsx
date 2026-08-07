"use client";

import {
  getCheckoutPaymentMethod,
  payToMethodDisplayLabel,
} from "@/lib/payment-methods-config";

type Props = {
  methodId?: string | null;
  label?: string | null;
};

export function PayToMethodBadge({ methodId, label }: Props) {
  const method = getCheckoutPaymentMethod(methodId);
  const name = payToMethodDisplayLabel(methodId, label);

  if (!name) {
    return <span className="text-slate-600">—</span>;
  }

  return (
    <span className="inline-flex min-w-0 max-w-full">
      <span
        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
          method?.theme.badge ?? "border-white/10 bg-white/5 text-slate-300"
        }`}
      >
        {method ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={method.logoUrl}
              alt=""
              width={16}
              height={16}
              className="h-full w-full object-contain"
            />
          </span>
        ) : null}
        <span className="truncate">{name}</span>
      </span>
    </span>
  );
}
