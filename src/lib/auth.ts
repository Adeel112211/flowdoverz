import { applyMaintenanceFromPayload } from "@/lib/maintenance-client";

const SESSION_KEY = "flowdoverz_session";
const SESSION_CHANGE = "flowdoverz_session_change";

let cachedSession: Session | null | undefined;

function invalidateSessionCache() {
  cachedSession = undefined;
}

export function notifySessionChange() {
  if (typeof window !== "undefined") {
    invalidateSessionCache();
    window.dispatchEvent(new Event(SESSION_CHANGE));
  }
}

export function subscribeSession(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SESSION_CHANGE, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(SESSION_CHANGE, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export type Session = {
  email: string;
  name: string;
  sid: string;
};

function persistSession(session: Session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  cachedSession = session;
  notifySessionChange();
}

type AuthResult =
  | { ok: true; session: Session; trialGranted?: boolean; notice?: string }
  | { ok: false; error: string; code?: string };

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
      code?: string;
      until?: string;
      notice?: string;
      trialGranted?: boolean;
      user?: { email?: string; name?: string; sid?: string };
    } | null;

    if (applyMaintenanceFromPayload(data)) {
      return { ok: false, error: "", code: "MAINTENANCE" };
    }

    if (!response.ok || !data?.success || !data.user?.email || !data.user?.sid) {
      return {
        ok: false,
        error:
          data?.error ||
          (data?.code === "MULTI_DEVICE_BLOCKED"
            ? "This email has an active Solo plan and cannot be used on multiple devices."
            : "Something went wrong. Please try again."),
        code: data?.code,
      };
    }

    const session: Session = {
      email: data.user.email,
      name: data.user.name || data.user.email,
      sid: data.user.sid,
    };

    if (typeof window !== "undefined") {
      persistSession(session);
      if (data.notice) {
        window.sessionStorage.setItem("flowdoverz_signup_notice", data.notice);
      } else {
        window.sessionStorage.removeItem("flowdoverz_signup_notice");
      }
    }

    return {
      ok: true,
      session,
      trialGranted: data.trialGranted,
      notice: data.notice,
    };
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
  verificationCode: string,
): Promise<AuthResult> {
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (verificationCode.replace(/\D/g, "").length !== 6) {
    return { ok: false, error: "Enter the 6-digit verification code." };
  }

  return postAuth("/api/auth/register", {
    email: email.trim(),
    password,
    name: name.trim(),
    verificationCode: verificationCode.replace(/\D/g, ""),
  });
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (cachedSession !== undefined) return cachedSession;

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    cachedSession = null;
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.email || !parsed.name || !parsed.sid) {
      cachedSession = null;
      return null;
    }
    cachedSession = parsed as Session;
    return cachedSession;
  } catch {
    cachedSession = null;
    return null;
  }
}

/** Restore dashboard session from the HttpOnly cookie via /api/auth/me. */
export async function restoreSessionFromCookie(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      code?: string;
      error?: string;
      until?: string;
      user?: { email?: string; name?: string; sid?: string };
    } | null;

    if (applyMaintenanceFromPayload(data)) {
      return getSession();
    }

    if (response.status === 401) {
      if (data?.code === "SESSION_REPLACED") {
        window.localStorage.removeItem(SESSION_KEY);
        cachedSession = null;
        notifySessionChange();
        if (data.error) {
          window.sessionStorage.setItem("flowdoverz_session_notice", data.error);
        }
        return null;
      }
      // Cookie missing or expired — keep local session so a refresh does not look like a logout.
      return getSession();
    }

    if (!response.ok || !data?.success || !data.user?.email || !data.user?.sid) {
      return getSession();
    }

    const session: Session = {
      email: data.user.email,
      name: data.user.name || data.user.email,
      sid: data.user.sid,
    };
    persistSession(session);
    return session;
  } catch {
    return getSession();
  }
}

export async function signOut() {
  if (typeof window !== "undefined") {
    let sid: string | undefined;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { sid?: string } | null;
        if (typeof parsed?.sid === "string") sid = parsed.sid;
      }
    } catch {
      // ignore
    }

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(sid ? { sid } : {}),
      });
    } catch {
      // non-blocking
    }

    window.localStorage.removeItem(SESSION_KEY);
    try {
      window.localStorage.removeItem("flowdoverz_auth_tabs");
    } catch {
      // ignore
    }
    cachedSession = null;
    notifySessionChange();
  }
}

export function getSidFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("flowdoverz_sid="));
  if (!match) return null;
  return decodeURIComponent(match.slice("flowdoverz_sid=".length));
}
