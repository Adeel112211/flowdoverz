export function getPlanStyles(planId: string) {
  const normalized = (planId || "").toLowerCase();

  let label = planId;
  let bgClass = "bg-white/5";
  let borderClass = "border-white/10";
  let textClass = "text-slate-300";

  if (normalized.includes("trial") || normalized === "free") {
    label = "Trial";
    bgClass = "bg-slate-500/10";
    borderClass = "border-slate-500/20";
    textClass = "text-slate-300";
  } else if (normalized.includes("solo") || normalized === "nano" || normalized === "studio") {
    label = "Solo";
    bgClass = "bg-cyan-500/10";
    borderClass = "border-cyan-500/20";
    textClass = "text-cyan-400";
  } else if (normalized.includes("ultra") || normalized === "team") {
    label = "Team";
    bgClass = "bg-violet-500/10";
    borderClass = "border-violet-500/20";
    textClass = "text-violet-400";
  }

  return { label, bgClass, borderClass, textClass };
}

export function PlanBadge({ planId }: { planId: string }) {
  const { label, bgClass, borderClass, textClass } = getPlanStyles(planId);

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${bgClass} ${borderClass} ${textClass}`}
    >
      {label}
    </span>
  );
}

export function PlanAmount({ planId, amount }: { planId: string; amount: string }) {
  const { textClass } = getPlanStyles(planId);
  return <span className={`font-semibold ${textClass}`}>{amount}</span>;
}
