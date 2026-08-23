import { NextRequest } from "next/server";
import {
  authenticateReseller,
  buildResellerIntegration,
  corsHeaders,
  jsonSafe,
} from "@/lib/reseller-http";
import { countResellerUsers, originsForReseller, remainingSeats } from "@/lib/reseller-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return jsonSafe({ success: true }, { headers: corsHeaders(request, []) });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateReseller(request);
  if (!auth.ok) return auth.response;

  const userCount = await countResellerUsers(auth.reseller.id);
  const integration = await buildResellerIntegration({
    ...auth.reseller,
    allowedOrigins: originsForReseller(auth.reseller),
  });

  return jsonSafe(
    {
      success: true,
      config: {
        ...integration,
        userCount,
        seatsPurchased: auth.reseller.seatsPurchased,
        remainingSeats: remainingSeats(auth.reseller, userCount),
        seatDays: auth.reseller.seatDays,
      },
    },
    { headers: auth.headers },
  );
}
