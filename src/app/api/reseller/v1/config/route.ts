import { NextRequest } from "next/server";
import {
  authenticateReseller,
  buildResellerIntegration,
  corsHeaders,
  jsonSafe,
} from "@/lib/reseller-http";
import { countResellerSeatUsage, originsForReseller, remainingPaidSeats, remainingSeats, remainingTrialSeats } from "@/lib/reseller-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return jsonSafe({ success: true }, { headers: corsHeaders(request, []) });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateReseller(request);
  if (!auth.ok) return auth.response;

  const usage = await countResellerSeatUsage(auth.reseller.id);
  const integration = await buildResellerIntegration({
    ...auth.reseller,
    allowedOrigins: originsForReseller(auth.reseller),
  });

  return jsonSafe(
    {
      success: true,
      config: {
        ...integration,
        userCount: usage.total,
        trialUserCount: usage.trial,
        paidUserCount: usage.paid,
        seatsPurchased: auth.reseller.seatsPurchased,
        trialSeatsGranted: auth.reseller.trialSeatsGranted || 0,
        remainingSeats: remainingSeats(auth.reseller, usage),
        remainingTrialSeats: remainingTrialSeats(auth.reseller, usage.trial),
        remainingPaidSeats: remainingPaidSeats(auth.reseller, usage.paid),
        seatDays: auth.reseller.seatDays,
      },
    },
    { headers: auth.headers },
  );
}
