import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email-verification";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const email = request.nextUrl.searchParams.get("email") || "";

  if (!token || !email) {
    return NextResponse.json(
      { success: false, error: "Missing verification link parameters." },
      { status: 400 },
    );
  }

  const result = await verifyEmailToken(email, token);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: "Email verified. Your trial is now active." });
}

export async function POST(request: NextRequest) {
  let body: { email?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const result = await verifyEmailToken(String(body.email || ""), String(body.token || ""));
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: "Email verified. Your trial is now active." });
}
