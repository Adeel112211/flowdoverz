/** Update with your WhatsApp number (country code, no + or spaces). */
export const WHATSAPP_NUMBER = "923136731535";

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export const WHATSAPP_CHECKOUT_MESSAGE =
  "Hi, I would like to buy a FlowBridge account through WhatsApp. Please help me get started.";

export function whatsAppLink(message?: string) {
  const text = encodeURIComponent(message ?? WHATSAPP_CHECKOUT_MESSAGE);
  return `${WHATSAPP_URL}?text=${text}`;
}
