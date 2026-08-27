export function getPublicSupportEmail() {
  return (
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    process.env.SUPPORT_EMAIL?.trim() ||
    "support@flowdoverz.app"
  );
}

export function getPublicWhatsAppDigits() {
  const raw =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() ||
    process.env.WHATSAPP_NUMBER?.trim() ||
    "";
  return raw.replace(/\D/g, "");
}

export function getPublicWhatsAppUrl(message?: string) {
  const digits = getPublicWhatsAppDigits();
  if (!digits) return "";
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function getResellerContactWhatsAppMessage() {
  return "Hi FlowDoverz, I want to become a reseller and buy client seats.";
}
