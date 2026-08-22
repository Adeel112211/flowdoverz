"use client";

import { useEffect, useRef } from "react";
import { subscribeLive } from "@/lib/live-client";

type AdminLiveRefreshOptions = {
  intervalMs?: number;
  enabled?: boolean;
  pauseWhenHidden?: boolean;
};

/**
 * Live refresh over a shared WebSocket (SSE fallback in local `next dev`).
 * Pages refetch only when server data actually changes.
 */
export function useAdminLiveRefresh(
  refresh: () => void | Promise<void>,
  deps: unknown[] = [],
  options: AdminLiveRefreshOptions = {},
) {
  const { enabled = true, pauseWhenHidden = true } = options;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (pauseWhenHidden && document.hidden) return;
      void refreshRef.current();
    };

    const unsub = subscribeLive(() => run());
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, pauseWhenHidden, ...deps]);
}
