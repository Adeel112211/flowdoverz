import {
  formatPkr,
  formatReceiptDate,
  planDisplayName,
  resolvePaymentAmountPkr,
} from "@/lib/receipt-utils";
import type { PricingPlan } from "@/lib/pricing-config";
import type { Firestore } from "firebase-admin/firestore";

export type ReceiptAccountSummary = {
  userName: string;
  email: string;
  planName: string;
  activationDate: string | null;
  activationDateLabel: string;
  expiryDate: string | null;
  expiryDateLabel: string;
  subscriptionActive: boolean;
};

export type ClientReceiptRecord = {
  id: string;
  paymentId?: string;
  receiptNumber: string;
  planId: string;
  planName: string;
  userName: string;
  accountNumber: string;
  amountPkr: number;
  amountLabel: string;
  transactionId: string;
  paymentDate: string;
  paymentDateLabel: string;
  expiryDateLabel?: string;
  refundDateLabel?: string;
  originalReceiptNumber?: string;
  scanUrl: string;
  status: "paid" | "refunded";
  sortDate: string;
};

export type PurchaseRecord = {
  paymentId: string;
  email: string;
  userName: string;
  planId: string;
  planName: string;
  amountPkr: number;
  amountLabel: string;
  receiptNumber: string;
  refundReceiptNumber?: string;
  paymentDate: string;
  paymentDateLabel: string;
  expiryDateLabel: string;
  refundDateLabel?: string;
  accountNumber: string;
  status: "approved" | "refunded";
  sortDate: string;
  paymentReceipt: ClientReceiptRecord;
  refundReceipt?: ClientReceiptRecord;
};

function buildPurchaseFromPayment(
  id: string,
  raw: Record<string, unknown>,
  userName: string,
  email: string,
  scanUrl: string,
  plans: PricingPlan[],
): PurchaseRecord | null {
  const status = String(raw.status || "");
  if (status !== "approved" && status !== "refunded") return null;

  const planId = String(raw.planId || "");
  const processedAt = String(raw.processedAt || raw.createdAt || "");
  const amountPkr = resolvePaymentAmountPkr(planId, raw.amountPkr, plans);
  const receiptNumber = String(raw.receiptNumber || `RCP-${id.slice(0, 8).toUpperCase()}`);
  const expiryAt = String(raw.expiryAt || "");
  const expiryDateLabel = expiryAt
    ? formatReceiptDate(expiryAt)
    : processedAt
      ? formatReceiptDate(new Date(Date.parse(processedAt) + 30 * 24 * 60 * 60 * 1000).toISOString())
      : "—";

  const base = {
    paymentId: id,
    planId,
    planName: planDisplayName(planId),
    userName,
    accountNumber: String(raw.transactionId || "N/A"),
    amountPkr,
    amountLabel: amountPkr > 0 ? formatPkr(amountPkr) : "—",
    transactionId: String(raw.transactionId || "N/A"),
    paymentDate: processedAt,
    paymentDateLabel: processedAt ? formatReceiptDate(processedAt) : "—",
    scanUrl,
  };

  const paymentReceipt: ClientReceiptRecord = {
    ...base,
    id,
    receiptNumber,
    expiryDateLabel,
    status: "paid",
    sortDate: processedAt,
  };

  let refundReceipt: ClientReceiptRecord | undefined;
  let refundReceiptNumber: string | undefined;
  let refundDateLabel: string | undefined;

  if (status === "refunded") {
    const refundedAt = String(raw.refundedAt || "");
    refundReceiptNumber = String(raw.refundReceiptNumber || `RFD-${id.slice(0, 8).toUpperCase()}`);
    refundDateLabel = refundedAt ? formatReceiptDate(refundedAt) : "—";
    refundReceipt = {
      ...base,
      id: `${id}-refund`,
      receiptNumber: refundReceiptNumber,
      originalReceiptNumber: receiptNumber,
      refundDateLabel,
      status: "refunded",
      sortDate: refundedAt || processedAt,
    };
  }

  return {
    paymentId: id,
    email,
    userName,
    planId,
    planName: planDisplayName(planId),
    amountPkr,
    amountLabel: amountPkr > 0 ? formatPkr(amountPkr) : "—",
    receiptNumber,
    refundReceiptNumber,
    paymentDate: processedAt,
    paymentDateLabel: processedAt ? formatReceiptDate(processedAt) : "—",
    expiryDateLabel,
    refundDateLabel,
    accountNumber: String(raw.transactionId || "N/A"),
    status: status === "refunded" ? "refunded" : "approved",
    sortDate: processedAt,
    paymentReceipt,
    refundReceipt,
  };
}

export async function getClientPurchasesPayload(db: Firestore, email: string, scanUrl: string) {
  const normalized = email.trim().toLowerCase();
  const { normalizeFirestoreDoc } = await import("@/lib/firestore-utils");
  const { getUserStatus } = await import("@/lib/user-store");
  const { getPricingConfig } = await import("@/lib/pricing-store");

  const snapshot = await db.collection("manual_payments").where("userEmail", "==", normalized).get();
  const userDoc = await db.collection("users").doc(normalized).get();
  const userData = (userDoc.data() || {}) as Record<string, unknown>;
  const userName = String(userData.name || normalized.split("@")[0] || "Customer");
  const userStatus = await getUserStatus(normalized);
  const pricing = await getPricingConfig();

  const purchases = snapshot.docs
    .map((doc) =>
      buildPurchaseFromPayment(
        doc.id,
        normalizeFirestoreDoc((doc.data() || {}) as Record<string, unknown>),
        userName,
        normalized,
        scanUrl,
        pricing.plans,
      ),
    )
    .filter(Boolean)
    .sort((a, b) => Date.parse(b!.sortDate || "0") - Date.parse(a!.sortDate || "0")) as PurchaseRecord[];

  const latest = purchases[0];
  const latestPlanId = String(latest?.planId || userStatus?.subscriptionPlan || "");
  const planName =
    latestPlanId && latestPlanId !== "none"
      ? planDisplayName(latestPlanId)
      : userStatus?.subscriptionPlan && userStatus.subscriptionPlan !== "none"
        ? planDisplayName(userStatus.subscriptionPlan)
        : "—";

  const activationIso = String(
    latest?.paymentDate || userData.createdAt || "",
  );
  const expiryIso = String(
    userStatus?.subscriptionExpiresAt ||
      (latest?.paymentDate
        ? new Date(Date.parse(latest.paymentDate) + 30 * 24 * 60 * 60 * 1000).toISOString()
        : ""),
  );

  const account: ReceiptAccountSummary = {
    userName,
    email: normalized,
    planName,
    activationDate: activationIso || null,
    activationDateLabel: activationIso ? formatReceiptDate(activationIso) : "—",
    expiryDate: expiryIso || null,
    expiryDateLabel: expiryIso ? formatReceiptDate(expiryIso) : "—",
    subscriptionActive: userStatus?.subscriptionActive ?? false,
  };

  const receipts = purchases.flatMap((p) =>
    p.refundReceipt ? [p.paymentReceipt, p.refundReceipt] : [p.paymentReceipt],
  );

  return { account, purchases, receipts };
}

/** @deprecated Use getClientPurchasesPayload */
export async function getClientReceiptsPayload(db: Firestore, email: string, scanUrl: string) {
  return getClientPurchasesPayload(db, email, scanUrl);
}

export async function listAllPurchases(db: Firestore, scanUrl: string) {
  const { normalizeFirestoreDoc } = await import("@/lib/firestore-utils");
  const { getPricingConfig } = await import("@/lib/pricing-store");
  const pricing = await getPricingConfig();

  const [paymentsSnapshot] = await Promise.all([
    db.collection("manual_payments").limit(200).get(),
  ]);

  const { getUserNamesByEmail } = await import("./admin-users-query");
  const emails = paymentsSnapshot.docs
    .map((doc) => String((doc.data() || {}).userEmail || "").toLowerCase())
    .filter(Boolean);
  const userNames = await getUserNamesByEmail(db, emails);

  return paymentsSnapshot.docs
    .map((doc) => {
      const raw = normalizeFirestoreDoc((doc.data() || {}) as Record<string, unknown>);
      const email = String(raw.userEmail || "").toLowerCase();
      if (!email) return null;
      const userName = userNames.get(email) || email.split("@")[0];
      return buildPurchaseFromPayment(doc.id, raw, userName, email, scanUrl, pricing.plans);
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b!.sortDate || "0") - Date.parse(a!.sortDate || "0")) as PurchaseRecord[];
}
