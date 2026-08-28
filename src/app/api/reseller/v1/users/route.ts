import { NextRequest } from "next/server";
import {
  authenticateReseller,
  corsHeaders,
  jsonSafe,
} from "@/lib/reseller-http";
import {
  countResellerSeatUsage,
  deleteResellerUser,
  listResellerUsers,
  remainingSeats,
  remainingTrialSeats,
  remainingPaidSeats,
  registerClientForReseller,
} from "@/lib/reseller-store";
import { getUserRecord, issueResellerClientSession } from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return jsonSafe({ success: true }, { headers: corsHeaders(request, []) });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateReseller(request);
  if (!auth.ok) return auth.response;

  const users = await listResellerUsers(auth.reseller.id);
  const usage = await countResellerSeatUsage(auth.reseller.id);
  return jsonSafe(
    {
      success: true,
      users: users.map((user) => ({
        email: user.email,
        name: user.name,
        plan: user.subscriptionPlan,
        assignedSlot: user.assignedSlot || null,
        trialExpiresAt: user.trialExpiresAt,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        createdAt: user.createdAt,
      })),
      userCount: usage.total,
      trialUserCount: usage.trial,
      paidUserCount: usage.paid,
      seatsPurchased: auth.reseller.seatsPurchased,
      trialSeatsGranted: auth.reseller.trialSeatsGranted || 0,
      remainingSeats: remainingSeats(auth.reseller, usage),
      remainingTrialSeats: remainingTrialSeats(auth.reseller, usage.trial),
      remainingPaidSeats: remainingPaidSeats(auth.reseller, usage.paid),
      seatDays: auth.reseller.seatDays,
      maxUsers: auth.reseller.seatsPurchased,
    },
    { headers: auth.headers },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authenticateReseller(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonSafe(
      { success: false, error: "Invalid JSON body." },
      { status: 400, headers: auth.headers },
    );
  }

  const email = String(body.email || "").trim().toLowerCase();
  const existing = email ? await getUserRecord(email) : null;
  const usage = await countResellerSeatUsage(auth.reseller.id);
  const left = remainingSeats(auth.reseller, usage);

  if (existing) {
    if (String(existing.resellerId || "") !== auth.reseller.id) {
      return jsonSafe(
        { success: false, error: "A client with this email already exists." },
        { status: 400, headers: auth.headers },
      );
    }
    const session = await issueResellerClientSession(auth.reseller.id, email, {
      force: body.forceSession === true,
    });
    return jsonSafe(
      {
        success: true,
        existing: true,
        user: {
          email,
          assignedSlot: String(existing.assignedSlot || "") || null,
          plan: String(existing.subscriptionPlan || "trial"),
          trialExpiresAt: existing.trialExpiresAt || null,
          subscriptionExpiresAt: existing.subscriptionExpiresAt || null,
          seatDays: auth.reseller.seatDays,
          remainingSeats: left,
          remainingTrialSeats: remainingTrialSeats(auth.reseller, usage.trial),
          remainingPaidSeats: remainingPaidSeats(auth.reseller, usage.paid),
          sid: session.ok ? session.sid : undefined,
        },
      },
      { headers: auth.headers },
    );
  }

  const result = await registerClientForReseller(auth.reseller, {
    email,
    name: String(body.name || ""),
    password: String(body.password || ""),
    subscriptionPlan: String(body.plan || body.subscriptionPlan || "trial"),
  });

  if (!result.ok) {
    return jsonSafe(
      { success: false, error: result.error },
      { status: result.status, headers: auth.headers },
    );
  }

  const session = await issueResellerClientSession(auth.reseller.id, email);
  return jsonSafe(
    {
      success: true,
      existing: false,
      user: {
        email,
        assignedSlot: null,
        plan: result.user.subscriptionPlan,
        trialExpiresAt: result.user.trialExpiresAt,
        subscriptionExpiresAt: result.user.subscriptionExpiresAt,
        seatDays: auth.reseller.seatDays,
        remainingSeats: result.remainingSeats,
        remainingTrialSeats: result.remainingTrialSeats,
        remainingPaidSeats: result.remainingPaidSeats,
        sid: session.ok ? session.sid : undefined,
      },
    },
    { headers: auth.headers },
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateReseller(request);
  if (!auth.ok) return auth.response;

  const email = request.nextUrl.searchParams.get("email") || "";
  const result = await deleteResellerUser(auth.reseller.id, email);
  if (!result.ok) {
    return jsonSafe(
      { success: false, error: result.error },
      { status: result.status, headers: auth.headers },
    );
  }

  return jsonSafe({ success: true, email: email.trim().toLowerCase() }, { headers: auth.headers });
}
