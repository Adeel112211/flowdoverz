import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { WORKSPACE_OWNER } from "@/lib/admin";
import { CLIENT_SID_COOKIE, clientSidFromRequest, verifyClientSession } from "@/lib/client-session";
import { listSlots } from "@/lib/cookie-store";
import { getAppUrl } from "@/lib/site-urls";

function resolveSessionEmail(cookieSid: string | undefined) {
  const verified = verifyClientSession(cookieSid);
  return verified?.email ?? null;
}

async function brandedSyncIdentity(email: string) {
  const fallback = {
    site_name: "FlowDoverz",
    primary_color: "#06b6d4",
    accent_color: "#14b8a6",
    logo_url: `${getAppUrl().replace(/\/$/, "")}/logo.png`,
  };
  try {
    const { getBrandedExtensionIdentityForUserEmail } = await import("@/lib/extension-reseller-lookup");
    const pack = await getBrandedExtensionIdentityForUserEmail(email);
    if (!pack?.displayName) return fallback;
    return {
      site_name: pack.displayName,
      primary_color: fallback.primary_color,
      accent_color: fallback.accent_color,
      logo_url: fallback.logo_url,
      support_email: pack.supportEmail || "",
    };
  } catch {
    return fallback;
  }
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
  const sidValue = clientSidFromRequest(request, cookieStore.get(CLIENT_SID_COOKIE)?.value);
  const email = resolveSessionEmail(sidValue);
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
  const { validateExtensionIntegrityHeaders, EXTENSION_TAMPER_MESSAGE } = await import("@/lib/extension-build");
  const { isPreviousOfficialHash } = await import("@/lib/extension-store");
  const incomingHash = String(request.headers.get("x-extension-integrity") || "").trim().toLowerCase();
  const integrityCheck = await validateExtensionIntegrityHeaders(
    {
      integrity: incomingHash,
      challenge: request.headers.get("x-extension-challenge"),
      proof: request.headers.get("x-extension-proof"),
    },
    { email },
  );
  if (!integrityCheck.ok) {
    const { isResellerExtensionUpdateRequired } = await import("@/lib/extension-reseller-lookup");
    const outdated =
      isPreviousOfficialHash(incomingHash, extensionConfig) ||
      isOlderExtensionVersion(reportedVersion, latestVersion) ||
      (await isResellerExtensionUpdateRequired(email, incomingHash));
    if (outdated) {
      return updateRequiredResponse();
    }
    // Flag the account so Dashboard can show "reinstall official" guidance.
    if (email) {
      try {
        const { markExtensionTampered } = await import("@/lib/user-store");
        await markExtensionTampered(email, integrityCheck.message || EXTENSION_TAMPER_MESSAGE);
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

  const { isActiveClientSession, SESSION_REPLACED_MESSAGE, getUserRecord } = await import("@/lib/user-store");
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

  const { getUserStatus, resolveBillingPresentation, invalidateUserDocCache } = await import("@/lib/user-store");
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

  const userRecord = await getUserRecord(email);
  if (userRecord?.suspended) {
    return NextResponse.json(
      { success: false, code: "ACCOUNT_SUSPENDED", message: "Account suspended. Contact support." },
      { status: 403 },
    );
  }

  const slot = (searchParams.get("slot") || "C1").toUpperCase();
  const ownerSlots = await listSlots(WORKSPACE_OWNER);
  const record =
    ownerSlots.find((item) => String(item.key).toUpperCase() === slot)?.record || null;

  const availableSlots = ownerSlots
    .filter(({ record: rec }) => Array.isArray(rec.cookies) && rec.cookies.length > 0)
    .map(({ key, record: rec }) => ({
      key: key.toUpperCase(),
      name: rec.label?.trim() || `Session ${key.slice(1)}`,
      health: "live" as const,
      has_cookies: true,
      cookie_count: rec.cookies.length,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const slotCookies: Record<string, unknown> = {};
  for (const { key, record: rec } of ownerSlots) {
    const slotKey = String(key || "").toUpperCase();
    if (slotKey && Array.isArray(rec.cookies) && rec.cookies.length > 0) {
      slotCookies[slotKey] = rec.cookies;
    }
  }

  const now = new Date();
  const billing = resolveBillingPresentation(status);
  const expiryDate = billing.expiryAt ? new Date(billing.expiryAt) : now;
  const daysRemaining = Math.max(
    0,
    Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  let userName = email.split("@")[0] || "Member";
  if (userRecord?.name) {
    userName = String(userRecord.name);
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
      const firstSync = !userRecord?.lastSyncAt;
      const slotChanged = String(userRecord?.lastSyncSlot || "") !== slot;
      const versionChanged = Boolean(extensionVersion) && String(userRecord?.extensionVersion || "") !== extensionVersion;
      const needsFlagClear =
        userRecord?.extensionTampered === true || userRecord?.extensionUpdateRequired === true;
      if (firstSync || slotChanged || versionChanged || needsFlagClear) {
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
        invalidateUserDocCache(email);
        const { touchLive } = await import("@/lib/live-tick");
        void touchLive({ topic: "user", action: "synced", id: email, userId: email });
      }
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
    slot_cookies: slotCookies,
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
    branding: await brandedSyncIdentity(email),
  });
}
