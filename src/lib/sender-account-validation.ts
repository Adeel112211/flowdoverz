import { SENDER_PAYMENT_OPTION_GROUPS } from "@/lib/sender-payment-options";

const CASH_APP_IDS = new Set(
  SENDER_PAYMENT_OPTION_GROUPS.find((group) => group.id === "cash-apps")?.options.map((option) => option.id) ?? [],
);

export const PAKISTAN_MOBILE_DIGITS = 11;
export const PAKISTAN_BANK_ACCOUNT_DIGITS = 16;
export const PAKISTAN_IBAN_LENGTH = 24;

export function normalizeSenderAccountInput(value: string) {
  return value.trim().replace(/[\s-]/g, "").toUpperCase();
}

export function isSenderCashApp(senderSourceId: string) {
  return CASH_APP_IDS.has(senderSourceId);
}

function validatePakistaniIban(value: string): { ok: true; normalized: string } | { ok: false; error: string } {
  const iban = value.startsWith("PK") ? value : `PK${value}`;

  if (iban.length < PAKISTAN_IBAN_LENGTH) {
    return {
      ok: false,
      error: `IBAN is too short. Must be exactly ${PAKISTAN_IBAN_LENGTH} characters (you entered ${iban.length}).`,
    };
  }

  if (iban.length > PAKISTAN_IBAN_LENGTH) {
    return {
      ok: false,
      error: `IBAN is too long. Must be exactly ${PAKISTAN_IBAN_LENGTH} characters.`,
    };
  }

  if (!/^PK[0-9]{2}[A-Z0-9]{20}$/.test(iban)) {
    return { ok: false, error: "Enter a valid Pakistani IBAN." };
  }

  return { ok: true, normalized: iban };
}

function validateMobileWallet(digits: string): { ok: true; normalized: string } | { ok: false; error: string } {
  if (digits.length < PAKISTAN_MOBILE_DIGITS) {
    return {
      ok: false,
      error: `Mobile number is too short. Must be exactly ${PAKISTAN_MOBILE_DIGITS} digits (you entered ${digits.length}).`,
    };
  }

  if (digits.length > PAKISTAN_MOBILE_DIGITS) {
    return {
      ok: false,
      error: `Mobile number must be exactly ${PAKISTAN_MOBILE_DIGITS} digits. For bank account use ${PAKISTAN_BANK_ACCOUNT_DIGITS} digits.`,
    };
  }

  if (!/^03[0-9]{9}$/.test(digits)) {
    return { ok: false, error: "Enter a valid Pakistani mobile number starting with 03." };
  }

  return { ok: true, normalized: digits };
}

function validateBankAccount(digits: string): { ok: true; normalized: string } | { ok: false; error: string } {
  if (digits.length < PAKISTAN_BANK_ACCOUNT_DIGITS) {
    return {
      ok: false,
      error: `Bank account number is too short. Must be exactly ${PAKISTAN_BANK_ACCOUNT_DIGITS} digits (you entered ${digits.length}).`,
    };
  }

  if (digits.length > PAKISTAN_BANK_ACCOUNT_DIGITS) {
    return {
      ok: false,
      error: `Bank account number must be exactly ${PAKISTAN_BANK_ACCOUNT_DIGITS} digits, or use a ${PAKISTAN_IBAN_LENGTH}-character IBAN.`,
    };
  }

  return { ok: true, normalized: digits };
}

function validateDigitsOnly(digits: string): { ok: true; normalized: string } | { ok: false; error: string } {
  const len = digits.length;

  if (len < PAKISTAN_MOBILE_DIGITS) {
    return {
      ok: false,
      error: `Number is too short. Mobile: ${PAKISTAN_MOBILE_DIGITS} digits · Bank: ${PAKISTAN_BANK_ACCOUNT_DIGITS} digits · IBAN: ${PAKISTAN_IBAN_LENGTH} characters.`,
    };
  }

  if (len === PAKISTAN_MOBILE_DIGITS) {
    return validateMobileWallet(digits);
  }

  if (len > PAKISTAN_MOBILE_DIGITS && len < PAKISTAN_BANK_ACCOUNT_DIGITS) {
    return {
      ok: false,
      error: `Bank account number is too short. Must be exactly ${PAKISTAN_BANK_ACCOUNT_DIGITS} digits (you entered ${len}).`,
    };
  }

  if (len === PAKISTAN_BANK_ACCOUNT_DIGITS) {
    return validateBankAccount(digits);
  }

  if (len > PAKISTAN_BANK_ACCOUNT_DIGITS && len < PAKISTAN_IBAN_LENGTH) {
    return {
      ok: false,
      error: `Invalid length (${len} digits). Use exactly ${PAKISTAN_BANK_ACCOUNT_DIGITS} digits for bank account or ${PAKISTAN_IBAN_LENGTH} characters for IBAN starting with PK.`,
    };
  }

  if (len >= PAKISTAN_IBAN_LENGTH) {
    return {
      ok: false,
      error: `Too many digits. Use exactly ${PAKISTAN_MOBILE_DIGITS} (mobile), ${PAKISTAN_BANK_ACCOUNT_DIGITS} (bank), or a ${PAKISTAN_IBAN_LENGTH}-character IBAN starting with PK.`,
    };
  }

  return {
    ok: false,
    error: `Use exactly ${PAKISTAN_MOBILE_DIGITS} digits (mobile), ${PAKISTAN_BANK_ACCOUNT_DIGITS} digits (bank), or ${PAKISTAN_IBAN_LENGTH} characters (IBAN).`,
  };
}

export function validateSenderAccountNumber(
  value: string,
  _senderSourceId?: string,
): { ok: true; normalized: string } | { ok: false; error: string } {
  const normalized = normalizeSenderAccountInput(value);

  if (!normalized) {
    return { ok: false, error: "Please enter your sender account number." };
  }

  if (normalized.startsWith("PK")) {
    return validatePakistaniIban(normalized);
  }

  // Pure digits — must check before 22-char BBAN (digits also match [A-Z0-9])
  if (/^[0-9]+$/.test(normalized)) {
    return validateDigitsOnly(normalized);
  }

  // BBAN without PK prefix (contains letters, e.g. 00MEZN0000000000000000)
  if (/^[A-Z0-9]+$/.test(normalized) && normalized.length === 22 && /[A-Z]/.test(normalized)) {
    return validatePakistaniIban(normalized);
  }

  if (/^[A-Z0-9]+$/.test(normalized) && normalized.length < PAKISTAN_IBAN_LENGTH) {
    return {
      ok: false,
      error: `IBAN is too short. Must be exactly ${PAKISTAN_IBAN_LENGTH} characters (you entered ${normalized.length}).`,
    };
  }

  return {
    ok: false,
    error: "Enter a valid mobile number, bank account number, or Pakistani IBAN.",
  };
}
