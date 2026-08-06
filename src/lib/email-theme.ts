export type EmailTemplateStyle = "modern" | "minimal" | "classic" | "bold";

export type EmailThemeColors = {
  background: string;
  card: string;
  primary: string;
  secondary: string;
  text: string;
  heading: string;
  accent: string;
  border: string;
};

export type EmailBranding = {
  brandName?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  style?: EmailTemplateStyle;
  colors?: Partial<EmailThemeColors>;
};

export const EMAIL_STYLE_OPTIONS: {
  id: EmailTemplateStyle;
  name: string;
  description: string;
}[] = [
  { id: "modern", name: "Modern Dark", description: "Solid dark layout with brand accents" },
  { id: "minimal", name: "Minimal Light", description: "Clean white layout, subtle borders" },
  { id: "classic", name: "Classic", description: "Traditional bordered letter style" },
  { id: "bold", name: "Bold Hero", description: "Large header image with strong CTA" },
];

export const DEFAULT_EMAIL_COLORS: Record<EmailTemplateStyle, EmailThemeColors> = {
  modern: {
    background: "#080810",
    card: "#0F172A",
    primary: "#06b6d4",
    secondary: "#14b8a6",
    text: "#94a3b8",
    heading: "#e2e8f0",
    accent: "#38bdf8",
    border: "rgba(6,182,212,0.15)",
  },
  minimal: {
    background: "#f1f5f9",
    card: "#ffffff",
    primary: "#06b6d4",
    secondary: "#14b8a6",
    text: "#475569",
    heading: "#0f172a",
    accent: "#0284c7",
    border: "#e2e8f0",
  },
  classic: {
    background: "#fafafa",
    card: "#ffffff",
    primary: "#1e40af",
    secondary: "#1d4ed8",
    text: "#374151",
    heading: "#111827",
    accent: "#2563eb",
    border: "#d1d5db",
  },
  bold: {
    background: "#080810",
    card: "#0F172A",
    primary: "#06b6d4",
    secondary: "#14b8a6",
    text: "#94a3b8",
    heading: "#e2e8f0",
    accent: "#38bdf8",
    border: "rgba(6,182,212,0.15)",
  },
};

export const COLOR_FIELDS: { key: keyof EmailThemeColors; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "card", label: "Card" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "heading", label: "Heading" },
  { key: "text", label: "Body text" },
  { key: "accent", label: "Accent / links" },
  { key: "border", label: "Border" },
];

export function resolveEmailColors(
  style: EmailTemplateStyle,
  overrides?: Partial<EmailThemeColors>,
): EmailThemeColors {
  return { ...DEFAULT_EMAIL_COLORS[style], ...overrides };
}

export const SAMPLE_TEMPLATE_VARS: Record<string, string> = {
  "{{email}}": "user@example.com",
  "{{clientEmail}}": "client@example.com",
  "{{planName}}": "Solo",
  "{{planId}}": "solo",
  "{{activationDate}}": "August 6, 2026",
  "{{expiryDate}}": "September 6, 2026",
  "{{appUrl}}": "https://flowdoverz.app",
  "{{receiptNumber}}": "RCP-20260806-A1B2",
  "{{refundReceiptNumber}}": "RFD-20260806-B2C3",
  "{{refundDate}}": "August 6, 2026, 05:15 PM",
  "{{amountPkr}}": "PKR 999",
  "{{transactionId}}": "TID-03001234567",
  "{{paymentDate}}": "August 6, 2026, 04:30 PM",
  "{{userName}}": "Adeel Shamshad",
  "{{accountNumber}}": "03001234567",
  "{{receiptBarcode}}": "",
};
