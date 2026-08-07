"use client";

import { ReactNode } from "react";
import { AdminToastProvider } from "@/components/admin-toast";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminToastProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-visible md:min-h-0 md:overflow-hidden">{children}</div>
    </AdminToastProvider>
  );
}
