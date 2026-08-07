import disposableDomains from "disposable-email-domains";

const DISPOSABLE = new Set(disposableDomains.map((d) => d.toLowerCase()));

const BLOCKED_DOMAIN_SUFFIXES = [
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "sharklasers.com",
  "grr.la",
  "pokemail.net",
  "spam4.me",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "throwaway.email",
  "getnada.com",
  "maildrop.cc",
  "trashmail.com",
  "fakeinbox.com",
  "dispostable.com",
  "mailnesia.com",
  "mailcatch.com",
  "mintemail.com",
  "emailondeck.com",
  "mail.tm",
  "moakt.com",
  "mohmal.com",
  "burnermail.io",
  "inboxkitten.com",
  "tmpmail.org",
  "tmpmail.net",
  "dropmail.me",
  "harakirimail.com",
  "spamgourmet.com",
  "mytemp.email",
  "mailpoof.com",
  "tmail.ws",
  "getairmail.com",
  "crazymailing.com",
  "mailforspam.com",
  "spambox.us",
  "emkei.cz",
  "mailnull.com",
  "spambog.com",
  "trashmail.me",
  "mailscrap.com",
];

const BLOCKED_DOMAIN_KEYWORDS = [
  "tempmail",
  "temp-mail",
  "trashmail",
  "disposable",
  "throwaway",
  "fakeinbox",
  "guerrillamail",
  "mailinator",
  "yopmail",
  "getnada",
  "maildrop",
  "10minute",
  "minutemail",
  "spambox",
  "spambog",
  "burner",
  "tmpmail",
  "fakemail",
  "trashbox",
  "mailsac",
  "mailcatch",
  "mohmal",
  "mailnesia",
];

const BLOCKED_LOCAL_PARTS = new Set([
  "test",
  "testing",
  "fake",
  "spam",
  "temp",
  "tmp",
  "trash",
  "disposable",
  "noreply",
  "no-reply",
  "random",
  "demo",
  "user",
  "guest",
  "anonymous",
]);

export const SIGNUP_EMAIL_REJECTED = "This email address can't be used.";

export function parseSignupEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain.includes(".")) return null;
  if (domain.startsWith(".") || domain.endsWith(".")) return null;
  return { normalized, local, domain };
}

function domainHasBlockedKeyword(domain: string): boolean {
  const lower = domain.toLowerCase();
  return BLOCKED_DOMAIN_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function isBlockedSignupDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  if (DISPOSABLE.has(lower)) return true;
  if (domainHasBlockedKeyword(lower)) return true;
  return BLOCKED_DOMAIN_SUFFIXES.some(
    (suffix) => lower === suffix || lower.endsWith(`.${suffix}`),
  );
}

function looksLikeRandomToken(value: string): boolean {
  if (value.length < 8) return false;
  if (/^[a-f0-9]{8,}$/i.test(value)) return true;
  if (/^[a-z0-9._-]{10,}$/i.test(value) && !/[aeiou]/i.test(value)) return true;
  // Long alphanumeric strings without vowels (e.g. x7k9m2p4q1w8) — not normal names like dazzygameplay12
  if (
    /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{12,}$/i.test(value) &&
    !value.includes(".") &&
    !/[aeiou]/i.test(value)
  ) {
    return true;
  }
  return false;
}

export function looksLikeRandomSignupLocalPart(local: string): boolean {
  const base = local.split("+")[0].split(".")[0];
  if (base.length < 2) return true;
  if (BLOCKED_LOCAL_PARTS.has(base)) return true;
  if (/^[0-9]+$/.test(base)) return true;
  if (looksLikeRandomToken(base)) return true;

  const segments = local.split(/[.+_-]/).filter(Boolean);
  if (segments.some((segment) => looksLikeRandomToken(segment))) return true;

  return false;
}

export function validateSignupEmailClient(
  email: string,
  options?: { allowedDomains?: string[] },
): { ok: true; email: string } | { ok: false; error: string } {
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

  return { ok: true, email: normalized };
}
