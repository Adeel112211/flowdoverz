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

    if (session?.sid) {
      document.cookie = `flowdoverz_sid=${encodeURIComponent(session.sid)}; path=/; SameSite=Lax; max-age=2592000`;
    }
  }, [session]);

  return (
    <div
      id="flowdoverz-auth-bridge"
      data-logged-in={session ? "1" : "0"}
      data-email={session?.email ?? ""}
      data-days={String(daysRemaining)}
      data-sid={session?.sid ?? ""}
      data-base-url={baseUrl}
      hidden
      aria-hidden="true"
    />
  );
}
