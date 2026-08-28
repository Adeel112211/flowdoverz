import { NextResponse } from "next/server";
import { publicMaintenanceResponse } from "@/lib/maintenance";
import {
  countResellerSeatUsage,
  listResellerUsers,
  listSeatGrants,
  publicResellerPlanOptions,
  remainingPaidSeats,
  remainingSeats,
  remainingTrialSeats,
  summarizeSeatGrants,
} from "@/lib/reseller-store";
import { getResellerSession, publicResellerSession } from "@/lib/reseller-session";

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
  const clientExpiresAt = (user: { trialExpiresAt: string | null; subscriptionExpiresAt: string | null }) =>
    user.subscriptionExpiresAt || user.trialExpiresAt;
  const active = users.filter((user) => {
    const at = Date.parse(clientExpiresAt(user) || "");
    return Number.isFinite(at) && at > now;
  }).length;
  const expired = users.filter((user) => {
    const at = Date.parse(clientExpiresAt(user) || "");
    return Number.isFinite(at) && at <= now;
  }).length;

  return NextResponse.json({
    success: true,
    reseller: publicResellerSession(reseller),
    stats: {
      seatsPurchased: reseller.seatsPurchased,
      trialSeatsGranted: reseller.trialSeatsGranted || 0,
      userCount: usage.total,
      trialUserCount: usage.trial,
      paidUserCount: usage.paid,
      remainingSeats: remainingSeats(reseller, usage),
      remainingTrialSeats: remainingTrialSeats(reseller, usage.trial),
      remainingPaidSeats: remainingPaidSeats(reseller, usage.paid),
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
      trialExpiresAt: user.trialExpiresAt,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      createdAt: user.createdAt,
    })),
  });
}
