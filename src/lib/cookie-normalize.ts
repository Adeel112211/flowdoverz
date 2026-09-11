import type { FlowCookie } from "@/lib/cookie-analysis";

/** Flow session cookies must exist on all three hosts — Chrome treats them separately. */
export const FLOW_HOSTS = ["flow.google.com", "labs.google", "labs.google.com"] as const;

const HOST_SESSION_NAMES = new Set(["OSID", "__Secure-OSID"]);

/** One-time OAuth artifacts — stale values break Flow login when injected. */
const DROP_COOKIE_NAMES = new Set([
  "__Secure-next-auth.pkce.code_verifier",
  "__Secure-next-auth.state",
]);

function hostFromDomain(domain: string | undefined): string | null {
  if (!domain) return null;
  const host = domain.replace(/^\./, "").toLowerCase();
  return host || null;
}

function cookieKeyParts(name: string, domain: string, path = "/"): string {
  return `${name}@${domain}@${path}`;
}

function cookieKey(cookie: FlowCookie): string {
  return cookieKeyParts(cookie.name, cookie.domain || "", cookie.path || "/");
}

function cloneForHost(cookie: FlowCookie, host: string): FlowCookie {
  const cloned: FlowCookie = {
    ...cookie,
    domain: host,
    hostOnly: true,
    url: `https://${host}/`,
  };
  if (cookie.name.startsWith("__Secure-") || cookie.secure) {
    cloned.secure = true;
  }
  if (cookie.name === "__Secure-OSID" && !cloned.sameSite) {
    cloned.sameSite = "no_restriction";
  }
  return cloned;
}

/**
 * Mirror OSID across flow.google.com, labs.google, and labs.google.com.
 * When flow and labs disagree, flow.google.com wins. Missing hosts are filled from flow OSID.
 */
export function normalizeFlowCookies(cookies: FlowCookie[]): FlowCookie[] {
  const filtered = cookies.filter((cookie) => !DROP_COOKIE_NAMES.has(cookie.name));
  const byKey = new Map<string, FlowCookie>();
  for (const cookie of filtered) {
    byKey.set(cookieKey(cookie), cookie);
  }

  for (const name of HOST_SESSION_NAMES) {
    const flowKey = cookieKeyParts(name, "flow.google.com");
    const labsKey = cookieKeyParts(name, "labs.google");
    const flowCookie = byKey.get(flowKey);
    const labsCookie = byKey.get(labsKey);
    if (
      flowCookie &&
      labsCookie &&
      flowCookie.value !== labsCookie.value
    ) {
      byKey.set(labsKey, cloneForHost(flowCookie, "labs.google"));
    }
  }

  const result = [...byKey.values()];
  const seen = new Set(byKey.keys());

  for (const cookie of [...result]) {
    if (!HOST_SESSION_NAMES.has(cookie.name)) continue;
    const sourceHost = hostFromDomain(cookie.domain);
    if (!sourceHost || !(FLOW_HOSTS as readonly string[]).includes(sourceHost)) continue;

    for (const targetHost of FLOW_HOSTS) {
      if (targetHost === sourceHost) continue;
      const mirrored = cloneForHost(cookie, targetHost);
      const key = cookieKey(mirrored);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(mirrored);
    }
  }

  return result;
}
