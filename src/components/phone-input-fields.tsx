"use client";

import { PHONE_COUNTRIES, DEFAULT_PHONE_COUNTRY_ISO, digitsOnly } from "@/lib/phone";

const selectClass =
  "shrink-0 max-w-[42%] rounded-2xl border border-white/10 bg-white/5 px-3 py-3.5 text-sm text-white outline-none transition-all duration-300 focus:border-cyan-400 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20 sm:max-w-[11.5rem]";
const inputClass =
  "min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20";

type PhoneInputFieldsProps = {
  countryIso: string;
  nationalNumber: string;
  onCountryIsoChange: (iso: string) => void;
  onNationalNumberChange: (value: string) => void;
  required?: boolean;
  idPrefix?: string;
  selectClassName?: string;
  inputClassName?: string;
};

export function PhoneInputFields({
  countryIso,
  nationalNumber,
  onCountryIsoChange,
  onNationalNumberChange,
  required = true,
  idPrefix = "phone",
  selectClassName = selectClass,
  inputClassName = inputClass,
}: PhoneInputFieldsProps) {
  return (
    <div>
      <label htmlFor={`${idPrefix}-national`} className="mb-1.5 block text-sm font-medium text-slate-300">
        Phone number
      </label>
      <div className="flex gap-2">
        <select
          id={`${idPrefix}-country`}
          name="phoneCountryIso"
          required={required}
          value={countryIso || DEFAULT_PHONE_COUNTRY_ISO}
          onChange={(e) => onCountryIsoChange(e.target.value)}
          className={selectClassName}
          aria-label="Country code"
        >
          {PHONE_COUNTRIES.map((country) => (
            <option key={country.iso} value={country.iso} className="bg-[#0c0c16] text-white">
              {country.iso} {country.dial}
            </option>
          ))}
        </select>
        <input
          id={`${idPrefix}-national`}
          name="phoneNational"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          value={nationalNumber}
          onChange={(e) => onNationalNumberChange(digitsOnly(e.target.value).slice(0, 15))}
          placeholder="3001234567"
          className={inputClassName}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">Select your country code, then enter the number without leading 0.</p>
    </div>
  );
}
