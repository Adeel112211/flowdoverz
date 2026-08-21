export type ExtensionReleaseMeta = {
  version: string;
  versionName?: string;
  changelog: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  isActive: boolean;
};

export type ExtensionConfig = {
  name: string;
  shortName: string;
  description: string;
  minChromeVersion: string;
  installSteps: string[];
  mobileInstallSteps: string[];
  chromeStoreUrl?: string;
  activeVersion: string | null;
  officialHash?: string | null;
  previousOfficialHashes?: string[];
  releases: ExtensionReleaseMeta[];
};

export const DEFAULT_EXTENSION_CONFIG: ExtensionConfig = {
  name: "FlowDoverz",
  shortName: "FlowDoverz",
  description: "Connect your FlowDoverz workspace to Google Flow AI sessions.",
  minChromeVersion: "119",
  installSteps: [
    "Click Download Extension on your dashboard (ZIP starts downloading).",
    "Click Open Chrome Web Store, then press Add to Chrome on the store page.",
    "If you use the ZIP instead: unzip, open chrome://extensions, enable Developer mode, Load unpacked.",
    "Click the extension icon, Sync now, and open Google Flow.",
  ],
  mobileInstallSteps: [
    "Open this dashboard on a computer for the easiest install.",
    "Click Download Extension, then Open Chrome Web Store → Add to Chrome.",
    "Or transfer the ZIP to desktop and Load unpacked from chrome://extensions.",
    "Tap Connect / Sync now, and open Google Flow.",
  ],
  chromeStoreUrl: "",
  activeVersion: null,
  officialHash: null,
  previousOfficialHashes: [],
  releases: [],
};

export const MAX_EXTENSION_ZIP_BYTES = 2 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function sanitizeVersion(version: string) {
  return version.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}
