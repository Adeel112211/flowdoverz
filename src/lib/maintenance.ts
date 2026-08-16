import { connection, NextResponse } from "next/server";
import {
  getSystemSettings,
  saveSystemSettings,
  type SystemSettings,
} from "@/lib/admin-settings";

export type PublicMaintenanceStatus = {
  active: boolean;
  message: string;
  until: string;
};

export type MaintenanceSettings = {
  enabled: boolean;
  message: string;
  until: string;
};

const DEFAULT_MESSAGE =
  "The site is under maintenance. Please check back shortly.";

export function isMaintenanceWindowActive(settings: Pick<
  SystemSettings,
  "maintenanceEnabled" | "maintenanceUntil"
>): boolean {
  if (!settings.maintenanceEnabled) return false;
  const until = String(settings.maintenanceUntil || "").trim();
  if (!until) return true;
  const untilMs = Date.parse(until);
  if (Number.isNaN(untilMs)) return true;
  return Date.now() < untilMs;
}

export function toMaintenanceSettings(settings: SystemSettings): MaintenanceSettings {
  return {
    enabled: Boolean(settings.maintenanceEnabled),
    message: String(settings.maintenanceMessage || ""),
    until: String(settings.maintenanceUntil || ""),
  };
}

export function toPublicMaintenanceStatus(
  settings: SystemSettings,
): PublicMaintenanceStatus {
  const active = isMaintenanceWindowActive(settings);
  return {
    active,
    message: active ? settings.maintenanceMessage.trim() || DEFAULT_MESSAGE : "",
    until: active ? String(settings.maintenanceUntil || "") : "",
  };
}

export async function getPublicMaintenanceStatus(): Promise<PublicMaintenanceStatus> {
  await connection();
  try {
    const settings = await getSystemSettings();
    const status = toPublicMaintenanceStatus(settings);
    if (settings.maintenanceEnabled && !status.active && settings.maintenanceUntil) {
      await saveSystemSettings({ maintenanceEnabled: false }).catch(() => undefined);
    }
    return status;
  } catch {
    return { active: false, message: "", until: "" };
  }
}

export async function getMaintenanceSettings(): Promise<MaintenanceSettings> {
  const settings = await getSystemSettings();
  if (settings.maintenanceEnabled && !isMaintenanceWindowActive(settings) && settings.maintenanceUntil) {
    const next = await saveSystemSettings({ maintenanceEnabled: false }).catch(
      (): SystemSettings => ({ ...settings, maintenanceEnabled: false }),
    );
    return toMaintenanceSettings(next);
  }
  return toMaintenanceSettings(settings);
}

export async function saveMaintenanceSettings(input: {
  enabled: boolean;
  message: string;
  until: string;
}): Promise<MaintenanceSettings> {
  const message = String(input.message || "").trim();
  const until = String(input.until || "").trim();
  const enabled = Boolean(input.enabled);

  if (enabled) {
    if (!message) {
      throw new Error("Write why the website is in maintenance.");
    }
    if (!until) {
      throw new Error("Set how long maintenance should last.");
    }
    const untilMs = Date.parse(until);
    if (Number.isNaN(untilMs)) {
      throw new Error("Enter a valid maintenance end time.");
    }
    if (untilMs <= Date.now()) {
      throw new Error("Maintenance end time must be in the future.");
    }
  }

  const next = await saveSystemSettings({
    maintenanceEnabled: enabled,
    maintenanceMessage: message,
    maintenanceUntil: until,
  });
  return toMaintenanceSettings(next);
}

export async function publicMaintenanceResponse(): Promise<NextResponse | null> {
  const status = await getPublicMaintenanceStatus();
  if (!status.active) return null;
  return NextResponse.json(
    {
      success: false,
      code: "MAINTENANCE",
      error: status.message || DEFAULT_MESSAGE,
      until: status.until,
    },
    { status: 503, headers: { "Retry-After": "300" } },
  );
}

export { DEFAULT_MESSAGE as DEFAULT_MAINTENANCE_MESSAGE };
