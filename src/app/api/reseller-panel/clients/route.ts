import { NextRequest, NextResponse } from "next/server";
import { publicMaintenanceResponse } from "@/lib/maintenance";
import {
  listResellerUsers,
  publicResellerPlanOptions,
  parseResellerClientPlanRequest,
  registerClientForReseller,
  remainingPaidSeats,
  remainingTrialSeats,
  countResellerSeatUsage,
  resellerTrialRegistrationEnabled,
} from "@/lib/reseller-store";
import { getResellerSession } from "@/lib/reseller-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const reseller = await getResellerSession();
  if (!reseller) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [users, usage] = await Promise.all([
    listResellerUsers(reseller.id),
    countResellerSeatUsage(reseller.id),
  ]);
  return NextResponse.json({
    success: true,
    defaultSeatPlan: reseller.defaultSeatPlan,
    planOptions: publicResellerPlanOptions(reseller),
    trialSeatsEnabled: resellerTrialRegistrationEnabled(reseller),
    trialSeatHours: reseller.trialSeatHours,
    trialSeatsGranted: reseller.trialSeatsGranted,
    remainingTrialSeats: remainingTrialSeats(reseller, usage.trial),
    remainingPaidSeats: remainingPaidSeats(reseller, usage.paid),
    trialUserCount: usage.trial,
    seatsPurchased: reseller.seatsPurchased,
    users: users.map((user) => ({
      email: user.email,
      name: user.name,
      subscriptionPlan: user.subscriptionPlan,
      trialExpiresAt: user.trialExpiresAt,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      createdAt: user.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const reseller = await getResellerSession();
  if (!reseller) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; name?: string; password?: string; subscriptionPlan?: string; plan?: string } = {};
  try {
    body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
      subscriptionPlan?: string;
      plan?: string;
    };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const requestedPlan = parseResellerClientPlanRequest(body);

  const result = await registerClientForReseller(reseller, {
    email: String(body.email || ""),
    name: String(body.name || ""),
    password: String(body.password || ""),
    subscriptionPlan: requestedPlan || undefined,
    plan: requestedPlan || undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    user: result.user,
    remainingSeats: result.remainingSeats,
    remainingTrialSeats: result.remainingTrialSeats,
    remainingPaidSeats: result.remainingPaidSeats,
    seatsPurchased: result.seatsPurchased,
  });
}
