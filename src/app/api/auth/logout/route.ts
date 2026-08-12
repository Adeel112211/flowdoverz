import { NextRequest, NextResponse } from "next/server";
import {
  CLIENT_SID_COOKIE,
  getClientSessionFromRequest,
  verifyClientSession,
} from "@/lib/client-session";
import { clientSessionCookieOptions, sessionCookieOptions } from "@/lib/site-urls";
import { releaseClientSession } from "@/lib/user-store";

async function sidFromRequestBody(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { sid?: string } | null;
      return typeof body?.sid === "string" ? body.sid : null;
    }

    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const form = await request.formData();
      const sid = form.get("sid");
      return typeof sid === "string" ? sid : null;
    }

    // sendBeacon often posts as text/plain
    const text = (await request.text()).trim();
    if (!text) return null;
    if (text.startsWith("{")) {
      const body = JSON.parse(text) as { sid?: string };
      return typeof body.sid === "string" ? body.sid : null;
    }
    if (text.startsWith("sid=")) {
      return decodeURIComponent(text.slice(4));
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const cookieSession = getClientSessionFromRequest(request);
    const bodySid = await sidFromRequestBody(request);
    const bodySession = bodySid ? verifyClientSession(bodySid) : null;

    const email = cookieSession?.email || bodySession?.email;
    const sessionId = cookieSession?.sessionId || bodySession?.sessionId;

    if (email && sessionId) {
      await releaseClientSession(email, sessionId);
    }
  } catch {
    // still clear cookie
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(CLIENT_SID_COOKIE, "", {
    ...clientSessionCookieOptions(),
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
