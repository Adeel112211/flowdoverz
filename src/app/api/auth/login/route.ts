import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/user-store";
import { CLIENT_SID_COOKIE } from "@/lib/client-session";
import { sessionCookieOptions } from "@/lib/site-urls";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await authenticateUser(
    String(body.email || ""),
    String(body.password || ""),
  );

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    success: true,
    user: {
      email: result.user.email,
      name: result.user.name,
      sid: result.user.sid,
    },
  });

  response.cookies.set(CLIENT_SID_COOKIE, result.user.sid, sessionCookieOptions(60 * 60 * 24 * 30));

  return response;
}
