"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/auth";
import { notifySessionChange } from "@/lib/auth";

type AuthBridgeProps = {
  session: Session | null;
  daysRemaining?: number;
};

const SESSION_KEY = "flowdoverz_session";
const TAB_REGISTRY_KEY = "flowdoverz_auth_tabs";

function readSessionSid(): string | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sid?: string } | null;
    return typeof parsed?.sid === "string" && parsed.sid.includes("|") ? parsed.sid : null;
  } catch {
    return null;
  }
}

function registerTab(tabId: string) {
  try {
    const raw = window.localStorage.getItem(TAB_REGISTRY_KEY);
    const tabs = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    tabs[tabId] = Date.now();
    window.localStorage.setItem(TAB_REGISTRY_KEY, JSON.stringify(tabs));
  } catch {
    // ignore
  }
}

function unregisterTab(tabId: string): boolean {
  try {
    const raw = window.localStorage.getItem(TAB_REGISTRY_KEY);
    const tabs = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    delete tabs[tabId];
    const now = Date.now();
    // Drop stale tab markers (crashed tabs).
    for (const [id, seenAt] of Object.entries(tabs)) {
      if (now - Number(seenAt) > 60_000) delete tabs[id];
    }
    window.localStorage.setItem(TAB_REGISTRY_KEY, JSON.stringify(tabs));
    return Object.keys(tabs).length === 0;
  } catch {
    return true;
  }
}

function releaseSeatBeacon(sid: string | null) {
  if (!sid) {
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
    return;
  }

  try {
    const body = new Blob([JSON.stringify({ sid })], { type: "application/json" });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/auth/logout", body)) {
      return;
    }
  } catch {
    // fall through
  }

  void fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sid }),
  }).catch(() => {});
}

/** Invisible DOM bridge the Chrome extension reads to detect portal login. */
export function AuthBridge({ session, daysRemaining = 14 }: AuthBridgeProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const reloadGuardRef = useRef(false);
  const tabIdRef = useRef(`tab_${Math.random().toString(36).slice(2)}_${Date.now()}`);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!session) return;

    const tabId = tabIdRef.current;
    registerTab(tabId);
    const heartbeat = window.setInterval(() => registerTab(tabId), 20_000);

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

      const sid = readSessionSid();
      const lastTab = unregisterTab(tabId);

      // Only free the Solo seat when this was the last open portal tab.
      if (!lastTab) return;

      try {
        window.localStorage.removeItem(SESSION_KEY);
        notifySessionChange();
      } catch {
        // ignore
      }

      releaseSeatBeacon(sid);
    };

    window.addEventListener("keydown", markPossibleReload);
    window.addEventListener("pagehide", endSessionOnClose);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("keydown", markPossibleReload);
      window.removeEventListener("pagehide", endSessionOnClose);
      unregisterTab(tabId);
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
