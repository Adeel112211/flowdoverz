export const DEMO_USER = {
  email: "demo@flowdoverz.app",
  password: "demo1234",
  name: "Demo User",
} as const;

const SESSION_KEY = "flowdoverz_session";
const SID_COOKIE = "flowdoverz_sid";

export type Session = {
  email: string;
  name: string;
  sid: string;
};

function writeSidCookie(sid: string) {
  document.cookie = `${SID_COOKIE}=${encodeURIComponent(sid)}; path=/; SameSite=Lax; max-age=2592000`;
}

function clearSidCookie() {
  document.cookie = `${SID_COOKIE}=; path=/; max-age=0`;
}

function persistSession(session: Session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  writeSidCookie(session.sid);
}

type AuthResult = { ok: true; session: Session } | { ok: false; error: string };

async function postAuth(
  path: string,
  body: Record<string, string>,
): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      user?: { email?: string; name?: string; sid?: string };
    } | null;

    if (!response.ok || !data?.success || !data.user?.email || !data.user?.sid) {
      return {
        ok: false,
        error: data?.error || "Something went wrong. Please try again.",
      };
    }

    const session: Session = {
      email: data.user.email,
      name: data.user.name || data.user.email,
      sid: data.user.sid,
    };

    if (typeof window !== "undefined") {
      persistSession(session);
    }

    return { ok: true, session };
  } catch {
    return { ok: false, error: "Could not reach the server. Is FlowDoverz running?" };
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  return postAuth("/api/auth/login", {
    email: email.trim(),
    password,
  });
}

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  return postAuth("/api/auth/register", {
    email: email.trim(),
    password,
    name: name.trim(),
  });
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.email || !parsed.name || !parsed.sid) return null;
    writeSidCookie(parsed.sid);
    return parsed as Session;
  } catch {
    return null;
  }
}

export function signOut() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
    clearSidCookie();
  }
}

export function getSidFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SID_COOKIE}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(SID_COOKIE.length + 1));
}
