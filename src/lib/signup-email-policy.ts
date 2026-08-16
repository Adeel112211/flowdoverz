import { resolveMx } from "dns/promises";
import {
  parseSignupEmail,
  isBlockedSignupDomain,
  looksLikeRandomSignupLocalPart,
  SIGNUP_EMAIL_REJECTED,
} from "./signup-email-rules";

let disposableSet: Set<string> | null = null;
let wildcardSuffixes: string[] = [];

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
];

function loadDisposableSets() {
  if (disposableSet) return;

  try {
    // Server-only: keep the huge list out of the browser bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const list = require("disposable-email-domains") as string[];
    disposableSet = new Set(
      (Array.isArray(list) ? list : []).map((d) => String(d).toLowerCase()),
    );
  } catch {
    disposableSet = new Set();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wildcards = require("disposable-email-domains/wildcard.json") as string[];
    wildcardSuffixes = (Array.isArray(wildcards) ? wildcards : []).map((d) =>
      String(d).toLowerCase().replace(/^\*\./, ""),
    );
  } catch {
    wildcardSuffixes = [];
  }
}

function isInDisposablePackage(domain: string): boolean {
  loadDisposableSets();
  const lower = domain.toLowerCase();
  if (disposableSet?.has(lower)) return true;

  const parts = lower.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (disposableSet?.has(parts.slice(i).join("."))) return true;
  }

  return wildcardSuffixes.some(
    (suffix) => lower === suffix || lower.endsWith(`.${suffix}`),
  );
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
    return records.map((row) => String(row.exchange || "").toLowerCase()).filter(Boolean);
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

  if (isInDisposablePackage(domain)) {
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

  return { ok: true, email: normalized };
}

export { validateSignupEmailClient, SIGNUP_EMAIL_REJECTED } from "./signup-email-rules";
