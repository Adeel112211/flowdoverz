type AdminFilterPillsProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (val: T) => void;
};

export function AdminFilterPills<T extends string>({
  options,
  value,
  onChange,
}: AdminFilterPillsProps<T>) {
  return (
    <div className="flex w-full sm:w-auto overflow-x-auto gap-1.5 p-1 bg-[#0F172A]/80 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-none px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold capitalize text-center leading-tight transition-all whitespace-nowrap ${
            value === option
              ? "bg-cyan-500 text-slate-900 shadow-[0_0_20px_-3px_rgba(34,211,238,0.4)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
