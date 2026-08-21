export const EXTENSION_UPDATE_CODE = "EXTENSION_UPDATE_REQUIRED";

export const EXTENSION_UPDATE_MESSAGE =
  "A new FlowDoverz extension is required. Download it from your dashboard and install it to continue.";

export function compareExtensionVersions(left: string, right: string) {
  const a = String(left || "")
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((part) => Number(part) || 0);
  const b = String(right || "")
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((part) => Number(part) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function bumpPatchVersion(version: string) {
  const raw = String(version || "").trim() || "1.0.0";
  const parts = raw.split(".").map((part) => Number(part));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) {
    return `${raw}.1`;
  }
  parts[parts.length - 1] = (parts[parts.length - 1] || 0) + 1;
  return parts.join(".");
}

export function isOlderExtensionVersion(installed: string | null | undefined, required: string | null | undefined) {
  const need = String(required || "").trim();
  if (!need) return false;
  const have = String(installed || "").trim();
  if (!have) return true;
  return compareExtensionVersions(have, need) < 0;
}
