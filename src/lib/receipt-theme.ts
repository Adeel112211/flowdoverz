import type { EmailThemeColors } from "./email-theme";
import { DEFAULT_EMAIL_COLORS } from "./email-theme";

/** FlowDoverz dark receipt palette (matches site admin theme). */
export const RECEIPT_THEME = {
  paper: "#030308",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textSoft: "#94a3b8",
  accent: "#22d3ee",
  accentDeep: "#0891b2",
  total: "#34d399",
  dots: "#334155",
  divider: "rgba(148,163,184,0.35)",
  barcode: "#22d3ee",
  glow: "0 12px 28px rgba(6,182,212,0.22)",
  gradient: "linear-gradient(90deg,#06b6d4,#14b8a6)",
  stampBorder: "rgba(34,211,238,0.45)",
  stampBg: "rgba(8,8,16,0.95)",
  tearPrimary: "#06b6d4",
  tearSecondary: "#14b8a6",
} as const;

export type ReceiptTheme = {
  [K in keyof typeof RECEIPT_THEME]: string;
};

/** Map email template colors onto the thermal receipt palette. */
export function resolveReceiptTheme(
  emailColors?: Partial<EmailThemeColors>,
  style: keyof typeof DEFAULT_EMAIL_COLORS = "modern",
): ReceiptTheme {
  const base = DEFAULT_EMAIL_COLORS[style];
  const c = { ...base, ...emailColors };
  return {
    ...RECEIPT_THEME,
    paper: c.card,
    text: c.heading,
    textMuted: c.text,
    textSoft: c.text,
    accent: c.primary,
    accentDeep: c.primary,
    total: c.secondary,
    barcode: c.primary,
    divider: c.border,
    gradient: `linear-gradient(90deg,${c.primary},${c.secondary})`,
    glow: `0 12px 28px ${hexToRgba(c.primary, 0.22)}`,
    tearPrimary: c.primary,
    tearSecondary: c.secondary,
  };
}

function hexToRgba(hex: string, alpha: number) {
  if (hex.startsWith("rgba")) return hex;
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(6,182,212,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
