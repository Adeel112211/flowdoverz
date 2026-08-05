import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { WORKSPACE_OWNER } from "@/lib/admin";
import { emailFromSid, getSlotCookies, listSlots } from "@/lib/cookie-store";

const SID_COOKIE = "flowdoverz_sid";
const ALL_SLOTS = ["C1", "C2", "C3", "C4", "C5"] as const;

function resolveSid(request: NextRequest, cookieSid: string | undefined) {
  return (
    cookieSid ||
    request.headers.get("x-session-id") ||
    request.nextUrl.searchParams.get("sid") ||
    ""
  ).trim();
}

function isValidUserSid(sid: string) {
  // Must be a real client session — not empty, not the admin page placeholder
  if (!sid || sid.length < 8) return false;
  if (sid === "admin-local") return false;
  return true;
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
  const sid = resolveSid(request, cookieStore.get(SID_COOKIE)?.value);
  const loggedIn = isValidUserSid(sid);

  if (!loggedIn) {
    return NextResponse.json(
      {
        success: false,
        code: "NOT_LOGGED_IN",
        message: "Sign in on the FlowDoverz login page first.",
      },
      { status: 401 },
    );
  }

  const email = emailFromSid(sid).startsWith("sid:")
    ? emailFromSid(sid).slice(4)
    : emailFromSid(sid);

  const { getUserStatus } = await import("@/lib/user-store");
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

  const slot = (searchParams.get("slot") || "C1").toUpperCase();
  const ownerSlots = await listSlots(WORKSPACE_OWNER);
  const record = await getSlotCookies(WORKSPACE_OWNER, slot);

  const availableSlots = ALL_SLOTS.map((key) => {
    const saved = ownerSlots.find((s) => s.key === key);
    return {
      key,
      name: `Session ${key.slice(1)}`,
      health: saved ? "live" : "unknown",
      has_cookies: Boolean(saved),
    };
  });

  const now = new Date();
  const expiryDate = status.subscriptionActive && status.subscriptionExpiresAt 
    ? new Date(status.subscriptionExpiresAt) 
    : (status.trialExpiresAt ? new Date(status.trialExpiresAt) : now);
  const daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return NextResponse.json({
    success: true,
    cookies: record?.cookies ?? [],
    cookie_hash: record ? `${slot}:${record.hash}` : `empty:${slot}`,
    active_slot: slot,
    available_slots: availableSlots,
    cookies_access: true,
    latest_extension_version: "1.0.0",
    user: {
      email,
      days_remaining: daysRemaining,
      time_display: `${daysRemaining} days left`,
      user_type: status.subscriptionActive ? status.subscriptionPlan : "trial",
    },
    branding: {
      site_name: "FlowDoverz",
      primary_color: "#06b6d4",
      accent_color: "#14b8a6",
      logo_url: "",
    },
  });
}
