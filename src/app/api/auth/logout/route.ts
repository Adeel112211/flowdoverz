import { NextResponse } from "next/server";
import { CLIENT_SID_COOKIE } from "@/lib/client-session";
import { clientSessionCookieOptions, sessionCookieOptions } from "@/lib/site-urls";
import { getClientSessionFromCookies } from "@/lib/client-session";
import { getDb } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/user-store";

export async function POST() {
  try {
    const session = await getClientSessionFromCookies();
    if (session?.sessionId) {
      const db = getDb();
      if (db) {
        // Drop this browser from the active device list so Solo lock is released.
        const ref = db.collection("users").doc(normalizeEmail(session.email));
        const snap = await ref.get();
        if (snap.exists) {
          const data = snap.data() || {};
          const ids = Array.isArray(data.activeClientSessionIds)
            ? data.activeClientSessionIds.map(String).filter((id: string) => id !== session.sessionId)
            : [];
          await ref.set(
            {
              activeClientSessionIds: ids,
              activeClientSessionId: ids[0] || null,
            },
            { merge: true },
          );
        }
      }
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
