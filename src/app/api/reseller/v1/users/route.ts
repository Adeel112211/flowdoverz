import { NextRequest } from "next/server";
import {
  authenticateReseller,
  corsHeaders,
  jsonSafe,
} from "@/lib/reseller-http";
import {
  countResellerUsers,
  deleteResellerUser,
  listResellerUsers,
  pickAssignedSlot,
  remainingSeats,
  subscriptionExpiryFromNow,
} from "@/lib/reseller-store";
import { createUserByAdmin, getUserRecord, issueResellerClientSession } from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return jsonSafe({ success: true }, { headers: corsHeaders(request, []) });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateReseller(request);
  if (!auth.ok) return auth.response;

  const users = await listResellerUsers(auth.reseller.id);
  const used = users.length;
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
      userCount: used,
      seatsPurchased: auth.reseller.seatsPurchased,
      remainingSeats: remainingSeats(auth.reseller, used),
      seatDays: auth.reseller.seatDays,
      maxUsers: auth.reseller.seatsPurchased,
    },
    { headers: auth.headers },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authenticateReseller(request);
  if (!auth.ok) return auth.response;

  const slot = pickAssignedSlot(auth.reseller);
  if (!slot) {
    return jsonSafe(
      { success: false, error: "No cookie slots assigned to this reseller." },
      { status: 400, headers: auth.headers },
    );
  }

  const used = await countResellerUsers(auth.reseller.id);
  const left = remainingSeats(auth.reseller, used);

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
  const requestedSlot = pickAssignedSlot(auth.reseller, String(body.assignedSlot || ""));
  const assignedSlot = requestedSlot || slot;
  const existing = email ? await getUserRecord(email) : null;
  if (existing) {
    if (String(existing.resellerId || "") !== auth.reseller.id) {
      return jsonSafe(
        { success: false, error: "A client with this email already exists." },
        { status: 400, headers: auth.headers },
      );
    }
    const session = await issueResellerClientSession(auth.reseller.id, email);
    return jsonSafe(
      {
        success: true,
        existing: true,
        user: {
          email,
          assignedSlot: String(existing.assignedSlot || assignedSlot || "") || null,
          plan: "solo",
          subscriptionExpiresAt: existing.subscriptionExpiresAt || null,
          seatDays: auth.reseller.seatDays,
          remainingSeats: left,
          sid: session.ok ? session.sid : undefined,
        },
      },
      { headers: auth.headers },
    );
  }

  if (left <= 0) {
    return jsonSafe(
      {
        success: false,
        error: "No paid seats left. Send another user payment, then the owner will add more seats.",
        remainingSeats: 0,
        seatsPurchased: auth.reseller.seatsPurchased,
      },
      { status: 403, headers: auth.headers },
    );
  }

  const expiry = subscriptionExpiryFromNow(auth.reseller.seatDays);
  const nowIso = new Date().toISOString();
  const result = await createUserByAdmin({
    email,
    name: String(body.name || ""),
    password: String(body.password || ""),
    subscriptionPlan: "solo",
    trialExpiresAt: nowIso,
    subscriptionExpiresAt: expiry,
    resellerId: auth.reseller.id,
    assignedSlot,
  });

  if (!result.ok) {
    return jsonSafe(
      { success: false, error: result.error },
      { status: 400, headers: auth.headers },
    );
  }

  const session = await issueResellerClientSession(auth.reseller.id, email);
  return jsonSafe(
    {
      success: true,
      existing: false,
      user: {
        email,
        assignedSlot,
        plan: "solo",
        subscriptionExpiresAt: expiry,
        seatDays: auth.reseller.seatDays,
        remainingSeats: left - 1,
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
