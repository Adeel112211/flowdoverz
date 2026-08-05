import { ReactNode } from "react";
import { isAdminUiRequest } from "@/lib/admin";
import { AdminLogin } from "@/components/admin-login";
import { AdminSidebar } from "@/components/admin-sidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const isAdmin = await isAdminUiRequest();

  if (!isAdmin) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#080810] px-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          <AdminLogin />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh md:h-dvh md:overflow-hidden flex-col md:flex-row overflow-x-hidden bg-[#080810] text-slate-200 selection:bg-cyan-500/30 font-sans">
      {/* Massive Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] h-[600px] w-[800px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <AdminSidebar />
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden md:h-dvh md:overflow-hidden">
        <div className="flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8 md:pb-0 md:h-full md:flex md:flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
