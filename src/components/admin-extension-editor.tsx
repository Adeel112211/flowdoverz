"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Copy,
  FileArchive,
  KeyRound,
  Monitor,
  Package,
  Puzzle,
  Smartphone,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  formatFileSize,
  MAX_EXTENSION_ZIP_BYTES,
  type ExtensionConfig,
  type ExtensionReleaseMeta,
} from "@/lib/extension-config";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-colors";

const labelClass = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  icon: typeof Package;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex h-auto flex-col rounded-xl border border-white/10 bg-[#080810] lg:h-full ${className}`}
    >
      <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4 md:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white md:text-base">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-4 px-5 py-5 md:px-6 md:py-6">{children}</div>
    </section>
  );
}

function InstallStepsEditor({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (next: string[]) => void;
}) {
  const updateStep = (index: number, value: string) => {
    onChange(steps.map((s, i) => (i === index ? value : s)));
  };

  return (
    <div className="flex flex-1 flex-col space-y-2">
      {steps.map((step, index) => (
        <div key={index} className="flex gap-2">
          <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-400">
            {index + 1}
          </span>
          <input
            className={`${inputClass} flex-1`}
            value={step}
            onChange={(e) => updateStep(index, e.target.value)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...steps, "New step"])}
        className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
      >
        + Add step
      </button>
    </div>
  );
}

async function readZipFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".zip") && file.type !== "application/zip") {
    throw new Error("Please upload a .zip file.");
  }
  if (file.size > MAX_EXTENSION_ZIP_BYTES) {
    throw new Error(`ZIP must be under ${Math.floor(MAX_EXTENSION_ZIP_BYTES / 1024)}KB.`);
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read ZIP file."));
    reader.readAsDataURL(file);
  });
}

type Props = {
  config: ExtensionConfig;
  syncKey: string;
  onChange: (next: ExtensionConfig) => void;
  onUpload: (payload: {
    version: string;
    versionName: string;
    changelog: string;
    fileName: string;
    zipBase64: string;
  }) => Promise<void>;
  onSetActive: (version: string) => Promise<void>;
  onDelete: (version: string) => Promise<void>;
  onCopySyncKey: () => void;
};

export function AdminExtensionEditor({
  config,
  syncKey,
  onChange,
  onUpload,
  onSetActive,
  onDelete,
  onCopySyncKey,
}: Props) {
  const [version, setVersion] = useState("1.0.0");
  const [versionName, setVersionName] = useState("");
  const [changelog, setChangelog] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipError, setZipError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeRelease = config.releases.find((r) => r.version === config.activeVersion);

  const handleZip = async (file: File | null) => {
    if (!file) return;
    setZipError("");
    try {
      await readZipFile(file);
      setZipFile(file);
    } catch (e) {
      setZipError(e instanceof Error ? e.message : "Invalid file");
      setZipFile(null);
    }
  };

  const submitUpload = async () => {
    if (!zipFile) {
      setZipError("Select a ZIP file first.");
      return;
    }
    setUploading(true);
    try {
      const zipBase64 = await readZipFile(zipFile);
      await onUpload({
        version,
        versionName,
        changelog,
        fileName: zipFile.name,
        zipBase64,
      });
      setZipFile(null);
      setChangelog("");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#080810] px-4 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Active version</p>
          <p className="mt-1 text-xl font-black text-white">
            {config.activeVersion ? `v${config.activeVersion}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#080810] px-4 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total releases</p>
          <p className="mt-1 text-xl font-black text-white">{config.releases.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#080810] px-4 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Download</p>
          {config.activeVersion ? (
            <a
              href={`/api/extension/download?v=${encodeURIComponent(config.activeVersion)}`}
              className="mt-1 inline-block text-sm font-bold text-cyan-400 hover:text-cyan-300"
            >
              Test download →
            </a>
          ) : (
            <p className="mt-1 text-sm text-slate-500">No active release</p>
          )}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title="Extension details"
          description="Name, description and Chrome requirements"
          icon={Puzzle}
        >
          <div className="flex flex-1 flex-col">
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Extension name</label>
              <input
                className={inputClass}
                value={config.name}
                onChange={(e) => onChange({ ...config, name: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Short name</label>
              <input
                className={inputClass}
                value={config.shortName}
                onChange={(e) => onChange({ ...config, shortName: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                rows={3}
                className={`${inputClass} resize-y`}
                value={config.description}
                onChange={(e) => onChange({ ...config, description: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Min Chrome version</label>
              <input
                className={inputClass}
                value={config.minChromeVersion}
                onChange={(e) => onChange({ ...config, minChromeVersion: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Chrome Web Store URL</label>
              <input
                className={inputClass}
                value={config.chromeStoreUrl || ""}
                onChange={(e) => onChange({ ...config, chromeStoreUrl: e.target.value })}
                placeholder="https://chromewebstore.google.com/detail/your-extension-id"
              />
            </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Upload release"
          description="Add a new extension ZIP and version details"
          icon={Upload}
        >
          <div className="flex flex-1 flex-col gap-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleZip(e.dataTransfer.files?.[0] || null);
            }}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              zipFile
                ? "border-cyan-500/40 bg-cyan-500/5"
                : "border-white/10 bg-[#0F172A] hover:border-cyan-500/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => handleZip(e.target.files?.[0] || null)}
            />
            {zipFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileArchive className="h-7 w-7 text-cyan-400" />
                <div className="text-left">
                  <p className="text-sm font-bold text-white">{zipFile.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(zipFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZipFile(null);
                  }}
                  className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <FileArchive className="mx-auto h-9 w-9 text-slate-500" />
                <p className="mt-2 text-sm text-slate-400">Drag & drop extension ZIP</p>
                <p className="mt-1 text-[10px] text-slate-600">
                  or click to browse · max {Math.floor(MAX_EXTENSION_ZIP_BYTES / 1024)}KB
                </p>
              </>
            )}
          </div>
          {zipError && <p className="text-xs text-rose-400">{zipError}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Version</label>
              <input
                className={inputClass}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            <div>
              <label className={labelClass}>Version label</label>
              <input
                className={inputClass}
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="1.0.0 — Stable"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Changelog</label>
            <textarea
              rows={3}
              className={`${inputClass} resize-y`}
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="What's new in this release..."
            />
          </div>
          <button
            type="button"
            disabled={uploading || !zipFile}
            onClick={submitUpload}
            className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload release"}
          </button>
          </div>
        </SectionCard>
      </div>

      {/* Install steps — desktop + mobile */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title="Desktop install steps"
          description="Instructions shown on the user dashboard (desktop)"
          icon={Monitor}
        >
          <InstallStepsEditor
            steps={config.installSteps}
            onChange={(installSteps) => onChange({ ...config, installSteps })}
          />
        </SectionCard>

        <SectionCard
          title="Mobile install steps"
          description="Instructions shown on the user dashboard (mobile)"
          icon={Smartphone}
        >
          <InstallStepsEditor
            steps={config.mobileInstallSteps}
            onChange={(mobileInstallSteps) => onChange({ ...config, mobileInstallSteps })}
          />
        </SectionCard>
      </div>

      {/* Releases + connect */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        <SectionCard
          title="Releases"
          description={
            activeRelease
              ? `${activeRelease.fileName} · ${formatFileSize(activeRelease.fileSize)}`
              : "Published ZIP versions for download"
          }
          icon={FileArchive}
          className="lg:col-span-2"
        >
          <div className="flex flex-1 flex-col">
          {config.releases.length === 0 ? (
            <p className="flex flex-1 items-center text-sm text-slate-500">No releases uploaded yet. Upload a ZIP above.</p>
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/10">
              {config.releases.map((release) => (
                <ReleaseRow
                  key={release.version}
                  release={release}
                  isActive={release.version === config.activeVersion}
                  onSetActive={() => onSetActive(release.version)}
                  onDelete={() => onDelete(release.version)}
                />
              ))}
            </div>
          )}
          </div>
        </SectionCard>

        <SectionCard
          title="Extension connect"
          description="Sync key for cookie delivery to the extension"
          icon={KeyRound}
        >
          {syncKey ? (
            <div className="flex flex-1 flex-col gap-4">
              <code className="block flex-1 rounded-xl border border-white/10 bg-[#0F172A] px-3 py-3 text-xs text-cyan-300 break-all leading-relaxed">
                {syncKey}
              </code>
              <button
                type="button"
                onClick={onCopySyncKey}
                className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:border-cyan-500/30"
              >
                <Copy className="h-4 w-4" /> Copy sync key
              </button>
            </div>
          ) : (
            <p className="flex flex-1 items-center text-sm text-amber-400">
              No sync key in session. Lock and unlock admin to generate one.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ReleaseRow({
  release,
  isActive,
  onSetActive,
  onDelete,
}: {
  release: ExtensionReleaseMeta;
  isActive: boolean;
  onSetActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 ${
        isActive ? "bg-cyan-500/5" : "bg-transparent"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-white">v{release.version}</p>
          {release.versionName && (
            <span className="text-xs text-slate-500">{release.versionName}</span>
          )}
          {isActive && (
            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-400">
              Active
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {release.fileName} · {formatFileSize(release.fileSize)} ·{" "}
          {new Date(release.uploadedAt).toLocaleString()}
        </p>
        {release.changelog && (
          <p className="mt-2 text-sm text-slate-400 whitespace-pre-wrap line-clamp-2">
            {release.changelog}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {!isActive && (
          <button
            type="button"
            onClick={onSetActive}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-cyan-500/30"
          >
            Set active
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-white/10 p-1.5 text-slate-500 hover:border-rose-500/30 hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
