"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/lib/auth";
import { DEFAULT_SUBSCRIPTION_DAYS } from "@/lib/pricing-config";

type AuthBridgeProps = {
  session: Session | null;
  daysRemaining?: number;
};

type StatusPayload = {
  active?: boolean;
  trialActive?: boolean;
  subscriptionActive?: boolean;
  trialExpiresAt?: string | null;
  subscriptionExpiresAt?: string | null;
  subscriptionPlan?: string;
};

function daysUntilExpiry(status: StatusPayload, now = Date.now()) {
  const plan = String(status.subscriptionPlan || "none").toLowerCase();
  const expiryStr =
    plan === "trial" || status.trialActive
      ? status.trialExpiresAt
      : status.subscriptionActive && plan && !["none", "trial", "pending"].includes(plan)
        ? status.subscriptionExpiresAt
        : status.trialExpiresAt || status.subscriptionExpiresAt;
  if (!expiryStr) return 0;
  const expiry = new Date(expiryStr).getTime();
  if (!Number.isFinite(expiry)) return 0;
  return Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
}

function hoursUntilExpiry(status: StatusPayload, now = Date.now()) {
  const plan = String(status.subscriptionPlan || "none").toLowerCase();
  const expiryStr =
    plan === "trial" || status.trialActive
      ? status.trialExpiresAt
      : status.subscriptionActive && plan && !["none", "trial", "pending"].includes(plan)
        ? status.subscriptionExpiresAt
        : status.trialExpiresAt || status.subscriptionExpiresAt;
  if (!expiryStr) return 0;
  const expiry = new Date(expiryStr).getTime();
  if (!Number.isFinite(expiry)) return 0;
  return Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60)));
}

/** Invisible DOM bridge the Chrome extension reads to detect portal login. */
export function AuthBridge({ session, daysRemaining }: AuthBridgeProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [resolvedDays, setResolvedDays] = useState(daysRemaining ?? DEFAULT_SUBSCRIPTION_DAYS);
  const [resolvedHours, setResolvedHours] = useState(0);
  const [resolvedPlan, setResolvedPlan] = useState("none");
  const [accessActive, setAccessActive] = useState(false);
  const [bridgeSid, setBridgeSid] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (daysRemaining !== undefined) {
      setResolvedDays(daysRemaining);
      return;
    }
    if (!session) {
      setResolvedDays(0);
      setResolvedHours(0);
      setResolvedPlan("none");
      setAccessActive(false);
      return;
    }

    let active = true;
    void fetch("/api/user/status", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && data.status) {
          const status = data.status as StatusPayload;
          setResolvedDays(daysUntilExpiry(status));
          setResolvedHours(hoursUntilExpiry(status));
          setResolvedPlan(String(status.subscriptionPlan || "none"));
          setAccessActive(Boolean(status.active));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [session, daysRemaining]);

  useEffect(() => {
    if (!session) {
      setBridgeSid("");
      return;
    }

    setBridgeSid(session.sid || "");

    const refreshSid = () => {
      void fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && data.user?.sid) {
            setBridgeSid(String(data.user.sid));
          }
        })
        .catch(() => {});
    };

    refreshSid();
    const heartbeat = window.setInterval(refreshSid, 10 * 60 * 1000);
    return () => window.clearInterval(heartbeat);
  }, [session]);

  return (
    <div
      id="flowdoverz-auth-bridge"
      data-logged-in={session ? "1" : "0"}
      data-active={session && accessActive ? "1" : "0"}
      data-email={session?.email ?? ""}
      data-sid={bridgeSid || session?.sid || ""}
      data-days={String(resolvedDays)}
      data-hours={String(resolvedHours)}
      data-plan={resolvedPlan}
      data-base-url={baseUrl}
      hidden
      aria-hidden="true"
    />
  );
}
