/**
 * Shared signup email rules (safe for client + server).
 * Heavy disposable-domain lists are applied on the server in signup-email-policy.ts.
 */

/** Domains known to be temp / disposable (kept light for the browser bundle). */
const BLOCKED_DOMAIN_SUFFIXES = [
  "dnsink.com",
  "dnsink.net",
  "dnsink.org",
  "tempmail.lol",
  "tempmail.ninja",
  "tempmail.dev",
  "tempmaili.com",
  "tempmailgen.com",
  "mail-temp.com",
  "gettempmail.com",
  "emailnator.com",
  "smailpro.com",
  "mail.gw",
  "tmail.io",
  "tmailor.com",
  "minuteinbox.com",
  "minmail.app",
  "luxusmail.org",
  "jetable.org",
  "fakemail.net",
  "throwawaymail.com",
  "10minemail.com",
  "tmpnator.live",
  "dismail.de",
  "mailtemp.uk",
  "burnmail.io",
  "moakt.ws",
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "mailinator2.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "pokemail.net",
  "spam4.me",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "tempail.com",
  "tempr.email",
  "tempmail.plus",
  "tempinbox.com",
  "temporarymail.com",
  "temporary-mail.net",
  "tempmailaddress.com",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "throwaway.email",
  "throwam.com",
  "getnada.com",
  "maildrop.cc",
  "trashmail.com",
  "trash-mail.com",
  "trashemail.de",
  "trashmail.me",
  "fakeinbox.com",
  "fakemailgenerator.com",
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
  "tmpeml.com",
  "tmpbox.net",
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
  "mailscrap.com",
  "discard.email",
  "emailfake.com",
  "generator.email",
  "emailtemporario.com.br",
  "emailtemp.org",
  "emailna.co",
  "linshiyouxiang.net",
  "1secmail.com",
  "1secmail.org",
  "1secmail.net",
  "secmail.pro",
  "spamfree24.org",
  "wegwerfmail.de",
  "byom.de",
  "mailnator.com",
  "nowmymail.com",
  "easytrashmail.com",
  "inboxbear.com",
  "safetymail.info",
  "spamherelots.com",
  "binkmail.com",
  "bobmail.info",
  "devnullmail.com",
  "letthemeatspam.com",
  "mailin8r.com",
  "mailinater.com",
  "notmailinator.com",
  "reallymymail.com",
  "reconmail.com",
  "sogetthis.com",
  "spamhereplease.com",
  "superrito.com",
  "thisisnotmyrealemail.com",
  "trbvm.com",
  "veryrealemail.com",
  "zippymail.info",
];

const BLOCKED_DOMAIN_KEYWORDS = [
  "tempmail",
  "temp-mail",
  "tempinbox",
  "temporarymail",
  "temporary-mail",
  "trashmail",
  "trash-mail",
  "disposable",
  "throwaway",
  "fakeinbox",
  "fakemail",
  "guerrillamail",
  "emailnator",
  "smailpro",
  "tmailor",
  "minuteinbox",
  "minmail",
  "jetable",
  "throwawaymail",
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
  "tmpeml",
  "trashbox",
  "mailsac",
  "mailcatch",
  "mohmal",
  "mailnesia",
  "dnsink",
  "emailsink",
  "mailsink",
  "tempsink",
  "wabblywabble",
  "wallywatts",
  "mailsucker",
  "throwam",
  "wegwerf",
  "secmail",
  "1secmail",
];

const TEMP_LABEL_RE =
  /^(?:temp|tmp|trash|fake|spam|disposable|throwaway|burner|guerrilla|mailinator|yopmail|dnsink|mails?ink|emailsink|tempsink|tempmail|tempail|trashmail|fakemail|getnada|maildrop|minutemail|10minute|spambox|moakt|mohmal|discard|dropmail|inboxkitten|mailpoof|mailnull|mailscrap|tempr|byom|secmail)/i;

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

export const SIGNUP_EMAIL_REJECTED =
  "Temporary or disposable email addresses are not allowed. Use a real email (Gmail, Outlook, Yahoo, etc.).";

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
  const compact = domain.toLowerCase().replace(/[.-]/g, "");
  return BLOCKED_DOMAIN_KEYWORDS.some((keyword) =>
    compact.includes(keyword.replace(/[.-]/g, "")),
  );
}

function labelLooksLikeTempMail(label: string): boolean {
  const value = label.toLowerCase();
  if (TEMP_LABEL_RE.test(value)) return true;
  if (value.includes("sink") && /(dns|mail|email|temp|tmp|trash|fake)/.test(value)) {
    return true;
  }
  if (value.includes("temp") && /(mail|inbox|box|email|addr)/.test(value)) {
    return true;
  }
  return false;
}

export function isBlockedSignupDomain(
  domain: string,
  extraBlocked: Iterable<string> = [],
): boolean {
  const lower = domain.toLowerCase().trim();
  if (!lower) return true;

  const extras = extraBlocked instanceof Set ? extraBlocked : new Set(
    Array.from(extraBlocked, (d) => String(d).toLowerCase()),
  );

  if (extras.has(lower)) return true;

  const parts = lower.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (extras.has(parent)) return true;
  }

  if (domainHasBlockedKeyword(lower)) return true;
  if (parts.some((label) => labelLooksLikeTempMail(label))) return true;

  return BLOCKED_DOMAIN_SUFFIXES.some(
    (suffix) => lower === suffix || lower.endsWith(`.${suffix}`),
  );
}

function looksLikeRandomToken(value: string): boolean {
  if (value.length < 8) return false;
  if (/^[a-f0-9]{8,}$/i.test(value)) return true;
  if (/^[a-z0-9._-]{10,}$/i.test(value) && !/[aeiou]/i.test(value)) return true;
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
