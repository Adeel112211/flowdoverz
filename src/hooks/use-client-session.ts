"use client";

import { useSyncExternalStore } from "react";
import { getSession, subscribeSession, type Session } from "@/lib/auth";

export function useClientSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}
