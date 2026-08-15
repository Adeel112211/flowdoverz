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
    for (const [id, seenAt] of Object.entries(tabs)) {
      if (now - Number(seenAt) > 60_000) delete tabs[id];
    }
    window.localStorage.setItem(TAB_REGISTRY_KEY, JSON.stringify(tabs));
    return Object.keys(tabs).length === 0;
  } catch {
    return true;
  }
}

/** End server session + free Solo seat when the last portal tab closes. */
function expireSessionOnTabClose(sid: string | null) {
  const logoutFetch = (body?: BodyInit, contentType?: string) => {
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: contentType ? { "Content-Type": contentType } : undefined,
      body,
    }).catch(() => {});
  };

  if (!sid) {
    try {
      if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/auth/logout")) {
        return;
      }
    } catch {
      // fall through
    }
    logoutFetch();
    return;
  }

  try {
    const form = new FormData();
    form.append("sid", sid);
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/auth/logout", form)) {
      return;
    }
  } catch {
    // fall through
  }

  logoutFetch(JSON.stringify({ sid }), "application/json");
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
    const pingSeat = () => {
      registerTab(tabId);
      void fetch("/api/auth/me", { credentials: "include", cache: "no-store" }).catch(() => {});
    };
    pingSeat();
    const heartbeat = window.setInterval(pingSeat, 25_000);

    const markPossibleReload = (event: KeyboardEvent) => {
      if (event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")) {
        reloadGuardRef.current = true;
        window.setTimeout(() => {
          reloadGuardRef.current = false;
        }, 2500);
      }
    };

    const endSessionOnClose = (event: PageTransitionEvent) => {
      // Keep session on back-forward cache and on refresh (F5 / Ctrl+R).
      if (event.persisted || reloadGuardRef.current) return;

      const sid = readSessionSid();
      const lastTab = unregisterTab(tabId);
      if (!lastTab) return;

      try {
        window.localStorage.removeItem(SESSION_KEY);
        window.localStorage.removeItem(TAB_REGISTRY_KEY);
        notifySessionChange();
      } catch {
        // ignore
      }

      expireSessionOnTabClose(sid);
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
