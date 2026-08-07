import { NextRequest, NextResponse } from "next/server";
import { getUserStatus, getPlanActivationBlock } from "@/lib/user-store";
import { getClientSessionFromRequest } from "@/lib/client-session";

export async function GET(request: NextRequest) {
  const session = getClientSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const status = await getUserStatus(session.email);
  if (!status) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const activationBlock = await getPlanActivationBlock(session.email);

  return NextResponse.json({ success: true, status, activationBlock });
}
