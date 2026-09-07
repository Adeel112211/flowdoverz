import { NextRequest, NextResponse } from "next/server";
import {
  analyzeCookies,
  clearSlotCookies,
  compareAccountFingerprints,
  getSlotCookies,
  listSlots,
  mergeCookieExportParts,
  parseCookieJson,
  saveSlotCookies,
} from "@/lib/cookie-store";
import { isAdminUiRequest, WORKSPACE_OWNER } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";

type CookiePartsBody = {
  google?: string;
  flow?: string;
  labs?: string;
};

const VALID_SLOTS = new Set(["C1", "C2", "C3", "C4", "C5"]);

function normalizeSlot(value: string | null | undefined) {
  const slot = (value || "C1").toUpperCase();
  return VALID_SLOTS.has(slot) ? slot : "C1";
}

async function requireAdmin(request?: NextRequest) {
  if (await isAdminUiRequest(request)) return null;
  return NextResponse.json(
    { success: false, error: "Admin password required.", code: "ADMIN_REQUIRED" },
    { status: 401 },
  );
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const slot = normalizeSlot(request.nextUrl.searchParams.get("slot"));
  const wantFull = request.nextUrl.searchParams.get("full") === "1";
  
  const record = await getSlotCookies(WORKSPACE_OWNER, slot);
  const slots = await listSlots(WORKSPACE_OWNER);
  const analysis = record?.cookies.length ? analyzeCookies(record.cookies) : null;

  return NextResponse.json({
    success: true,
    owner: WORKSPACE_OWNER,
    active_slot: slot,
    cookie_count: record?.cookies.length ?? 0,
    cookie_hash: record?.hash ?? null,
    updated_at: record?.updatedAt ?? null,
    cookie_names: record?.cookies.map((c) => c.name) ?? [],
    cookies: wantFull ? record?.cookies ?? [] : undefined,
    hasLabsSession: analysis?.hasLabsSession ?? false,
    hasGoogleSid: analysis?.hasGoogleSid ?? false,
    hasFlowHost: analysis?.hasFlowHost ?? false,
    hasLabsHost: analysis?.hasLabsHost ?? false,
    hasNextAuth: analysis?.hasNextAuth ?? false,
    freshness: analysis?.freshness ?? null,
    warnings: analysis?.warnings ?? [],
    account_fingerprint: record?.accountFingerprint ?? analysis?.accountFingerprint ?? null,
    available_slots: ["C1", "C2", "C3", "C4", "C5"].map((key) => {
      const saved = slots.find((s) => s.key === key)?.record;
      return {
        key,
        name: saved?.label || `Session ${key.slice(1)}`,
        label: saved?.label || null,
        has_cookies: Boolean(saved),
        updated_at: saved?.updatedAt ?? null,
        cookie_count: saved?.cookies.length ?? 0,
      };
    }),
    label: record?.label ?? null,
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  let body: {
    slot?: string;
    cookies?: string | unknown;
    cookieParts?: CookiePartsBody;
    label?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const slot = normalizeSlot(body.slot);

  try {
    const parts = body.cookieParts;
    const hasParts =
      parts &&
      [parts.google, parts.flow, parts.labs].some(
        (value) => typeof value === "string" && value.trim().length > 0,
      );

    const cookiesList = hasParts
      ? mergeCookieExportParts({
          google: typeof parts?.google === "string" ? parts.google : "",
          flow: typeof parts?.flow === "string" ? parts.flow : "",
          labs: typeof parts?.labs === "string" ? parts.labs : "",
        })
      : parseCookieJson(
          typeof body.cookies === "string"
            ? body.cookies
            : JSON.stringify(body.cookies ?? []),
        );
    const previous = await getSlotCookies(WORKSPACE_OWNER, slot);
    const analysis = analyzeCookies(cookiesList);
    const accountMatch = compareAccountFingerprints(
      previous?.accountFingerprint,
      analysis.accountFingerprint,
    );
    const record = await saveSlotCookies(WORKSPACE_OWNER, slot, cookiesList, body.label);

    await logAdminActivity({
      action: "cookies_saved",
      detail: `Saved ${record.cookies.length} cookies to ${slot}`,
      meta: { slot, count: record.cookies.length },
    });

    return NextResponse.json({
      success: true,
      slot,
      cookie_count: record.cookies.length,
      cookie_hash: record.hash,
      updated_at: record.updatedAt,
      cookie_names: record.cookies.map((cookie) => cookie.name),
      warnings: analysis.warnings,
      hasLabsSession: analysis.hasLabsSession,
      hasGoogleSid: analysis.hasGoogleSid,
      hasFlowHost: analysis.hasFlowHost,
      hasLabsHost: analysis.hasLabsHost,
      hasNextAuth: analysis.hasNextAuth,
      freshness: analysis.freshness,
      account_match: accountMatch,
      account_fingerprint: record.accountFingerprint ?? analysis.accountFingerprint,
      merged_from_parts: hasParts ?? false,
      message: hasParts
        ? `Merged and saved ${record.cookies.length} cookies to ${slot}. Clients will get them after they sign in.`
        : `Saved ${record.cookies.length} cookies to ${slot}. Clients will get them after they sign in.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not save cookies",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const slot = normalizeSlot(request.nextUrl.searchParams.get("slot"));
  await clearSlotCookies(WORKSPACE_OWNER, slot);

  await logAdminActivity({ action: "cookies_cleared", detail: `Cleared slot ${slot}`, meta: { slot } });

  return NextResponse.json({
    success: true,
    slot,
    message: "Cookies cleared for this session slot.",
  });
}
