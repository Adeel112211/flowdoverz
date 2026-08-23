import { NextResponse } from "next/server";
import { getResellerUrl } from "@/lib/site-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE = `This open partner link is closed. Resellers sign in at ${getResellerUrl()} with their email and password.`;

export async function GET() {
  return NextResponse.json({ success: false, error: MESSAGE }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ success: false, error: MESSAGE }, { status: 410 });
}
