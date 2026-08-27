import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { getDb, getFirebaseInitError, isFirebaseConfigured } from "@/lib/firebase-admin";
import { sendAccountActivatedEmail } from "@/lib/email";
import { deleteClientCompletely } from "@/lib/client-data-cleanup";
import { createUserByAdmin, isClientNameTaken, normalizeClientNameKey, updateUserPasswordByAdmin } from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAID_PLANS = ["solo", "studio", "team"];

function planDisplayName(plan: string) {
  if (plan === "solo") return "Solo";
  if (plan === "studio") return "Studio";
  if (plan === "team") return "Team";
  return plan;
}

function databaseErrorResponse() {
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Firebase is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY on Vercel.",
      },
      { status: 503 },
    );
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      {
        success: false,
        error:
          getFirebaseInitError() ||
          "Firebase failed to initialize. Paste the full service account JSON into FIREBASE_SERVICE_ACCOUNT_JSON on Vercel.",
      },
      { status: 503 },
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const dbError = databaseErrorResponse();
  if (dbError) return dbError;

  const db = getDb()!;

  try {
    const { listAdminClients } = await import("@/lib/admin-users-query");
    const result = await listAdminClients(db, {
      email: request.nextUrl.searchParams.get("email"),
      emails: request.nextUrl.searchParams.get("emails"),
      q: request.nextUrl.searchParams.get("q"),
      filter: request.nextUrl.searchParams.get("filter"),
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: request.nextUrl.searchParams.get("limit"),
    });
    if (request.nextUrl.searchParams.get("email")?.trim() && !result.client && result.clients.length === 0) {
      return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      client: result.client,
      clients: result.clients,
      nextCursor: result.nextCursor ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch clients";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const dbError = databaseErrorResponse();
  if (dbError) return dbError;

  const db = getDb()!;

  try {
    const body = await request.json();
    const {
      email,
      name,
      subscriptionPlan,
      trialExpiresAt,
      subscriptionExpiresAt,
      suspended,
      adminNotes,
      assignedSlot,
    } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      const displayName = String(name).trim().replace(/\s+/g, " ");
      if (displayName.length < 2) {
        return NextResponse.json(
          { success: false, error: "Enter the client's name." },
          { status: 400 },
        );
      }
      if (await isClientNameTaken(displayName, email)) {
        return NextResponse.json(
          { success: false, error: "This name is already used. Choose a different name." },
          { status: 400 },
        );
      }
      updateData.name = displayName;
      updateData.nameLower = normalizeClientNameKey(displayName);
    }
    if (subscriptionPlan !== undefined) {
      updateData.subscriptionPlan = subscriptionPlan;
      if (PAID_PLANS.includes(subscriptionPlan)) {
        updateData.expirationEmailSent = false;
      } else {
        updateData.subscriptionExpiresAt = null;
        if (subscriptionPlan === "trial" && trialExpiresAt === undefined) {
          const { getSystemSettings, getTrialDurationMs } = await import("@/lib/admin-settings");
          const settings = await getSystemSettings();
          updateData.trialExpiresAt = new Date(
            Date.now() + getTrialDurationMs(settings),
          ).toISOString();
        }
      }
    }
    if (trialExpiresAt !== undefined) updateData.trialExpiresAt = trialExpiresAt;
    if (subscriptionExpiresAt !== undefined) updateData.subscriptionExpiresAt = subscriptionExpiresAt;
    if (suspended !== undefined) updateData.suspended = Boolean(suspended);
    if (adminNotes !== undefined) updateData.adminNotes = String(adminNotes);
    if (assignedSlot !== undefined) updateData.assignedSlot = String(assignedSlot).toUpperCase();

    const before = await db.collection("users").doc(email).get();
    const beforeData = (before.data() || {}) as Record<string, unknown>;
    await db.collection("users").doc(email).update(updateData);
    const { touchLive } = await import("@/lib/live-tick");
    void touchLive({ topic: "user", action: "updated", id: email, userId: email });
    const { isPaidPlanId, accessFromUserData } = await import("@/lib/admin-client-view");
    const after = { ...beforeData, ...updateData };
    const wasActive = accessFromUserData(beforeData).subscriptionActive;
    const nowActive = accessFromUserData(after).subscriptionActive;
    if (wasActive !== nowActive) {
      const { recordActiveSubscriptionDelta } = await import("@/lib/admin-metrics");
      void recordActiveSubscriptionDelta(nowActive ? 1 : -1);
    } else if (
      subscriptionPlan !== undefined &&
      isPaidPlanId(String(subscriptionPlan)) !== isPaidPlanId(String(beforeData.subscriptionPlan || ""))
    ) {
      const { recordActiveSubscriptionDelta } = await import("@/lib/admin-metrics");
      void recordActiveSubscriptionDelta(nowActive ? 1 : -1);
    }

    if (subscriptionPlan && PAID_PLANS.includes(subscriptionPlan)) {
      const planName = planDisplayName(subscriptionPlan);
      await sendAccountActivatedEmail(email, planName).catch(console.error);
    }

    await logAdminActivity({
      action: suspended === true ? "client_suspended" : suspended === false ? "client_unsuspended" : "client_updated",
      targetEmail: email,
      detail: `Updated client ${email}`,
    });

    return NextResponse.json({ success: true, message: "Client updated successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update client";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const dbError = databaseErrorResponse();
  if (dbError) return dbError;

  try {
    const body = await request.json();
    const { email, name, password, subscriptionPlan, trialExpiresAt, subscriptionExpiresAt } = body;

    const result = await createUserByAdmin({
      email: String(email || ""),
      name: String(name || ""),
      password: String(password || ""),
      subscriptionPlan: String(subscriptionPlan || "trial"),
      trialExpiresAt: trialExpiresAt || undefined,
      subscriptionExpiresAt: subscriptionExpiresAt || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const { recordUserCreated } = await import("@/lib/admin-metrics");
    const { isPaidPlanId } = await import("@/lib/admin-client-view");
    void recordUserCreated(new Date(), isPaidPlanId(String(subscriptionPlan || "trial")));

    const plan = String(subscriptionPlan || "trial");
    if (PAID_PLANS.includes(plan)) {
      const planName = planDisplayName(plan);
      const now = new Date().toISOString();
      const expiry =
        subscriptionExpiresAt ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await sendAccountActivatedEmail(String(email), planName, now, expiry).catch(console.error);
    }

    await logAdminActivity({
      action: "client_created",
      targetEmail: String(email),
      detail: `Created client with plan ${plan}`,
    });

    return NextResponse.json({ success: true, message: "Client created successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create client";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const dbError = databaseErrorResponse();
  if (dbError) return dbError;

  try {
    const body = await request.json();
    const { email, password } = body;

    const result = await updateUserPasswordByAdmin(String(email || ""), String(password || ""));
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    await logAdminActivity({
      action: "password_changed",
      targetEmail: String(email),
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update password";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const dbError = databaseErrorResponse();
  if (dbError) return dbError;

  const db = getDb()!;

  try {
    const email = request.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const existing = await db.collection("users").doc(email).get();
    const existingData = (existing.data() || {}) as Record<string, unknown>;
    const removed = await deleteClientCompletely(email);
    const { touchLive } = await import("@/lib/live-tick");
    void touchLive({ topic: "user", action: "deleted", id: email, userId: email });
    const { accessFromUserData } = await import("@/lib/admin-client-view");
    const { recordUserDeleted } = await import("@/lib/admin-metrics");
    void recordUserDeleted(accessFromUserData(existingData).subscriptionActive);

    await logAdminActivity({
      action: "client_deleted",
      targetEmail: email,
      detail: `Removed client, ${removed.deletedPayments} payment(s), ${removed.deletedEmailLogs} email log(s).`,
    });

    return NextResponse.json({
      success: true,
      message: "Client and related data deleted successfully",
      removed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete client";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
