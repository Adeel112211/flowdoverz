import { resolveMx } from "dns/promises";
import {
  parseSignupEmail,
  isBlockedSignupDomain,
  looksLikeRandomSignupLocalPart,
  SIGNUP_EMAIL_REJECTED,
} from "./signup-email-rules";

let disposableSet: Set<string> | null = null;
let wildcardSuffixes: string[] = [];

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

async function domainHasMx(domain: string): Promise<boolean> {
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MX lookup timeout")), 4000),
      ),
    ]);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
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

  // Fast local patterns + curated list (also used in the browser)
  if (isBlockedSignupDomain(domain)) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  // Full npm disposable list (server-only, ~120k domains)
  if (isInDisposablePackage(domain)) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  if (looksLikeRandomSignupLocalPart(local)) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  const hasMx = await domainHasMx(domain);
  if (!hasMx) {
    return { ok: false, error: SIGNUP_EMAIL_REJECTED };
  }

  return { ok: true, email: normalized };
}

export { validateSignupEmailClient, SIGNUP_EMAIL_REJECTED } from "./signup-email-rules";
