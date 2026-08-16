export const MAINTENANCE_EVENT = "flowdoverz-maintenance";

export type MaintenanceNotice = {
  active: boolean;
  message: string;
  until: string;
};

export function notifyMaintenance(notice: MaintenanceNotice) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: notice }));
}

export function applyMaintenanceFromPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const rec = data as Record<string, unknown>;
  if (rec.code !== "MAINTENANCE") return false;
  notifyMaintenance({
    active: true,
    message: String(rec.error || rec.message || ""),
    until: String(rec.until || ""),
  });
  return true;
}
