"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/lib/auth";

type AuthBridgeProps = {
  session: Session | null;
  daysRemaining?: number;
};

/** Invisible DOM bridge the Chrome extension reads to detect portal login. */
export function AuthBridge({ session, daysRemaining = 14 }: AuthBridgeProps) {
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!session) return;

    const pingSeat = () => {
      void fetch("/api/auth/me", { credentials: "include", cache: "no-store" }).catch(() => {});
    };
    pingSeat();
    const heartbeat = window.setInterval(pingSeat, 25_000);
    return () => window.clearInterval(heartbeat);
  }, [session]);

  return (
    <div
      id="flowdoverz-auth-bridge"
      data-logged-in={session ? "1" : "0"}
      data-email={session?.email ?? ""}
      data-days={String(daysRemaining)}
      data-base-url={baseUrl}
      hidden
      aria-hidden="true"
    />
  );
}
