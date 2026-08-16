import { NextRequest, NextResponse } from "next/server";
import { getUserStatus, getPlanActivationBlock } from "@/lib/user-store";
import { requireActiveClientSession } from "@/lib/require-client-session";
import { publicMaintenanceResponse } from "@/lib/maintenance";

export async function GET(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const gate = await requireActiveClientSession(request);
  if (!gate.ok) return gate.response;

  const status = await getUserStatus(gate.email);
  if (!status) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const activationBlock = await getPlanActivationBlock(gate.email);

  return NextResponse.json({ success: true, status, activationBlock });
}
