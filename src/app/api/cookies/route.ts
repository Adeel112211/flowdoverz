import { NextRequest, NextResponse } from "next/server";
import {
  clearSlotCookies,
  getSlotCookies,
  listSlots,
  parseCookieJson,
  saveSlotCookies,
} from "@/lib/cookie-store";
import { isAdminUiRequest, WORKSPACE_OWNER } from "@/lib/admin";

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

  return NextResponse.json({
    success: true,
    owner: WORKSPACE_OWNER,
    active_slot: slot,
    cookie_count: record?.cookies.length ?? 0,
    cookie_hash: record?.hash ?? null,
    updated_at: record?.updatedAt ?? null,
    cookie_names: record?.cookies.map((c) => c.name) ?? [],
    cookies: wantFull ? record?.cookies ?? [] : undefined,
    available_slots: ["C1", "C2", "C3", "C4", "C5"].map((key) => ({
      key,
      name: `Session ${key.slice(1)}`,
      has_cookies: Boolean(slots.find((s) => s.key === key)?.record),
      updated_at: slots.find((s) => s.key === key)?.record.updatedAt ?? null,
      cookie_count: slots.find((s) => s.key === key)?.record.cookies.length ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  let body: { slot?: string; cookies?: string | unknown; label?: string };
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
    const raw =
      typeof body.cookies === "string"
        ? body.cookies
        : JSON.stringify(body.cookies ?? []);
    const cookiesList = parseCookieJson(raw);
    const record = await saveSlotCookies(WORKSPACE_OWNER, slot, cookiesList, body.label);

    return NextResponse.json({
      success: true,
      slot,
      cookie_count: record.cookies.length,
      cookie_hash: record.hash,
      updated_at: record.updatedAt,
      message: "Cookies saved. Only your unlocked admin browser can sync them.",
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

  return NextResponse.json({
    success: true,
    slot,
    message: "Cookies cleared for this session slot.",
  });
}
