import { resolveMx } from "dns/promises";
import {
  parseSignupEmail,
  isBlockedSignupDomain,
  looksLikeRandomSignupLocalPart,
  SIGNUP_EMAIL_REJECTED,
} from "./signup-email-rules";

let packagedSet: Set<string> | null = null;
let wildcardSuffixes: string[] = [];
let liveSet: Set<string> | null = null;
let liveLoadedAt = 0;

const LIVE_TTL_MS = 6 * 60 * 60 * 1000;
const LIVE_LIST_URLS = [
  "https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt",
  "https://disposable.github.io/disposable-email-domains/domains.txt",
];

const DISPOSABLE_MX_HINTS = [
  "mailinator",
  "guerrillamail",
  "tempmail",
  "temp-mail",
  "yopmail",
  "trashmail",
  "maildrop",
  "sharklasers",
  "spam4.me",
  "discard.email",
  "moakt",
  "mohmal",
  "getnada",
  "mailnesia",
  "inboxkitten",
  "dropmail",
  "harakirimail",
  "10minutemail",
  "throwaway",
  "fakeinbox",
  "dispostable",
  "mailcatch",
  "tempr.email",
  "tmpmail",
  "tmpeml",
  "mail.tm",
  "emailfake",
  "generator.email",
  "1secmail",
  "emailnator",
  "smailpro",
  "minuteinbox",
  "jetable",
  "wabblywabble",
  "wallywatts",
  "dnsink",
];

function unwrapStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item));
  if (raw && typeof raw === "object" && Array.isArray((raw as { default?: unknown }).default)) {
    return ((raw as { default: unknown[] }).default).map((item) => String(item));
  }
  return [];
}

function loadPackagedSets() {
  if (packagedSet) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    packagedSet = new Set(
      unwrapStringList(require("disposable-email-domains")).map((d) => d.toLowerCase()),
    );
  } catch {
    packagedSet = new Set();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    wildcardSuffixes = unwrapStringList(require("disposable-email-domains/wildcard.json")).map((d) =>
      d.toLowerCase().replace(/^\*\./, ""),
    );
  } catch {
    wildcardSuffixes = [];
  }
}

function domainInSet(domain: string, set: Set<string> | null): boolean {
  if (!set || set.size === 0) return false;
  const lower = domain.toLowerCase();
  if (set.has(lower)) return true;
  const parts = lower.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (set.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

function isInPackagedDisposable(domain: string): boolean {
  loadPackagedSets();
  if (domainInSet(domain, packagedSet)) return true;
  const lower = domain.toLowerCase();
  return wildcardSuffixes.some((suffix) => lower === suffix || lower.endsWith(`.${suffix}`));
}

async function loadLiveDisposableSet(): Promise<Set<string>> {
  if (liveSet && Date.now() - liveLoadedAt < LIVE_TTL_MS) return liveSet;

  for (const url of LIVE_LIST_URLS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/plain" },
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      const next = new Set<string>();
      for (const line of text.split(/\r?\n/)) {
        const domain = line.trim().toLowerCase();
        if (!domain || domain.startsWith("#") || !domain.includes(".")) continue;
        next.add(domain);
      }
      if (next.size > 1000) {
        liveSet = next;
        liveLoadedAt = Date.now();
        return next;
      }
    } catch {
      // try the next source
    }
  }

  return liveSet || new Set();
}

function mxLooksDisposable(exchanges: string[]): boolean {
  const blob = exchanges.join(" ").toLowerCase();
  return DISPOSABLE_MX_HINTS.some((hint) => blob.includes(hint));
}

async function lookupMxExchanges(domain: string): Promise<string[]> {
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MX lookup timeout")), 4000),
      ),
    ]);
    if (!Array.isArray(records)) return [];
    return records.map((row) => String(row.exchange || "").replace(/\.$/, "").toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function validateSignupEmail(
  email: string,
  options?: { allowedDomains?: string[] },
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const parsed = parseSignupEmail(email);
  if (!parsed) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  const { normalized, local, domain } = parsed;

  if (options?.allowedDomains && options.allowedDomains.length > 0) {
    const allowed = options.allowedDomains.map((d) => d.toLowerCase());
    const domainOk = allowed.some(
      (entry) => domain === entry || domain.endsWith(`.${entry}`),
    );
    if (!domainOk) {
      return { ok: false, error: SIGNUP_EMAIL_REJECTED };
    }
  }

  if (isBlockedSignupDomain(domain)) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  if (isInPackagedDisposable(domain)) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  const live = await loadLiveDisposableSet();
  if (domainInSet(domain, live)) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  if (looksLikeRandomSignupLocalPart(local)) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  const exchanges = await lookupMxExchanges(domain);
  if (exchanges.length === 0) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }
  if (mxLooksDisposable(exchanges)) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }
  if (exchanges.some((host) => domainInSet(host, live) || isInPackagedDisposable(host))) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  return { ok: true, email: normalized };
}

export { validateSignupEmailClient, SIGNUP_EMAIL_REJECTED } from "./signup-email-rules";
