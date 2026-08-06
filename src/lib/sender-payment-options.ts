export type SenderPaymentOption = {
  id: string;
  label: string;
};

export type SenderPaymentOptionGroup = {
  id: string;
  label: string;
  options: SenderPaymentOption[];
};

export const SENDER_PAYMENT_OPTION_GROUPS: SenderPaymentOptionGroup[] = [
  {
    id: "cash-apps",
    label: "Cash apps & mobile wallets",
    options: [
      { id: "jazzcash", label: "JazzCash" },
      { id: "easypaisa", label: "EasyPaisa" },
      { id: "nayapay", label: "NayaPay" },
      { id: "sadapay", label: "SadaPay" },
      { id: "finja", label: "Finja" },
      { id: "upaisa", label: "UPaisa" },
      { id: "paymax", label: "PayMax" },
    ],
  },
  {
    id: "banks",
    label: "Pakistani banks",
    options: [
      { id: "meezan", label: "Meezan Bank" },
      { id: "hbl", label: "HBL (Habib Bank)" },
      { id: "ubl", label: "UBL (United Bank)" },
      { id: "mcb", label: "MCB Bank" },
      { id: "abl", label: "Allied Bank" },
      { id: "alfalah", label: "Bank Alfalah" },
      { id: "faysal", label: "Faysal Bank" },
      { id: "bank-al-habib", label: "Bank Al Habib" },
      { id: "askari", label: "Askari Bank" },
      { id: "js-bank", label: "JS Bank" },
      { id: "soneri", label: "Soneri Bank" },
      { id: "silk-bank", label: "Silk Bank" },
      { id: "summit", label: "Summit Bank" },
      { id: "bop", label: "Bank of Punjab (BOP)" },
      { id: "bok", label: "Bank of Khyber (BOK)" },
      { id: "nbp", label: "National Bank (NBP)" },
      { id: "dubai-islamic", label: "Dubai Islamic Bank" },
      { id: "habib-metro", label: "Habib Metropolitan Bank" },
      { id: "standard-chartered", label: "Standard Chartered" },
      { id: "samba", label: "Samba Bank" },
      { id: "icbc", label: "ICBC Pakistan" },
    ],
  },
];

export const SENDER_PAYMENT_OPTIONS = SENDER_PAYMENT_OPTION_GROUPS.flatMap((group) => group.options);

export function senderPaymentLabel(id: string | undefined | null) {
  if (!id) return "—";
  return SENDER_PAYMENT_OPTIONS.find((option) => option.id === id)?.label ?? id;
}
