export type AdminAuthMode = "pin" | "password";

export const ADMIN_PIN_LENGTH = 4;
export const ADMIN_RESET_CODE_LENGTH = 8;
export const ADMIN_PASSWORD_MIN_LENGTH = 8;

export function normalizeAdminAuthMode(value: unknown): AdminAuthMode | null {
  if (value === "pin" || value === "password") return value;
  return null;
}
