"use client";

import type { LiveEvent } from "./live-tick";

type LiveHandler = (event: LiveEvent) => void;

const handlers = new Set<LiveHandler>();
let socket: WebSocket | null = null;
let source: EventSource | null = null;
let reconnectTimer = 0;
let useSse = false;

function wsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/live/ws`;
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
  if (event.type === "ping" || event.type === "hello") return;
  handlers.forEach((handler) => handler(event));
}

function disconnect() {
  window.clearTimeout(reconnectTimer);
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  if (source) {
    source.close();
    source = null;
  }
}

function scheduleReconnect() {
  if (handlers.size === 0) return;
  window.clearTimeout(reconnectTimer);
  reconnectTimer = window.setTimeout(() => {
    if (handlers.size === 0) return;
    connect();
  }, 1500);
}

function connectSse() {
  disconnect();
  useSse = true;
  source = new EventSource("/api/live");
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
  let opened = false;
  next.onopen = () => {
    opened = true;
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
    if (handlers.size === 0) return;
    if (useSse) {
      connectSse();
      return;
    }
    scheduleReconnect();
  };
}

function connect() {
  if (typeof window === "undefined" || handlers.size === 0) return;
  if (useSse) {
    connectSse();
    return;
  }
  connectWs();
}

export function subscribeLive(handler: LiveHandler) {
  handlers.add(handler);
  if (handlers.size === 1) connect();
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) disconnect();
  };
}
