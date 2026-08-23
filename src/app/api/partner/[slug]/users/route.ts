import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE = "This open partner link is closed. Resellers sign in at /reseller with their email and password.";

export async function POST() {
  return NextResponse.json({ success: false, error: MESSAGE }, { status: 410 });
}
