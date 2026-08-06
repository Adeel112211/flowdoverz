export type CheckoutPaymentMethod = {
  id: string;
  name: string;
  logoUrl: string;
  accountName: string;
  accountNumber: string;
  hint?: string;
  /** Replace with real wallet QR image URL when ready. */
  qrImageUrl?: string;
  /** Show generated placeholder QR from account number when qrImageUrl is empty. */
  useTempQr?: boolean;
  theme: {
    iconBg: string;
    iconText: string;
    border: string;
    glow: string;
    badge: string;
    qrRing: string;
    selectRing: string;
    selectDot: string;
  };
};

/** Update these with your real receiving accounts. */
export const CHECKOUT_PAYMENT_METHODS: CheckoutPaymentMethod[] = [
  {
    id: "jazzcash",
    name: "JazzCash",
    logoUrl: "/payment-logos/jazzcash.png",
    accountName: "[Your Name]",
    accountNumber: "0300-0000000",
    useTempQr: true,
    theme: {
      iconBg: "bg-red-500/15",
      iconText: "text-red-400",
      border: "border-red-500/25",
      glow: "from-red-500/10 to-transparent",
      badge: "bg-red-500/10 text-red-300",
      qrRing: "ring-red-500/20",
      selectRing: "border-red-400",
      selectDot: "bg-red-400",
    },
  },
  {
    id: "easypaisa",
    name: "EasyPaisa",
    logoUrl: "/payment-logos/easypaisa.png",
    accountName: "[Your Name]",
    accountNumber: "0300-0000000",
    useTempQr: true,
    theme: {
      iconBg: "bg-emerald-500/15",
      iconText: "text-emerald-400",
      border: "border-emerald-500/25",
      glow: "from-emerald-500/10 to-transparent",
      badge: "bg-emerald-500/10 text-emerald-300",
      qrRing: "ring-emerald-500/20",
      selectRing: "border-emerald-400",
      selectDot: "bg-emerald-400",
    },
  },
  {
    id: "nayapay",
    name: "NayaPay",
    logoUrl: "/payment-logos/nayapay.png",
    accountName: "[Your Name]",
    accountNumber: "0300-0000000",
    useTempQr: true,
    theme: {
      iconBg: "bg-orange-500/15",
      iconText: "text-orange-400",
      border: "border-orange-500/25",
      glow: "from-orange-500/10 to-transparent",
      badge: "bg-orange-500/10 text-orange-300",
      qrRing: "ring-orange-500/20",
      selectRing: "border-orange-400",
      selectDot: "bg-orange-400",
    },
  },
];

export function checkoutQrSrc(method: CheckoutPaymentMethod) {
  if (method.qrImageUrl) return method.qrImageUrl;
  if (!method.useTempQr) return null;
  const text = method.accountNumber.replace(/-/g, "");
  return `/api/checkout/qr?text=${encodeURIComponent(text)}`;
}

export function getCheckoutPaymentMethod(id: string | undefined | null) {
  if (!id) return null;
  return CHECKOUT_PAYMENT_METHODS.find((method) => method.id === id) ?? null;
}

export function payToMethodDisplayLabel(
  id: string | undefined | null,
  storedLabel?: string | null,
) {
  if (storedLabel) return storedLabel;
  return getCheckoutPaymentMethod(id)?.name ?? null;
}
