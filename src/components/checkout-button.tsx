"use client";

import Link from "next/link";

export function CheckoutButton({ planId, featured }: { planId: string; featured: boolean }) {
  return (
    <Link
      href={`/checkout/${planId}`}
      className={`block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold transition-transform hover:-translate-y-px ${
        featured
          ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950"
          : "border border-white/10 text-slate-200 hover:bg-white/5"
      }`}
    >
      Purchase
    </Link>
  );
}
