import { NextRequest, NextResponse } from "next/server";
import { getUserStatus } from "@/lib/user-store";
import { emailFromSid } from "@/lib/cookie-store";
import { cookies } from "next/headers";

const SID_COOKIE = "flowdoverz_sid";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SID_COOKIE)?.value;

  if (!sid) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const email = emailFromSid(sid).startsWith("sid:")
    ? emailFromSid(sid).slice(4)
    : emailFromSid(sid);

  if (!email) {
    return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
  }

  const status = await getUserStatus(email);

  if (!status) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    status,
  });
}
