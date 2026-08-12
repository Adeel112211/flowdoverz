import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getClientSessionFromCookies,
  getClientSessionFromRequest,
} from "@/lib/client-session";
import {
  isActiveClientSession,
  SESSION_REPLACED_MESSAGE,
} from "@/lib/user-store";

export async function requireActiveClientSession(
  request?: NextRequest,
): Promise<
  | { ok: true; email: string; sid: string; sessionId: string }
  | { ok: false; response: NextResponse }
> {
  const session = request
    ? getClientSessionFromRequest(request)
    : await getClientSessionFromCookies();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Not logged in", code: "NOT_LOGGED_IN" },
        { status: 401 },
      ),
    };
  }

  const active = await isActiveClientSession(session.email, session.sessionId);
  if (!active) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: SESSION_REPLACED_MESSAGE,
          code: "SESSION_REPLACED",
        },
        { status: 401 },
      ),
    };
  }

  return { ok: true, ...session };
}
