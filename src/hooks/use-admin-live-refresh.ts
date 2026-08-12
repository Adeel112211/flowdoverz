"use client";

import { useEffect, useRef } from "react";

type AdminLiveRefreshOptions = {
  intervalMs?: number;
  enabled?: boolean;
  pauseWhenHidden?: boolean;
};

/**
 * Light live refresh for admin pages.
 * Default: every 60s, paused while the tab is hidden.
 */
export function useAdminLiveRefresh(
  refresh: () => void | Promise<void>,
  deps: unknown[] = [],
  options: AdminLiveRefreshOptions = {},
) {
  const { intervalMs = 60_000, enabled = true, pauseWhenHidden = true } = options;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const run = () => {
      if (!active) return;
      if (pauseWhenHidden && document.hidden) return;
      void refreshRef.current();
    };

    const id = window.setInterval(run, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs, pauseWhenHidden, ...deps]);
}
