import { resolveMx } from "dns/promises";
import {
  parseSignupEmail,
  isBlockedSignupDomain,
  looksLikeRandomSignupLocalPart,
  SIGNUP_EMAIL_REJECTED,
} from "./signup-email-rules";

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

  if (isBlockedSignupDomain(domain)) {
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
