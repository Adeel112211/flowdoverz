"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/auth";
import { notifySessionChange } from "@/lib/auth";

type AuthBridgeProps = {
  session: Session | null;
  daysRemaining?: number;
};

const SESSION_KEY = "flowdoverz_session";

/** Invisible DOM bridge the Chrome extension reads to detect portal login. */
export function AuthBridge({ session, daysRemaining = 14 }: AuthBridgeProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const reloadGuardRef = useRef(false);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!session) return;

    const markPossibleReload = (event: KeyboardEvent) => {
      if (event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")) {
        reloadGuardRef.current = true;
        window.setTimeout(() => {
          reloadGuardRef.current = false;
        }, 2500);
      }
    };

    const endSessionOnClose = (event: PageTransitionEvent) => {
      // Keep session on back-forward cache and on refresh.
      if (event.persisted || reloadGuardRef.current) return;

      try {
        window.localStorage.removeItem(SESSION_KEY);
        notifySessionChange();
      } catch {
        // ignore
      }

      try {
        if (typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon("/api/auth/logout");
          return;
        }
      } catch {
        // fall through
      }

      void fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("keydown", markPossibleReload);
    window.addEventListener("pagehide", endSessionOnClose);
    return () => {
      window.removeEventListener("keydown", markPossibleReload);
      window.removeEventListener("pagehide", endSessionOnClose);
    };
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
