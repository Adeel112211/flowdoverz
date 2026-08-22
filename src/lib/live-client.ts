"use client";

import type { LiveEvent } from "./live-tick";

type LiveHandler = (event: LiveEvent) => void;

const handlers = new Set<LiveHandler>();
const LAST_REV_KEY = "flowdoverz_live_rev";

let socket: WebSocket | null = null;
let source: EventSource | null = null;
let reconnectTimer = 0;
let useSse = false;
let attempt = 0;
let lastRev = 0;
let connecting = false;
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

function wsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/live/ws`;
}

function sseUrl() {
  return lastRev > 0 ? `/api/live?since=${encodeURIComponent(String(lastRev))}` : "/api/live";
}

function parseEvent(raw: string): LiveEvent | null {
  try {
    const event = JSON.parse(raw) as LiveEvent;
    if (!event || typeof event.type !== "string") return null;
    return event;
  } catch {
    return null;
  }
}

function dispatch(event: LiveEvent) {
  if (event.type === "ping") return;
  if (event.type === "hello") {
    requestMissed(event.rev);
    if (!lastRev) persistRev(event.rev);
    return;
  }
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

function requestMissed(serverRev: number) {
  if (!lastRev || lastRev >= serverRev) {
    persistRev(serverRev);
    return;
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify({ type: "since", rev: lastRev }));
    } catch {
      handlers.forEach((handler) =>
        handler({ type: "resync", rev: serverRev, at: new Date().toISOString() }),
      );
    }
  }
}

function disconnect() {
  window.clearTimeout(reconnectTimer);
  connecting = false;
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // ignore
    }
    socket = null;
  }
  if (source) {
    source.close();
    source = null;
  }
}

function reconnectDelay() {
  const exp = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
  const jitter = Math.floor(Math.random() * 400);
  return exp + jitter;
}

function scheduleReconnect() {
  if (handlers.size === 0) return;
  window.clearTimeout(reconnectTimer);
  const delay = reconnectDelay();
  attempt += 1;
  reconnectTimer = window.setTimeout(() => {
    if (handlers.size === 0) return;
    connect();
  }, delay);
}

function connectSse() {
  disconnect();
  useSse = true;
  connecting = true;
  source = new EventSource(sseUrl());
  source.onopen = () => {
    attempt = 0;
    connecting = false;
  };
  source.onmessage = (message) => {
    const event = parseEvent(message.data);
    if (event) dispatch(event);
  };
  source.onerror = () => {
    disconnect();
    scheduleReconnect();
  };
}

function connectWs() {
  disconnect();
  const next = new WebSocket(wsUrl());
  socket = next;
  connecting = true;
  let opened = false;
  next.onopen = () => {
    opened = true;
    attempt = 0;
    connecting = false;
    if (lastRev > 0) {
      try {
        next.send(JSON.stringify({ type: "since", rev: lastRev }));
      } catch {
        // hello path will retry
      }
    }
  };
  next.onmessage = (message) => {
    const event = parseEvent(String(message.data || ""));
    if (event) dispatch(event);
  };
  next.onerror = () => {
    if (!opened) useSse = true;
    next.close();
  };
  next.onclose = () => {
    socket = null;
    connecting = false;
    if (handlers.size === 0) return;
    if (useSse) {
      connectSse();
      return;
    }
    scheduleReconnect();
  };
}

function connect() {
  if (typeof window === "undefined" || handlers.size === 0 || connecting) return;
  if (useSse) {
    connectSse();
    return;
  }
  connectWs();
}

export function subscribeLive(handler: LiveHandler) {
  if (typeof window !== "undefined" && lastRev === 0) {
    lastRev = readStoredRev();
  }
  handlers.add(handler);
  if (handlers.size === 1) connect();
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) disconnect();
  };
}
