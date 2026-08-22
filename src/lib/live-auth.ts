import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin";
import { CLIENT_SID_COOKIE, verifyClientSession } from "@/lib/client-session";
import type { LiveEvent } from "@/lib/live-tick";

export type LivePrincipal =
  | { role: "admin" }
  | { role: "client"; userId: string }
  | { role: "anon" };

const PUBLIC_TOPICS = new Set(["maintenance", "settings", "extension", "cookies"]);

function cookieValue(header: string, name: string): string | undefined {
  const parts = header.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1));
    } catch {
      return part.slice(eq + 1);
    }
  }
  return undefined;
}

export async function resolveLivePrincipal(request: Request): Promise<LivePrincipal> {
  const header = request.headers.get("cookie") || "";
  const adminHeader = request.headers.get("x-admin-token");
  if (await verifyAdminToken(adminHeader) || await verifyAdminToken(cookieValue(header, ADMIN_COOKIE))) {
    return { role: "admin" };
  }
  const session = verifyClientSession(cookieValue(header, CLIENT_SID_COOKIE));
  if (session?.email) {
    return { role: "client", userId: session.email.toLowerCase() };
  }
  return { role: "anon" };
}

export function allowLiveEvent(principal: LivePrincipal, event: LiveEvent): boolean {
  if (event.type === "ping" || event.type === "hello" || event.type === "resync") return true;
  if (principal.role === "admin") return true;

  const topic = String(event.topic || "");
  if (PUBLIC_TOPICS.has(topic)) return true;

  if (principal.role === "client") {
    const owner = String(event.userId || event.id || "").toLowerCase();
    if ((topic === "user" || topic === "payment") && owner && owner === principal.userId) return true;
  }

  return false;
}

/** Strip last-document identity from handshake / keepalive payloads. */
export function publicLiveEnvelope(event: LiveEvent): LiveEvent {
  if (event.type === "hello" || event.type === "ping") {
    return { type: event.type, rev: event.rev, at: event.at };
  }
  return event;
}
