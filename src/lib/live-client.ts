"use client";

import type { LiveEvent } from "./live-tick";

type LiveHandler = (event: LiveEvent) => void;

const handlers = new Set<LiveHandler>();
const LAST_REV_KEY = "flowdoverz_live_rev";
const POLL_MS = 12_000;

let pollTimer = 0;
let lastRev = 0;
let inFlight = false;
const lastTickByKey = new Map<string, number>();

function readStoredRev() {
  try {
    const stored = Number(sessionStorage.getItem(LAST_REV_KEY) || 0);
    return Number.isFinite(stored) ? stored : 0;
  } catch {
    return 0;
  }
}

function persistRev(rev: number) {
  lastRev = Math.max(lastRev, rev);
  try {
    sessionStorage.setItem(LAST_REV_KEY, String(lastRev));
  } catch {
    // ignore quota / private mode
  }
}

function parseEvent(raw: unknown): LiveEvent | null {
  try {
    const event = raw as LiveEvent;
    if (!event || typeof event.type !== "string") return null;
    return event;
  } catch {
    return null;
  }
}

function dispatch(event: LiveEvent) {
  if (event.type === "ping" || event.type === "hello") return;
  if (event.type === "tick") {
    const key = `${event.topic || ""}:${event.id || event.userId || ""}`;
    const prev = lastTickByKey.get(key) || 0;
    if (event.rev && event.rev <= prev) return;
    if (event.rev) lastTickByKey.set(key, event.rev);
    if (lastTickByKey.size > 500) {
      const oldest = lastTickByKey.keys().next().value;
      if (oldest) lastTickByKey.delete(oldest);
    }
  }
  if (event.rev) persistRev(event.rev);
  handlers.forEach((handler) => handler(event));
}

async function poll() {
  if (typeof window === "undefined" || handlers.size === 0 || inFlight) return;
  if (document.hidden) return;
  inFlight = true;
  try {
    const url = lastRev > 0 ? `/api/live?since=${encodeURIComponent(String(lastRev))}` : "/api/live";
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      resync?: boolean;
      rev?: number;
      at?: string;
      events?: LiveEvent[];
    };
    const rev = Number(data.rev || 0);
    const at = String(data.at || new Date().toISOString());
    if (data.resync) {
      persistRev(rev);
      dispatch({ type: "resync", rev, at });
      return;
    }
    for (const item of data.events || []) {
      const event = parseEvent(item);
      if (event) dispatch(event);
    }
    if (rev) persistRev(rev);
  } catch {
    // try again on the next interval
  } finally {
    inFlight = false;
  }
}

function stopPolling() {
  window.clearInterval(pollTimer);
  pollTimer = 0;
}

function startPolling() {
  if (pollTimer) return;
  void poll();
  pollTimer = window.setInterval(() => {
    void poll();
  }, POLL_MS);
}

function onVisibility() {
  if (document.visibilityState === "visible") void poll();
}

export function subscribeLive(handler: LiveHandler) {
  if (typeof window !== "undefined" && lastRev === 0) {
    lastRev = readStoredRev();
  }
  handlers.add(handler);
  if (handlers.size === 1) {
    document.addEventListener("visibilitychange", onVisibility);
    startPolling();
  }
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      document.removeEventListener("visibilitychange", onVisibility);
      stopPolling();
    }
  };
}
