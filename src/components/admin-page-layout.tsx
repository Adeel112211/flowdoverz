import { ReactNode } from "react";

type AdminPageLayoutProps = {
  header: ReactNode;
  children: ReactNode;
  /** When false, children handle their own scroll on desktop (e.g. AdminDataTable). Default: true */
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
  const contentClass = lockScroll
    ? "flex min-h-0 flex-1 flex-col overflow-hidden pt-1 max-md:px-3 md:pt-2 md:px-0"
    : scrollContent
      ? "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pt-1 pb-4 max-md:px-3 md:pt-2 md:pb-6 md:px-0"
      : // Mobile always scrolls the lower section; desktop keeps prior table/page behavior
        "flex min-h-0 flex-1 flex-col overflow-x-hidden pt-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-3 max-md:pb-4 md:overflow-hidden md:pt-2 md:px-0";

  return (
    <div className="relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden max-md:gap-0 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />
      <div className="w-full shrink-0 flex-none">{header}</div>
      <div className={contentClass}>{children}</div>
    </div>
  );
}
