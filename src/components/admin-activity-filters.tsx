"use client";

import { AdminFilterPills } from "@/components/admin-filter-pills";

export const ACTIVITY_GROUPS = [
  "all",
  "clients",
  "payments",
  "cookies",
  "resellers",
  "admin",
] as const;

export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

const GROUP_LABELS: Record<ActivityGroup, string> = {
  all: "All",
  clients: "Clients",
  payments: "Payments",
  cookies: "Cookies",
  resellers: "Resellers",
  admin: "Admin",
};

export const GROUP_ACTIONS: Record<ActivityGroup, readonly string[]> = {
  all: [],
  clients: [
    "client_created",
    "client_updated",
    "client_deleted",
    "client_suspended",
    "client_unsuspended",
  ],
  payments: ["payment_approved", "payment_rejected", "payment_refunded"],
  cookies: ["cookies_saved", "cookies_cleared"],
  resellers: [
    "reseller_created",
    "reseller_updated",
    "reseller_deleted",
    "reseller_key_rotated",
    "reseller_seats_added",
    "reseller_trial_seats_added",
    "reseller_user_created",
    "reseller_extension_generated",
  ],
  admin: ["admin_login", "admin_logout", "password_changed", "maintenance_updated"],
};

export function formatActivityAction(action: string) {
  return action.replace(/_/g, " ");
}

export function formatActivityActionShort(action: string) {
  const short: Record<string, string> = {
    client_created: "Created",
    client_updated: "Updated",
    client_deleted: "Deleted",
    client_suspended: "Suspended",
    client_unsuspended: "Unsuspended",
    payment_approved: "Approved",
    payment_rejected: "Rejected",
    payment_refunded: "Refunded",
    cookies_saved: "Saved",
    cookies_cleared: "Cleared",
    reseller_created: "Created",
    reseller_updated: "Updated",
    reseller_deleted: "Deleted",
    reseller_key_rotated: "Key rotated",
    reseller_seats_added: "Seats added",
    reseller_trial_seats_added: "Trial seats added",
    reseller_user_created: "User created",
    reseller_extension_generated: "Extension built",
    admin_login: "Login",
    admin_logout: "Logout",
    password_changed: "Password",
    maintenance_updated: "Maintenance",
  };
  return short[action] || formatActivityAction(action);
}

type Props = {
  group: ActivityGroup;
  action: string;
  onGroupChange: (group: ActivityGroup) => void;
  onActionChange: (action: string) => void;
};

export function AdminActivityFilters({
  group,
  action,
  onGroupChange,
  onActionChange,
}: Props) {
  const subActions = GROUP_ACTIONS[group];

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:items-end">
      <AdminFilterPills
        options={ACTIVITY_GROUPS}
        value={group}
        onChange={(next) => {
          onGroupChange(next);
          onActionChange("all");
        }}
        formatLabel={(value) => GROUP_LABELS[value]}
        className="ml-auto w-fit max-w-full sm:w-fit"
      />

      {group !== "all" && subActions.length > 0 && (
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Action
          </span>
          <button
            type="button"
            onClick={() => onActionChange("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              action === "all"
                ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            All in group
          </button>
          {subActions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onActionChange(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                action === value
                  ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {formatActivityActionShort(value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function matchesActivityFilter(
  itemAction: string,
  group: ActivityGroup,
  action: string,
) {
  if (group === "all") return true;

  const groupActions = GROUP_ACTIONS[group];
  if (action === "all") return groupActions.includes(itemAction);
  return itemAction === action;
}
