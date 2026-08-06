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
  releases: ExtensionReleaseMeta[];
};

export const DEFAULT_EXTENSION_CONFIG: ExtensionConfig = {
  name: "FlowDoverz",
  shortName: "FlowDoverz",
  description: "Connect your FlowDoverz workspace to Google Flow AI sessions.",
  minChromeVersion: "119",
  installSteps: [
    "Download the latest extension ZIP from your dashboard.",
    "Unzip the folder on your computer.",
    "Open chrome://extensions, enable Developer mode, click Load unpacked, and select the folder.",
    "Click the extension icon, press Connect Now, and open Google Flow.",
  ],
  mobileInstallSteps: [
    "Open this dashboard on your phone or tablet.",
    "Tap Download to save the extension ZIP to your device.",
    "Transfer the ZIP to a desktop, or use a mobile browser that supports Chrome extensions.",
    "Install the extension, tap Connect Now, and open Google Flow.",
  ],
  activeVersion: null,
  releases: [],
};

export const MAX_EXTENSION_ZIP_BYTES = 700 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function sanitizeVersion(version: string) {
  return version.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}
