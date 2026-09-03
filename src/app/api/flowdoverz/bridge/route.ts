import { NextRequest, NextResponse } from "next/server";
import { requireActiveClientSession } from "@/lib/require-client-session";
import { publicMaintenanceResponse } from "@/lib/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Branded reseller portals call this so the extension can read the client sid without flow.doverz.com login. */
async function bridgeResponse(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const gate = await requireActiveClientSession(request);
  if (!gate.ok) return gate.response;

  return NextResponse.json({
    success: true,
    sid: gate.sid,
    email: gate.email,
    user: {
      email: gate.email,
      sid: gate.sid,
    },
  });
}

export async function GET(request: NextRequest) {
  return bridgeResponse(request);
}

export async function POST(request: NextRequest) {
  return bridgeResponse(request);
}
