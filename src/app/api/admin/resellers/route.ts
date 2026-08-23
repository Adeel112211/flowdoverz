import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest, WORKSPACE_OWNER } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { listSlots } from "@/lib/cookie-store";
import { getFirebaseInitError, isFirebaseConfigured } from "@/lib/firebase-admin";
import {
  createReseller,
  deleteReseller,
  getReseller,
  listResellerApiUse,
  listResellerUsers,
  listResellers,
  rotateResellerKey,
  toPublicReseller,
  updateReseller,
  countResellerUsers,
  addResellerSeats,
  pickAssignedSlot,
  remainingSeats,
  subscriptionExpiryFromNow,
  RESELLER_SLOTS,
} from "@/lib/reseller-store";
import { buildResellerIntegration } from "@/lib/reseller-http";
import { createUserByAdmin } from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function databaseError() {
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Firebase is not configured." },
      { status: 503 },
    );
  }
  const message = getFirebaseInitError();
  if (message) {
    return NextResponse.json({ success: false, error: message }, { status: 503 });
  }
  return null;
}

async function slotHealth() {
  const slots = await listSlots(WORKSPACE_OWNER);
  return RESELLER_SLOTS.map((key) => {
    const found = slots.find((item) => String(item.key).toUpperCase() === key);
    const cookies = found?.record?.cookies;
    const count = Array.isArray(cookies) ? cookies.length : 0;
    return {
      key,
      label: found?.record?.label?.trim() || `Session ${key.slice(1)}`,
      hasCookies: count > 0,
      cookieCount: count,
    };
  });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const dbError = databaseError();
  if (dbError) return dbError;

  try {
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    const slots = await slotHealth();
    if (id) {
      const record = await getReseller(id);
      if (!record) {
        return NextResponse.json({ success: false, error: "Reseller not found" }, { status: 404 });
      }
      const reseller = toPublicReseller(record, await countResellerUsers(id));
      const users = await listResellerUsers(id);
      const integration = await buildResellerIntegration(reseller);
      const usage = request.nextUrl.searchParams.get("usage") === "1" ? await listResellerApiUse(id) : null;
      return NextResponse.json({
        success: true,
        reseller,
        users,
        slots,
        integration,
        usage,
      });
    }

    const resellers = await listResellers();
    const integrationDefaults = await buildResellerIntegration({
      brandName: "",
      websiteUrl: "",
      allowedOrigins: [],
      status: "active",
      expiresAt: null,
      assignedSlots: [],
      maxUsers: 0,
    });
    return NextResponse.json({
      success: true,
      resellers,
      slots,
      apiBaseUrl: integrationDefaults.apiBaseUrl,
      extensionDownloadUrl: integrationDefaults.extensionDownloadUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load resellers";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const dbError = databaseError();
  if (dbError) return dbError;

  try {
    const body = await request.json();
    const result = await createReseller(body);
    await logAdminActivity({
      action: "reseller_created",
      detail: `Created reseller ${result.reseller.brandName}`,
      targetEmail: result.reseller.contactEmail,
      meta: { resellerId: result.reseller.id },
    });
    const integration = await buildResellerIntegration(result.reseller);
    return NextResponse.json({
      success: true,
      reseller: result.reseller,
      apiKey: result.apiKey,
      integration,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create reseller";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const dbError = databaseError();
  if (dbError) return dbError;

  try {
    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") body[key] = value;
      }
      const logo = form.get("logo");
      if (logo instanceof File && logo.size > 0) {
        const bytes = Buffer.from(await logo.arrayBuffer());
        const mime = logo.type || "image/png";
        body.logoBase64 = `data:${mime};base64,${bytes.toString("base64")}`;
        body.logoMime = mime;
        body.keepLogo = "false";
      }
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "Reseller id is required." }, { status: 400 });
    }

    if (body.action === "rotate_key") {
      const result = await rotateResellerKey(id);
      await logAdminActivity({
        action: "reseller_key_rotated",
        detail: `Rotated API key for ${result.reseller.brandName}`,
        targetEmail: result.reseller.contactEmail,
        meta: { resellerId: id },
      });
      const integration = await buildResellerIntegration(result.reseller);
      return NextResponse.json({
        success: true,
        reseller: result.reseller,
        apiKey: result.apiKey,
        integration,
      });
    }

    if (body.action === "add_seats") {
      const reseller = await addResellerSeats(id, Number(body.seats), {
        note: body.note ? String(body.note) : "",
        paymentAmount: body.paymentAmount ? String(body.paymentAmount) : "",
      });
      await logAdminActivity({
        action: "reseller_seats_added",
        detail: `Added ${Number(body.seats)} paid seats for ${reseller.brandName}`,
        targetEmail: reseller.contactEmail,
        meta: {
          resellerId: id,
          seats: Number(body.seats),
          paymentAmount: body.paymentAmount || null,
        },
      });
      return NextResponse.json({ success: true, reseller });
    }

    if (body.action === "create_user") {
      const current = await getReseller(id);
      if (!current) {
        return NextResponse.json({ success: false, error: "Reseller not found." }, { status: 404 });
      }
      const slot = pickAssignedSlot(current);
      if (!slot) {
        return NextResponse.json({ success: false, error: "Assign a cookie slot first." }, { status: 400 });
      }
      const used = await countResellerUsers(id);
      if (remainingSeats(current, used) <= 0) {
        return NextResponse.json({ success: false, error: "No paid seats left. Add seats first." }, { status: 403 });
      }
      const created = await createUserByAdmin({
        email: String(body.email || ""),
        name: String(body.name || ""),
        password: String(body.password || ""),
        subscriptionPlan: "solo",
        trialExpiresAt: new Date().toISOString(),
        subscriptionExpiresAt: subscriptionExpiryFromNow(current.seatDays),
        resellerId: id,
        assignedSlot: slot,
      });
      if (!created.ok) {
        return NextResponse.json({ success: false, error: created.error }, { status: 400 });
      }
      await logAdminActivity({
        action: "reseller_user_created",
        detail: `Created user ${String(body.email || "")} for ${current.brandName}`,
        targetEmail: String(body.email || ""),
        meta: { resellerId: id },
      });
      return NextResponse.json({
        success: true,
        reseller: toPublicReseller(current, used + 1),
      });
    }

    if (body.action === "generate_extension") {
      const { generateResellerExtensionPack } = await import("@/lib/extension-reseller-pack");
      const bodyRec = body as Record<string, unknown>;
      const logoValue = (() => {
        for (const key of ["logoBase64", "logoDataUrl", "logo"]) {
          const value = bodyRec[key];
          if (typeof value === "string" && value.trim()) return value.trim();
        }
        for (const [key, value] of Object.entries(bodyRec)) {
          if (typeof value === "string" && /logo/i.test(key) && (value.includes("base64") || value.startsWith("data:image"))) {
            return value.trim();
          }
        }
        return "";
      })();
      const result = await generateResellerExtensionPack(id, {
        displayName: String(body.displayName || ""),
        supportEmail: String(body.supportEmail || ""),
        logoBase64: logoValue || undefined,
        logoMime: body.logoMime ? String(body.logoMime) : undefined,
        keepLogo: body.keepLogo !== false && body.keepLogo !== "false",
      });
      const current = await getReseller(id);
      if (!current) {
        return NextResponse.json({ success: false, error: "Reseller not found." }, { status: 404 });
      }
      const reseller = toPublicReseller(current, await countResellerUsers(id));
      await logAdminActivity({
        action: "reseller_extension_generated",
        detail: `Generated branded extension for ${reseller.brandName} (${result.meta.version})`,
        targetEmail: reseller.contactEmail,
        meta: { resellerId: id, version: result.meta.version, fileName: result.meta.fileName },
      });
      return NextResponse.json({
        success: true,
        reseller,
        downloadUrl: result.downloadUrl,
      });
    }

    const reseller = await updateReseller(id, body);
    await logAdminActivity({
      action: "reseller_updated",
      detail: `Updated reseller ${reseller.brandName}`,
      targetEmail: reseller.contactEmail,
      meta: { resellerId: id },
    });
    return NextResponse.json({ success: true, reseller });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update reseller";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const dbError = databaseError();
  if (dbError) return dbError;

  try {
    const id =
      request.nextUrl.searchParams.get("id")?.trim() ||
      String((await request.json().catch(() => ({}))).id || "").trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "Reseller id is required." }, { status: 400 });
    }
    const removed = await deleteReseller(id);
    await logAdminActivity({
      action: "reseller_deleted",
      detail: `Deleted reseller ${removed.brandName}`,
      targetEmail: removed.contactEmail,
      meta: { resellerId: id },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete reseller";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
