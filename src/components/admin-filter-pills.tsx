type AdminFilterPillsProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (val: T) => void;
  formatLabel?: (option: T) => string;
  className?: string;
};

export function AdminFilterPills<T extends string>({
  options,
  value,
  onChange,
  formatLabel,
  className = "",
}: AdminFilterPillsProps<T>) {
  return (
    <div
      className={`flex w-full max-w-full overflow-x-auto gap-1.5 rounded-2xl border border-white/10 bg-[#0F172A]/80 p-1 shadow-2xl backdrop-blur-xl sm:w-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${className}`}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-none rounded-xl px-3 py-2 text-xs font-bold capitalize leading-tight transition-all whitespace-nowrap max-md:min-h-10 sm:px-4 sm:py-2.5 sm:text-sm ${
            value === option
              ? "bg-cyan-500 text-slate-900 shadow-[0_0_20px_-3px_rgba(34,211,238,0.4)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {formatLabel ? formatLabel(option) : option}
        </button>
      ))}
    </div>
  );
}
