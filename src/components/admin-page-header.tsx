import { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Override actions wrapper classes (e.g. mobile alignment on a specific page). */
  actionsClassName?: string;
};

export function AdminPageHeader({
  title,
  description,
  actions,
  actionsClassName,
}: AdminPageHeaderProps) {
  const actionsWrapClass =
    actionsClassName ??
    "relative z-30 w-full min-w-0 shrink-0 sm:w-auto max-md:[&>*]:w-full max-md:[&_button]:min-h-11";

  return (
    <div className="relative z-20 flex w-full max-w-full flex-none shrink-0 flex-col gap-2 overflow-visible rounded-xl border border-white/10 bg-gradient-to-br from-[#0F172A] to-[#1e293b]/50 p-4 shadow-2xl max-md:rounded-none max-md:border-x-0 max-md:p-3 sm:mb-0 sm:border-0 sm:border-b sm:p-6 md:p-8 lg:px-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/10 blur-[100px] rounded-full -mt-20 -mr-20" />
      </div>

      <div className="relative z-20 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 break-words max-md:text-xl max-md:leading-tight sm:text-3xl lg:text-4xl xl:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-slate-400 break-words max-md:mt-1.5 max-md:text-xs max-md:leading-relaxed sm:text-base lg:text-lg">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className={actionsWrapClass}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
