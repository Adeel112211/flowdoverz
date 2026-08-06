"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export const ADMIN_PLAN_OPTIONS = [
  { value: "trial", label: "Trial", description: "Free trial access" },
  { value: "pending", label: "Pending", description: "Awaiting payment approval" },
  { value: "solo", label: "Solo", description: "Single creator plan" },
  { value: "team", label: "Team", description: "Up to 3 accounts" },
] as const;

type AdminPlanSelectProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function normalizePlanValue(plan?: string) {
  if (!plan || plan === "none") return "trial";
  if (plan === "studio" || plan === "nano") return "solo";
  if (plan === "ultra") return "team";
  return plan;
}

export function AdminPlanSelect({ value, onChange, id }: AdminPlanSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedValue = normalizePlanValue(value);

  useEffect(() => {
    if (!open) return;

    const onOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const selected =
    ADMIN_PLAN_OPTIONS.find((option) => option.value === normalizedValue) ??
    ADMIN_PLAN_OPTIONS[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`w-full rounded-xl border bg-[#080810] px-4 py-3 pr-11 text-left text-sm font-medium outline-none transition-all ${
          open
            ? "border-cyan-400 text-cyan-50 ring-1 ring-cyan-400"
            : "border-white/10 text-white hover:border-white/20"
        }`}
      >
        <span className="block truncate">{selected.label}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform duration-200 ${
            open ? "rotate-180 text-cyan-400" : "text-slate-400"
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-[60] mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="py-1">
            {ADMIN_PLAN_OPTIONS.map((option) => {
              const active = option.value === normalizedValue;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                    active
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="text-xs text-slate-500">{option.description}</div>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-cyan-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
