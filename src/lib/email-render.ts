import {
  applyTemplatePlaceholders,
  type EmailTemplateDef,
} from "./email-templates-defaults";
import type { EmailBranding, EmailTemplateStyle, EmailThemeColors } from "./email-theme";
import { DEFAULT_EMAIL_COLORS, resolveEmailColors } from "./email-theme";
import {
  buildReceiptHtmlForTemplate,
  receiptTextFromTemplateFields,
} from "./receipt-html";

export type BadgeTone = "info" | "success" | "warning" | "error";

export type RenderEmailInput = {
  title: string;
  content: string;
  preheader?: string;
  badge?: { label: string; tone: BadgeTone };
  ctaHref?: string;
  ctaLabel?: string;
  showCta?: boolean;
  bareContent?: boolean;
  supportEmail?: string;
  appUrl?: string;
  brandName?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  footerText?: string;
  style?: EmailTemplateStyle;
  colors?: Partial<EmailThemeColors>;
};

function statusBadge(label: string, tone: BadgeTone, colors: EmailThemeColors, style: EmailTemplateStyle) {
  const tones: Record<BadgeTone, { bg: string; border: string; color: string }> = {
    info: { bg: `${colors.primary}18`, border: `${colors.primary}40`, color: colors.accent },
    success: { bg: `${colors.secondary}18`, border: `${colors.secondary}40`, color: colors.secondary },
    warning: { bg: "#fbbf2418", border: "#fbbf2440", color: "#fcd34d" },
    error: { bg: "#f8717118", border: "#f8717140", color: "#fca5a5" },
  };
  const s = tones[tone];
  const radius = style === "classic" ? "4px" : "999px";
  return `<span style="display:inline-block;padding:6px 14px;border-radius:${radius};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;background:${s.bg};border:1px solid ${s.border};color:${s.color};">${label}</span>`;
}

function ctaButton(href: string, label: string, colors: EmailThemeColors, style: EmailTemplateStyle) {
  if (style === "classic") {
    return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
      <tr>
        <td style="border-radius:6px;background:${colors.primary};">
          <a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
  }
  if (style === "minimal") {
    return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
      <tr>
        <td style="border-radius:10px;background:${colors.primary};">
          <a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
  }
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
    <tr>
      <td style="border-radius:10px;background:linear-gradient(90deg,${colors.primary},${colors.secondary});">
        <a href="${href}" style="display:inline-block;padding:14px 28px;color:#020617;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.01em;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function defaultLogo(brandName: string, colors: EmailThemeColors) {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
    <tr>
      <td style="vertical-align:middle;padding-right:12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,${colors.primary},${colors.secondary});">
          <tr>
            <td align="center" valign="middle" style="width:44px;height:44px;border-radius:12px;background:#000000;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,#ffffff,${colors.accent});"></span>
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle;">
        <span style="font-size:22px;font-weight:800;color:${colors.heading};letter-spacing:-0.03em;">${brandName}</span>
      </td>
    </tr>
  </table>`;
}

function logoBlock(logoUrl: string | undefined, brandName: string, colors: EmailThemeColors) {
  if (logoUrl) {
    return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
      <tr>
        <td align="center">
          <img src="${logoUrl}" alt="${brandName}" width="160" style="display:block;max-width:160px;height:auto;border:0;" />
        </td>
      </tr>
    </table>`;
  }
  return defaultLogo(brandName, colors);
}

function headerHero(headerImageUrl: string | undefined, style: EmailTemplateStyle) {
  if (!headerImageUrl || style !== "bold") return "";
  return `
  <tr>
    <td style="padding:0;line-height:0;font-size:0;">
      <img src="${headerImageUrl}" alt="" width="580" style="display:block;width:100%;max-width:580px;height:auto;border:0;" />
    </td>
  </tr>`;
}

function cardShell(
  style: EmailTemplateStyle,
  colors: EmailThemeColors,
  inner: string,
  headerImageUrl?: string,
) {
  const cardRadius = style === "classic" ? "8px" : style === "minimal" ? "16px" : "24px";
  const topBar =
    style === "modern" || style === "bold"
      ? `<tr><td style="height:3px;background:linear-gradient(90deg,${colors.primary},${colors.secondary},${colors.primary});font-size:0;line-height:0;">&nbsp;</td></tr>`
      : style === "classic"
        ? `<tr><td style="height:4px;background:${colors.primary};font-size:0;line-height:0;">&nbsp;</td></tr>`
        : "";

  return `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;">
    ${headerHero(headerImageUrl, style)}
    <tr>
      <td style="background:${colors.card};border:1px solid ${colors.border};border-radius:${cardRadius};overflow:hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${topBar}
          ${inner}
        </table>
      </td>
    </tr>
  </table>`;
}

export function renderEmailHtml(input: RenderEmailInput): string {
  const {
    title,
    content,
    preheader = "",
    badge,
    ctaHref = "https://flowdoverz.app/dashboard",
    ctaLabel = "Open dashboard",
    showCta = true,
    bareContent = false,
    supportEmail = "support@flowdoverz.app",
    appUrl = "https://flowdoverz.app",
    brandName = "FlowDoverz",
    logoUrl,
    headerImageUrl,
    footerText = "The FlowDoverz Team",
    style = "modern",
    colors: colorOverrides,
  } = input;

  const colors = resolveEmailColors(style, colorOverrides);
  const fontFamily =
    style === "classic"
      ? "Georgia,'Times New Roman',serif"
      : "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const badgeHtml = badge ? `<div style="margin-bottom:16px;">${statusBadge(badge.label, badge.tone, colors, style)}</div>` : "";
  const ctaHtml = showCta && ctaLabel ? ctaButton(ctaHref, ctaLabel, colors, style) : "";
  const titleHtml = title
    ? `<h1 style="margin:0;font-size:${style === "bold" ? "28px" : "26px"};line-height:1.25;font-weight:800;color:${colors.heading};letter-spacing:-0.03em;font-family:${fontFamily};">${title}</h1>`
    : "";

  const bodyBg = `background-color:${colors.background};`;

  const footerBg =
    style === "modern" || style === "bold"
      ? `background:${colors.background};`
      : style === "minimal"
        ? "background:#f8fafc;"
        : "background:#f9fafb;";

  const headerRow =
    title || badge
      ? `<tr>
      <td style="padding:36px 32px 8px 32px;">
        ${badgeHtml}
        ${titleHtml}
      </td>
    </tr>`
      : "";

  const inner = `
    ${headerRow}
    <tr>
      <td style="padding:${title || badge ? "8px 32px 32px 32px" : "24px 32px 32px 32px"};color:${colors.text};font-size:16px;line-height:1.75;font-family:${fontFamily};">
        ${content}
        ${ctaHtml}
        <p style="margin:12px 0 0 0;font-size:13px;color:${colors.text};opacity:0.75;">
          Or visit <a href="${appUrl}" style="color:${colors.accent};text-decoration:none;font-weight:600;">${appUrl.replace(/^https?:\/\//, "")}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 32px 28px 32px;border-top:1px solid ${colors.border};${footerBg}">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:top;">
              <p style="margin:0 0 6px 0;font-size:14px;color:${colors.heading};font-weight:700;font-family:${fontFamily};">${footerText}</p>
              <p style="margin:0;font-size:13px;color:${colors.text};line-height:1.6;font-family:${fontFamily};">
                Need help? <a href="mailto:${supportEmail}" style="color:${colors.accent};text-decoration:none;">${supportEmail}</a>
              </p>
            </td>
            <td align="right" style="vertical-align:top;">
              <a href="${appUrl}/dashboard" style="font-size:13px;color:${colors.text};text-decoration:none;">Dashboard</a>
              <span style="color:${colors.border};margin:0 8px;">|</span>
              <a href="${appUrl}/pricing" style="font-size:13px;color:${colors.text};text-decoration:none;">Pricing</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const showTopLogo = style !== "bold" || !headerImageUrl;

  if (bareContent) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || brandName}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#080810;font-family:${fontFamily};-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:0;">
        ${content}
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;overflow:hidden;${bodyBg}font-family:${fontFamily};-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${bodyBg}">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;">
          ${showTopLogo ? `<tr><td align="center" style="padding-bottom:28px;">${logoBlock(logoUrl, brandName, colors)}</td></tr>` : ""}
          <tr>
            <td>
              ${cardShell(style, colors, inner, headerImageUrl)}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 8px 0 8px;">
              <p style="margin:0;font-size:12px;color:${colors.text};opacity:0.6;line-height:1.6;font-family:${fontFamily};">
                You received this email because of activity on your ${brandName} account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderTemplateEmail(
  template: EmailTemplateDef & EmailBranding,
  vars: Record<string, string>,
  options: {
    supportEmail?: string;
    appUrl?: string;
    brandName?: string;
    defaultStyle?: EmailTemplateStyle;
    defaultLogoUrl?: string;
    defaultColors?: Partial<EmailThemeColors>;
  } = {},
) {
  const appUrl = options.appUrl || vars["{{appUrl}}"] || "https://flowdoverz.app";
  const subject = applyTemplatePlaceholders(template.subject, vars);
  const text = applyTemplatePlaceholders(template.textBody, vars);
  const style = template.style || options.defaultStyle || "modern";
  const receiptLayout =
    template.id === "payment_receipt" || template.id === "payment_refund_receipt";
  const colors = resolveEmailColors(style, { ...options.defaultColors, ...template.colors });
  const receiptVariant = template.id === "payment_refund_receipt" ? "refund" : "payment";

  const htmlContent = receiptLayout
    ? applyTemplatePlaceholders(
        buildReceiptHtmlForTemplate(
          colors,
          style,
          receiptTextFromTemplateFields(template),
          receiptVariant,
        ),
        vars,
      )
    : applyTemplatePlaceholders(template.htmlBody, vars);

  const ctaHref = applyTemplatePlaceholders(template.ctaHref || `${appUrl}/dashboard`, vars);

  const html = renderEmailHtml({
    title: receiptLayout
      ? ""
      : applyTemplatePlaceholders(
          template.heading || subject.replace(/^FlowDoverz - /, ""),
          vars,
        ),
    content: htmlContent,
    preheader: template.preheader ? applyTemplatePlaceholders(template.preheader, vars) : "",
    badge: receiptLayout
      ? undefined
      : template.badge
        ? {
            label: applyTemplatePlaceholders(template.badge, vars),
            tone: template.badgeTone || "info",
          }
        : undefined,
    ctaHref,
    ctaLabel: template.ctaLabel ? applyTemplatePlaceholders(template.ctaLabel, vars) : "Open dashboard",
    showCta: !receiptLayout,
    bareContent: receiptLayout,
    supportEmail: options.supportEmail,
    appUrl,
    brandName: options.brandName || "FlowDoverz",
    logoUrl: template.logoUrl || options.defaultLogoUrl,
    headerImageUrl: template.headerImageUrl,
    footerText: template.footerText,
    style,
    colors,
  });

  return { subject, text, html };
}
