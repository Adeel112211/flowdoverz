import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { WORKSPACE_OWNER } from "@/lib/admin";
import { CLIENT_SID_COOKIE, verifyClientSession } from "@/lib/client-session";
import { getSlotCookies, listSlots } from "@/lib/cookie-store";
import { getAppUrl } from "@/lib/site-urls";

function resolveSessionEmail(cookieSid: string | undefined) {
  const verified = verifyClientSession(cookieSid);
  return verified?.email ?? null;
}

/**
 * Admin saves cookies on /cookies (password locked).
 * Logged-in clients receive those cookies via extension sync.
 * Guests / login page without session get nothing.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const reportedSlot = searchParams.get("reported_slot");
  const reportedHealth = searchParams.get("reported_health");

  if (reportedSlot && reportedHealth) {
    return NextResponse.json({
      success: true,
      acknowledged: true,
      slot: reportedSlot,
      health: reportedHealth,
    });
  }

  const cookieStore = await cookies();
  const email = resolveSessionEmail(cookieStore.get(CLIENT_SID_COOKIE)?.value);
  const reportedVersion =
    request.headers.get("x-extension-version") || searchParams.get("extension_version");

  const { getExtensionConfig } = await import("@/lib/extension-store");
  const { getSystemSettings } = await import("@/lib/admin-settings");
  const {
    EXTENSION_UPDATE_CODE,
    EXTENSION_UPDATE_MESSAGE,
    isOlderExtensionVersion,
  } = await import("@/lib/extension-version");
  const extensionConfig = await getExtensionConfig();
  const systemSettings = await getSystemSettings();
  const latestVersion = extensionConfig.activeVersion || systemSettings.minExtensionVersion || "";

  async function updateRequiredResponse() {
    if (email) {
      try {
        const { markExtensionUpdateRequired } = await import("@/lib/user-store");
        await markExtensionUpdateRequired(email, latestVersion);
      } catch {
        // non-blocking
      }
    }
    // 403 so already-installed builds clear Flow cookies instead of keeping a stale session.
    return NextResponse.json(
      {
        success: false,
        code: EXTENSION_UPDATE_CODE,
        message: EXTENSION_UPDATE_MESSAGE,
        latestVersion,
      },
      { status: 403 },
    );
  }

  // Require challenge proof of real official file bytes (+ live function attestation).
  const { validateExtensionIntegrityHeaders } = await import("@/lib/extension-build");
  const integrityCheck = await validateExtensionIntegrityHeaders({
    integrity: request.headers.get("x-extension-integrity"),
    challenge: request.headers.get("x-extension-challenge"),
    proof: request.headers.get("x-extension-proof"),
  });
  if (!integrityCheck.ok) {
    if (isOlderExtensionVersion(reportedVersion, latestVersion)) {
      return updateRequiredResponse();
    }
    // Flag the account so Dashboard can show "reinstall official" guidance.
    if (email) {
      try {
        const { markExtensionTampered } = await import("@/lib/user-store");
        await markExtensionTampered(email, integrityCheck.message);
      } catch {
        // non-blocking
      }
    }
    // 409 (not 403) so clients never mistake this for subscription expired.
    return NextResponse.json(
      {
        success: false,
        code: integrityCheck.code,
        message: integrityCheck.message,
      },
      { status: 409 },
    );
  }

  if (!email) {
    return NextResponse.json(
      {
        success: false,
        code: "NOT_LOGGED_IN",
        message: "Sign in on the FlowDoverz login page first.",
      },
      { status: 401 },
    );
  }

  const sidValue = cookieStore.get(CLIENT_SID_COOKIE)?.value;
  const verified = verifyClientSession(sidValue);
  if (!verified?.sessionId) {
    return NextResponse.json(
      {
        success: false,
        code: "NOT_LOGGED_IN",
        message: "Sign in on the FlowDoverz login page first.",
      },
      { status: 401 },
    );
  }

  const { isActiveClientSession, SESSION_REPLACED_MESSAGE } = await import("@/lib/user-store");
  const sessionOk = await isActiveClientSession(email, verified.sessionId);
  if (!sessionOk) {
    return NextResponse.json(
      {
        success: false,
        code: "SESSION_REPLACED",
        message: SESSION_REPLACED_MESSAGE,
      },
      { status: 401 },
    );
  }

  const { getUserStatus, resolveBillingPresentation } = await import("@/lib/user-store");
  const status = await getUserStatus(email);

  if (!status) {
    return NextResponse.json(
      { success: false, code: "NOT_LOGGED_IN", message: "User not found." },
      { status: 401 }
    );
  }

  if (!status.active) {
    return NextResponse.json(
      { success: false, code: "SUBSCRIPTION_EXPIRED", message: "Trial or subscription expired." },
      { status: 403 }
    );
  }

  if (isOlderExtensionVersion(reportedVersion, latestVersion)) {
    return updateRequiredResponse();
  }

  const { getDb } = await import("@/lib/firebase-admin");
  const dbCheck = getDb();
  if (dbCheck) {
    const userDoc = await dbCheck.collection("users").doc(email).get();
    if (userDoc.exists && userDoc.data()?.suspended) {
      return NextResponse.json(
        { success: false, code: "ACCOUNT_SUSPENDED", message: "Account suspended. Contact support." },
        { status: 403 },
      );
    }
  }

  const slot = (searchParams.get("slot") || "C1").toUpperCase();
  const ownerSlots = await listSlots(WORKSPACE_OWNER);
  const record = await getSlotCookies(WORKSPACE_OWNER, slot);

  const availableSlots = ownerSlots
    .filter(({ record }) => Array.isArray(record.cookies) && record.cookies.length > 0)
    .map(({ key, record }) => ({
      key: key.toUpperCase(),
      name: record.label?.trim() || `Session ${key.slice(1)}`,
      health: "live" as const,
      has_cookies: true,
      cookie_count: record.cookies.length,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const now = new Date();
  const billing = resolveBillingPresentation(status);
  const expiryDate = billing.expiryAt ? new Date(billing.expiryAt) : now;
  const daysRemaining = Math.max(
    0,
    Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  let userName = email.split("@")[0] || "Member";
  if (dbCheck) {
    const profileDoc = await dbCheck.collection("users").doc(email).get();
    if (profileDoc.exists && profileDoc.data()?.name) {
      userName = String(profileDoc.data()?.name);
    }
  }

  const planName = billing.planName;

  function formatTimeDisplay(expiry: Date) {
    const ms = expiry.getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    if (minutes > 0) return `${minutes}m ${seconds}s left`;
    return `${seconds}s left`;
  }

  const extensionVersion = reportedVersion;
  try {
    const { getDb } = await import("@/lib/firebase-admin");
    const db = getDb();
    if (db) {
      // Official integrity already passed above — clear any stale tamper / force-update flags.
      await db.collection("users").doc(email).set(
        {
          lastSyncAt: now.toISOString(),
          lastSyncSlot: slot,
          extensionTampered: false,
          extensionTamperedAt: null,
          extensionTamperMessage: null,
          extensionUpdateRequired: false,
          extensionRequiredVersion: null,
          extensionUpdateRequiredAt: null,
          extensionUpdateMessage: null,
          ...(extensionVersion ? { extensionVersion } : {}),
        },
        { merge: true },
      );
    }
  } catch {
    // non-blocking
  }

  return NextResponse.json({
    success: true,
    cookies: record?.cookies ?? [],
    cookie_hash: record ? `${slot}:${record.hash}` : `empty:${slot}`,
    active_slot: slot,
    available_slots: availableSlots,
    cookies_access: true,
    latest_extension_version: latestVersion,
    user: {
      email,
      name: userName,
      days_remaining: daysRemaining,
      time_display: formatTimeDisplay(expiryDate),
      expiry_at: expiryDate.toISOString(),
      plan_name: planName,
      user_type: billing.userType,
    },
    branding: {
      site_name: "FlowDoverz",
      primary_color: "#06b6d4",
      accent_color: "#14b8a6",
      logo_url: `${getAppUrl().replace(/\/$/, "")}/logo.png`,
    },
  });
}
