"use client";

import { ReactNode, useEffect } from "react";
import { AdminToastProvider } from "@/components/admin-toast";

/**
 * Locks document scroll for installed PWAs / in-app browsers where the
 * whole page can scroll even when nested panels use overflow-hidden.
 */
function useAdminViewportLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyTouchAction: body.style.touchAction,
    };

    html.classList.add("admin-app-active");
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "manipulation";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      html.classList.remove("admin-app-active");
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.touchAction = prev.bodyTouchAction;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);
}

export function AdminShell({ children }: { children: ReactNode }) {
  useAdminViewportLock();

  return (
    <AdminToastProvider>
      <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden overscroll-none">
        {children}
      </div>
    </AdminToastProvider>
  );
}
