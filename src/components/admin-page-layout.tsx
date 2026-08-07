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
    ? "flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none pt-1 max-md:px-3 md:pt-2 md:px-0"
    : scrollContent
      ? "admin-panel-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pt-1 pb-4 max-md:px-3 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:pt-2 md:pb-6 md:px-0"
      : "admin-panel-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overscroll-contain pt-1 max-md:overflow-y-auto max-md:px-3 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:overflow-hidden md:pt-2 md:px-0";

  return (
    <div className="relative flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden overscroll-none max-md:gap-0 md:gap-6 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-700">
      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />
      <div className="w-full shrink-0 flex-none">{header}</div>
      <div className={contentClass}>{children}</div>
    </div>
  );
}
