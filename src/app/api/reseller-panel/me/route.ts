import { NextResponse } from "next/server";
import { publicMaintenanceResponse } from "@/lib/maintenance";
import {
  countResellerSeatUsage,
  listResellerUsers,
  listSeatGrants,
  publicResellerPlanOptions,
  remainingPaidSeats,
  remainingTrialSeats,
  resellerTrialRegistrationEnabled,
  summarizeSeatGrants,
} from "@/lib/reseller-store";
import { getResellerSession, publicResellerSession } from "@/lib/reseller-session";
import { resellerClientActiveExpiry } from "@/lib/reseller-trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const reseller = await getResellerSession();
  if (!reseller) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [users, grants, usage] = await Promise.all([
    listResellerUsers(reseller.id),
    listSeatGrants(reseller.id),
    countResellerSeatUsage(reseller.id),
  ]);
  const pricing = summarizeSeatGrants(grants);
  const now = Date.now();
  const active = users.filter((user) => {
    const at = Date.parse(resellerClientActiveExpiry(user) || "");
    return Number.isFinite(at) && at > now;
  }).length;
  const expired = users.filter((user) => {
    const at = Date.parse(resellerClientActiveExpiry(user) || "");
    return Number.isFinite(at) && at <= now;
  }).length;

  return NextResponse.json({
    success: true,
    reseller: publicResellerSession(reseller),
    stats: {
      seatsPurchased: reseller.seatsPurchased,
      userCount: usage.total,
      paidUserCount: usage.paid,
      trialUserCount: usage.trial,
      remainingSeats: remainingPaidSeats(reseller, usage.paid) + remainingTrialSeats(reseller, usage.trial),
      remainingPaidSeats: remainingPaidSeats(reseller, usage.paid),
      remainingTrialSeats: remainingTrialSeats(reseller, usage.trial),
      trialSeatsEnabled: resellerTrialRegistrationEnabled(reseller),
      trialSeatHours: reseller.trialSeatHours,
      trialSeatsGranted: reseller.trialSeatsGranted,
      activeClients: active,
      expiredClients: expired,
      seatDays: reseller.seatDays,
      pricePerSeatPkr: reseller.pricePerSeatPkr,
      defaultSeatPlan: reseller.defaultSeatPlan,
      allowedSeatPlans: reseller.allowedSeatPlans,
      planOptions: publicResellerPlanOptions(reseller),
      totalPaidPkr: pricing.totalPaidPkr,
      totalSeatsGranted: pricing.totalSeatsGranted,
      lastGrantAt: pricing.lastGrant?.createdAt || null,
      lastGrantTotalPkr: pricing.lastGrant?.totalPkr || 0,
      lastGrantSeats: pricing.lastGrant?.seats || 0,
    },
    recentClients: users.slice(0, 8).map((user) => ({
      email: user.email,
      name: user.name,
      subscriptionPlan: user.subscriptionPlan,
      trialExpiresAt: user.trialExpiresAt,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      createdAt: user.createdAt,
    })),
  });
}
