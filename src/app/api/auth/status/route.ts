import { NextRequest, NextResponse } from "next/server";
import { getUserStatus } from "@/lib/user-store";
import { getClientSessionFromCookies } from "@/lib/client-session";

export async function GET(_request: NextRequest) {
  const session = await getClientSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const status = await getUserStatus(session.email);
  if (!status) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    status,
  });
}
