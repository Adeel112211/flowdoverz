import { NextResponse } from "next/server";
import { CLIENT_SID_COOKIE } from "@/lib/client-session";
import { sessionCookieOptions } from "@/lib/site-urls";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(CLIENT_SID_COOKIE, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
