import { ReactNode } from "react";

type AdminPageLayoutProps = {
  header: ReactNode;
  children: ReactNode;
  /** When false, children handle their own scroll (e.g. AdminDataTable). Default: true */
  scrollContent?: boolean;
  /** When true with scrollContent=false, disable scrolling on all breakpoints (e.g. dashboard). */
  lockScroll?: boolean;
};

export function AdminPageLayout({
  header,
  children,
  scrollContent = true,
  lockScroll = false,
}: AdminPageLayoutProps) {
  return (
    <div className="relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-4 md:gap-6 max-md:overflow-visible md:overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />
      <div className="shrink-0 flex-none w-full max-md:sticky max-md:top-0 max-md:z-20">{header}</div>
      <div
        className={
          scrollContent
            ? "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pt-1 pb-4 max-md:px-3 md:pt-2 md:pb-6 md:px-0"
            : lockScroll
              ? "flex min-h-0 flex-1 flex-col overflow-hidden pt-1 max-md:px-3 md:pt-2 md:px-0"
              : "flex min-h-0 flex-1 flex-col overflow-x-hidden pt-1 max-md:overflow-y-auto max-md:px-3 md:overflow-hidden md:pt-2 md:px-0"
        }
      >
        {children}
      </div>
    </div>
  );
}
