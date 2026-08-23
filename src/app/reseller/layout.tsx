import { ReactNode } from "react";
import { getResellerSession } from "@/lib/reseller-session";
import { ResellerLogin } from "@/components/reseller-login";
import { ResellerSidebar } from "@/components/reseller-sidebar";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function ResellerLayout({ children }: { children: ReactNode }) {
  let reseller = null;
  try {
    reseller = await getResellerSession();
  } catch (error) {
    console.error("Reseller auth check failed:", error);
  }

  if (!reseller) {
    return <ResellerLogin />;
  }

  return (
    <div className="fixed inset-0 z-40 flex min-w-0 flex-col overflow-hidden overscroll-none bg-[#080810] font-sans text-slate-200 selection:bg-cyan-500/30 lg:flex-row">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute right-[-10%] top-[-20%] h-[600px] w-[800px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>
      <ResellerSidebar brandName={reseller.brandName} />
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-none">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-none p-3 max-lg:px-0 max-lg:pb-0 max-lg:pt-0 sm:p-5 lg:overflow-x-hidden lg:overflow-y-auto lg:p-8 lg:pb-0">
          <AdminShell>{children}</AdminShell>
        </div>
      </main>
    </div>
  );
}
