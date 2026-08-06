"use client";

import { Calendar } from "lucide-react";

type AdminDateTimeInputProps = {
  value: string;
  onChange: (isoValue: string) => void;
  disabled?: boolean;
  id?: string;
};

export function isoToLocalInputValue(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function localInputToIso(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}

export function AdminDateTimeInput({ value, onChange, disabled = false, id }: AdminDateTimeInputProps) {
  return (
    <div className={`relative ${disabled ? "opacity-60" : ""}`}>
      <input
        id={id}
        type="datetime-local"
        disabled={disabled}
        value={isoToLocalInputValue(value)}
        onChange={(event) => onChange(localInputToIso(event.target.value))}
        className="admin-datetime-input w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 pr-11 text-sm font-medium text-slate-100 outline-none transition-all hover:border-white/20 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:hover:border-white/10"
      />
      <Calendar
        aria-hidden
        className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
          disabled ? "text-slate-600" : "text-cyan-400"
        }`}
      />
    </div>
  );
}
