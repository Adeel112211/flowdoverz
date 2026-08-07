import { ReactNode } from "react";
import { isAdminUiRequest } from "@/lib/admin";
import { AdminLogin } from "@/components/admin-login";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let isAdmin = false;
  try {
    isAdmin = await isAdminUiRequest();
  } catch (error) {
    console.error("Admin auth check failed:", error);
  }

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#080810] px-4 py-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        </div>
        <div className="relative z-10 w-full max-w-md max-h-full overflow-y-auto overscroll-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <AdminLogin />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh overflow-hidden flex-col md:flex-row bg-[#080810] text-slate-200 selection:bg-cyan-500/30 font-sans">
      {/* Massive Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] h-[600px] w-[800px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <AdminSidebar />
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-md:px-0 max-md:pt-0 max-md:pb-0 p-3 sm:p-6 md:overflow-x-hidden md:overflow-y-auto md:p-8 md:pb-0">
          <AdminShell>{children}</AdminShell>
        </div>
      </main>
    </div>
  );
}
