import { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="mb-6 sm:mb-8 flex-none flex flex-col gap-2 rounded-xl border border-white/10 sm:border-0 sm:border-b bg-gradient-to-br from-[#0F172A] to-[#1e293b]/50 border-white/10 p-4 sm:p-6 md:p-8 lg:px-12 shadow-2xl relative w-full max-w-full overflow-visible">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/10 blur-[100px] rounded-full -mt-20 -mr-20" />
      </div>

      <div className="relative z-20 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 break-words">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm sm:text-base lg:text-lg text-slate-400 break-words">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="relative z-30 w-full sm:w-auto shrink-0 min-w-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
