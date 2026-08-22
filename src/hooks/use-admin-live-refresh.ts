"use client";

import { useEffect, useRef } from "react";
import { subscribeLive } from "@/lib/live-client";
import type { LiveEvent } from "@/lib/live-tick";

type AdminLiveRefreshOptions = {
  enabled?: boolean;
  pauseWhenHidden?: boolean;
  topics?: string[];
  /** Collapse a burst of ticks into one callback (metrics/alerts). */
  debounceMs?: number;
  ignoreActions?: string[];
};

function topicMatches(event: LiveEvent, topics?: string[]) {
  if (!topics || topics.length === 0) return true;
  if (event.type === "resync") return true;
  const topic = String(event.topic || "");
  return topics.some(
    (wanted) =>
      wanted === topic ||
      (wanted === "user" && topic === "users") ||
      (wanted === "payment" && topic === "payments"),
  );
}

function eventKey(event: LiveEvent) {
  return `${event.type}:${event.topic || ""}:${event.action || ""}:${event.id || event.userId || ""}`;
}

/**
 * Shared WebSocket (SSE fallback) refresh. Pages receive the event so they can
 * patch one record instead of refetching whole collections.
 */
export function useAdminLiveRefresh(
  refresh: (event: LiveEvent) => void | Promise<void>,
  deps: unknown[] = [],
  options: AdminLiveRefreshOptions = {},
) {
  const { enabled = true, pauseWhenHidden = true, topics, debounceMs = 50, ignoreActions } = options;
  const refreshRef = useRef(refresh);
  const topicsRef = useRef(topics);
  const ignoreRef = useRef(ignoreActions);
  const queuedHiddenRef = useRef<LiveEvent[]>([]);
  const burstRef = useRef<LiveEvent[]>([]);
  const burstTimerRef = useRef(0);

  useEffect(() => {
    refreshRef.current = refresh;
    topicsRef.current = topics;
    ignoreRef.current = ignoreActions;
  }, [refresh, topics, ignoreActions]);

  useEffect(() => {
    if (!enabled) return;

    const flushBurst = () => {
      const burst = burstRef.current;
      burstRef.current = [];
      if (burst.length === 0) return;
      if (burst.some((event) => event.type === "resync")) {
        void refreshRef.current({
          type: "resync",
          rev: burst[burst.length - 1]?.rev || 0,
          at: new Date().toISOString(),
        });
        return;
      }
      if (debounceMs >= 100) {
        void refreshRef.current(burst[burst.length - 1]);
        return;
      }
      const seen = new Set<string>();
      for (const event of burst) {
        const key = eventKey(event);
        if (seen.has(key)) continue;
        seen.add(key);
        void refreshRef.current(event);
      }
    };

    const run = (event: LiveEvent) => {
      if (!topicMatches(event, topicsRef.current)) return;
      if (event.action && ignoreRef.current?.includes(event.action)) return;
      if (pauseWhenHidden && document.hidden) {
        queuedHiddenRef.current = [...queuedHiddenRef.current, event].slice(-20);
        return;
      }
      burstRef.current.push(event);
      window.clearTimeout(burstTimerRef.current);
      burstTimerRef.current = window.setTimeout(flushBurst, debounceMs);
    };

    const unsub = subscribeLive(run);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const queued = queuedHiddenRef.current;
      queuedHiddenRef.current = [];
      if (queued.length === 0) return;
      if (queued.length >= 20 || queued.some((event) => event.type === "resync")) {
        void refreshRef.current({
          type: "resync",
          rev: queued[queued.length - 1]?.rev || 0,
          at: new Date().toISOString(),
        });
        return;
      }
      for (const event of queued) run(event);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsub();
      window.clearTimeout(burstTimerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, pauseWhenHidden, debounceMs, ...deps]);
}
