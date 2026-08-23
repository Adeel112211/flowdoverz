"use client";

import { createContext, useContext, type ReactNode } from "react";
import { resellerNavPaths, type ResellerNavPaths } from "@/lib/reseller-panel-paths";

const ResellerNavContext = createContext<ResellerNavPaths>(resellerNavPaths(false));

export function ResellerNavProvider({
  atDedicatedHost,
  children,
}: {
  atDedicatedHost: boolean;
  children: ReactNode;
}) {
  return (
    <ResellerNavContext.Provider value={resellerNavPaths(atDedicatedHost)}>
      {children}
    </ResellerNavContext.Provider>
  );
}

export function useResellerNav() {
  return useContext(ResellerNavContext);
}
