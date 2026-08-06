"use client";

import { CreditCard, Eye, ImageIcon, KeyRound, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  AdminMobileActionButton,
  AdminMobileActionGrid,
  AdminMobileActionRow,
  AdminMobileActionStack,
  AdminMobileActivityBadge,
  AdminMobileCardBody,
  AdminMobileCardFooter,
  AdminMobileCardHeader,
  AdminMobileCardShell,
  AdminMobileFooterButton,
  AdminMobileMetaGrid,
  AdminMobileMetaTile,
  AdminMobilePlanBadge,
} from "@/components/admin-mobile-card";
import { PayToMethodBadge } from "@/components/pay-to-method-badge";
import { normalizePlanValue } from "@/components/admin-plan-select";
import { senderPaymentLabel } from "@/lib/sender-payment-options";

type ClientRow = {
  email: string;
  name?: string;
  subscriptionPlan?: string;
  trialExpiresAt?: string;
  subscriptionExpiresAt?: string;
  createdAt?: string;
};

export function ClientMobileCard({
  client,
  onEdit,
  onPassword,
  onPayments,
  onDelete,
}: {
  client: ClientRow;
  onEdit: () => void;
  onPassword: () => void;
  onPayments: () => void;
  onDelete: () => void;
}) {
  const plan = normalizePlanValue(client.subscriptionPlan);
  const profileHref = `/admin/clients/${encodeURIComponent(client.email)}`;

  return (
    <AdminMobileCardShell>
      <AdminMobileCardBody href={profileHref}>
        <AdminMobileCardHeader
          title={<span className="text-cyan-400">{client.name || "N/A"}</span>}
          subtitle={client.email}
          badge={<AdminMobilePlanBadge plan={plan} />}
        />
        <AdminMobileMetaGrid cols={3}>
          <AdminMobileMetaTile
            label="Joined"
            value={client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "—"}
          />
          <AdminMobileMetaTile
            label="Trial"
            value={client.trialExpiresAt ? new Date(client.trialExpiresAt).toLocaleDateString() : "—"}
            valueClassName="text-rose-300"
          />
          <AdminMobileMetaTile
            label="Plan"
            value={
              client.subscriptionExpiresAt
                ? new Date(client.subscriptionExpiresAt).toLocaleDateString()
                : "—"
            }
            valueClassName="text-rose-300"
          />
        </AdminMobileMetaGrid>
      </AdminMobileCardBody>
      <AdminMobileCardFooter>
        <AdminMobileActionGrid>
          <AdminMobileActionButton label="Edit client" shortLabel="Edit" icon={Pencil} onClick={onEdit} bgClass="bg-cyan-500/10" colorClass="text-cyan-400" />
          <AdminMobileActionButton label="Change password" shortLabel="Password" icon={KeyRound} onClick={onPassword} bgClass="bg-violet-500/10" colorClass="text-violet-400" />
          <AdminMobileActionButton label="View payments" shortLabel="Payments" icon={CreditCard} onClick={onPayments} bgClass="bg-emerald-500/10" colorClass="text-emerald-400" />
          <AdminMobileActionButton label="Delete client" shortLabel="Delete" icon={Trash2} onClick={onDelete} bgClass="bg-rose-500/10" colorClass="text-rose-400" />
        </AdminMobileActionGrid>
      </AdminMobileCardFooter>
    </AdminMobileCardShell>
  );
}

type PaymentRow = {
  id: string;
  userEmail: string;
  userName?: string | null;
  planId: string;
  transactionId: string;
  senderPaymentSource?: string;
  senderPaymentSourceLabel?: string;
  payToMethodId?: string;
  payToMethodLabel?: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  createdAt: string;
  processedAt?: string;
  screenshot?: string;
  hasScreenshot?: boolean;
};

export function PaymentMobileCard({
  payment,
  statusBadge,
  planBadge,
  onApprove,
  onReject,
  onRefund,
  onScreenshot,
}: {
  payment: PaymentRow;
  statusBadge: ReactNode;
  planBadge: ReactNode;
  onApprove: () => void;
  onReject: () => void;
  onRefund: () => void;
  onScreenshot: () => void;
}) {
  const hasScreenshot = Boolean(payment.screenshot || payment.hasScreenshot);
  const processedLabel = payment.processedAt
    ? new Date(payment.processedAt).toLocaleDateString()
    : "—";

  const footer =
    payment.status === "pending" ? (
      <AdminMobileActionStack>
        <AdminMobileActionRow>
          <AdminMobileFooterButton onClick={onApprove} variant="success">
            Approve
          </AdminMobileFooterButton>
          <AdminMobileFooterButton onClick={onReject} variant="danger">
            Reject
          </AdminMobileFooterButton>
        </AdminMobileActionRow>
        {hasScreenshot ? (
          <AdminMobileFooterButton onClick={onScreenshot} variant="cyan">
            <ImageIcon size={14} /> View Screenshot
          </AdminMobileFooterButton>
        ) : null}
      </AdminMobileActionStack>
    ) : payment.status === "approved" ? (
      hasScreenshot ? (
        <AdminMobileActionRow>
          <AdminMobileFooterButton onClick={onRefund} variant="muted">
            Refund
          </AdminMobileFooterButton>
          <AdminMobileFooterButton onClick={onScreenshot} variant="cyan">
            <ImageIcon size={14} /> Screenshot
          </AdminMobileFooterButton>
        </AdminMobileActionRow>
      ) : (
        <AdminMobileFooterButton onClick={onRefund} variant="muted">
          Refund
        </AdminMobileFooterButton>
      )
    ) : hasScreenshot ? (
      <AdminMobileFooterButton onClick={onScreenshot} variant="cyan">
        <ImageIcon size={14} /> View Screenshot
      </AdminMobileFooterButton>
    ) : null;

  return (
    <AdminMobileCardShell>
      <AdminMobileCardBody>
        <AdminMobileCardHeader
          title={payment.userName || "N/A"}
          subtitle={payment.userEmail}
          badge={statusBadge}
        />
        <AdminMobileMetaGrid cols={3}>
          <AdminMobileMetaTile label="Plan" value={planBadge} />
          <AdminMobileMetaTile
            label="Submitted"
            value={new Date(payment.createdAt).toLocaleDateString()}
          />
          <AdminMobileMetaTile
            label="Sent from"
            value={payment.senderPaymentSourceLabel || senderPaymentLabel(payment.senderPaymentSource)}
          />
        </AdminMobileMetaGrid>
        <AdminMobileMetaGrid cols={2}>
          <AdminMobileMetaTile
            label="Paid to"
            value={
              <PayToMethodBadge methodId={payment.payToMethodId} label={payment.payToMethodLabel} />
            }
          />
          <AdminMobileMetaTile
            label="Account"
            value={<span className="break-all font-mono text-[11px]">{payment.transactionId}</span>}
          />
          {payment.status !== "pending" ? (
            <AdminMobileMetaTile label="Processed" value={processedLabel} />
          ) : null}
        </AdminMobileMetaGrid>
      </AdminMobileCardBody>
      {footer ? <AdminMobileCardFooter>{footer}</AdminMobileCardFooter> : null}
    </AdminMobileCardShell>
  );
}

type EmailRow = {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: "sent" | "failed";
  error?: string;
  createdAt: string;
};

export function EmailMobileCard({
  item,
  statusBadge,
  formatType,
}: {
  item: EmailRow;
  statusBadge: ReactNode;
  formatType: (type: string) => string;
}) {
  return (
    <AdminMobileCardShell>
      <AdminMobileCardBody>
        <AdminMobileCardHeader
          title={<span className="line-clamp-2 whitespace-normal text-slate-100">{item.subject}</span>}
          subtitle={item.to}
          badge={statusBadge}
        />
        <AdminMobileMetaGrid cols={2}>
          <AdminMobileMetaTile label="Type" value={formatType(item.type)} valueClassName="text-cyan-300 uppercase" />
          <AdminMobileMetaTile
            label="Sent"
            value={item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
          />
        </AdminMobileMetaGrid>
        {item.error ? (
          <p className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-300">
            {item.error}
          </p>
        ) : null}
      </AdminMobileCardBody>
    </AdminMobileCardShell>
  );
}

type ActivityRow = {
  id: string;
  action: string;
  detail?: string;
  targetEmail?: string;
  createdAt: string;
};

export function ActivityMobileCard({ item }: { item: ActivityRow }) {
  return (
    <AdminMobileCardShell>
      <AdminMobileCardBody>
        <AdminMobileCardHeader
          title={<AdminMobileActivityBadge action={item.action} />}
          subtitle={item.detail || "No detail recorded"}
        />
        <AdminMobileMetaGrid cols={2}>
          <AdminMobileMetaTile
            label="Target"
            value={item.targetEmail || "—"}
            valueClassName="break-all font-mono text-cyan-300 text-[11px]"
          />
          <AdminMobileMetaTile
            label="When"
            value={item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
          />
        </AdminMobileMetaGrid>
      </AdminMobileCardBody>
    </AdminMobileCardShell>
  );
}

type ReceiptRow = {
  paymentId: string;
  userName: string;
  email: string;
  planId: string;
  amountLabel: string;
  paymentDateLabel: string;
  receiptNumber: string;
  status: "approved" | "refunded";
};

export function ReceiptMobileCard({
  purchase,
  statusBadge,
  planBadge,
  amountLabel,
  onView,
}: {
  purchase: ReceiptRow;
  statusBadge: ReactNode;
  planBadge: ReactNode;
  amountLabel: ReactNode;
  onView: () => void;
}) {
  return (
    <AdminMobileCardShell>
      <AdminMobileCardBody>
        <AdminMobileCardHeader
          title={purchase.userName || "N/A"}
          subtitle={purchase.email}
          badge={statusBadge}
        />
        <AdminMobileMetaGrid cols={2}>
          <AdminMobileMetaTile label="Plan" value={planBadge} />
          <AdminMobileMetaTile label="Amount" value={amountLabel} valueClassName="text-cyan-300" />
          <AdminMobileMetaTile label="Paid" value={purchase.paymentDateLabel} />
          <AdminMobileMetaTile
            label="Receipt #"
            value={<span className="font-mono text-[11px]">{purchase.receiptNumber}</span>}
          />
        </AdminMobileMetaGrid>
      </AdminMobileCardBody>
      <AdminMobileCardFooter>
        <AdminMobileFooterButton onClick={onView} variant="cyan">
          <Eye size={14} /> View Receipt
        </AdminMobileFooterButton>
      </AdminMobileCardFooter>
    </AdminMobileCardShell>
  );
}

type SyncRow = {
  email: string;
  name?: string;
  syncStatus: string;
  lastSyncAt?: string | null;
  lastSyncSlot?: string | null;
  assignedSlot?: string;
  extensionVersion?: string | null;
  subscriptionPlan?: string;
};

export function SyncMobileCard({
  client,
  statusBadge,
}: {
  client: SyncRow;
  statusBadge: ReactNode;
}) {
  const profileHref = `/admin/clients/${encodeURIComponent(client.email)}`;

  return (
    <AdminMobileCardShell>
      <AdminMobileCardBody href={profileHref}>
        <AdminMobileCardHeader
          title={<span className="text-cyan-400">{client.name || client.email}</span>}
          subtitle={client.name ? client.email : undefined}
          badge={statusBadge}
        />
        <AdminMobileMetaGrid cols={2}>
          <AdminMobileMetaTile
            label="Last sync"
            value={client.lastSyncAt ? new Date(client.lastSyncAt).toLocaleString() : "Never"}
          />
          <AdminMobileMetaTile
            label="Plan"
            value={client.subscriptionPlan || "—"}
            valueClassName="capitalize"
          />
          <AdminMobileMetaTile
            label="Slot"
            value={client.lastSyncSlot || client.assignedSlot || "—"}
            valueClassName="font-mono text-[11px]"
          />
          <AdminMobileMetaTile label="Extension" value={client.extensionVersion || "—"} />
        </AdminMobileMetaGrid>
      </AdminMobileCardBody>
    </AdminMobileCardShell>
  );
}
