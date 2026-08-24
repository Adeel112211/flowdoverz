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
import { createUserByAdmin } from "@/lib/user-store";

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

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonSafe(
      { success: false, error: "Invalid JSON body." },
      { status: 400, headers: auth.headers },
    );
  }

  const requestedSlot = pickAssignedSlot(auth.reseller, String(body.assignedSlot || ""));
  const expiry = subscriptionExpiryFromNow(auth.reseller.seatDays);
  const nowIso = new Date().toISOString();
  const result = await createUserByAdmin({
    email: String(body.email || ""),
    name: String(body.name || ""),
    password: String(body.password || ""),
    subscriptionPlan: "solo",
    trialExpiresAt: nowIso,
    subscriptionExpiresAt: expiry,
    resellerId: auth.reseller.id,
    assignedSlot: requestedSlot || slot,
  });

  if (!result.ok) {
    return jsonSafe(
      { success: false, error: result.error },
      { status: 400, headers: auth.headers },
    );
  }

  return jsonSafe(
    {
      success: true,
      user: {
        email: String(body.email || "").trim().toLowerCase(),
        assignedSlot: requestedSlot || slot,
        plan: "solo",
        subscriptionExpiresAt: expiry,
        seatDays: auth.reseller.seatDays,
        remainingSeats: left - 1,
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
