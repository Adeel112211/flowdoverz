"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Palette, Plus, Type, X } from "lucide-react";
import { renderTemplateEmail } from "@/lib/email-render";
import { fetchReceiptScanCodeHtml } from "@/lib/receipt-barcode-html";
import {
  buildReceiptHtmlForTemplate,
  DEFAULT_RECEIPT_TEXT,
  DEFAULT_REFUND_RECEIPT_TEXT,
  receiptTextFromTemplateFields,
} from "@/lib/receipt-html";
import {
  COLOR_FIELDS,
  EMAIL_STYLE_OPTIONS,
  resolveEmailColors,
  SAMPLE_TEMPLATE_VARS,
  type EmailTemplateStyle,
  type EmailThemeColors,
} from "@/lib/email-theme";

export type TemplateEditorValue = {
  id: string;
  subject: string;
  heading?: string;
  preheader?: string;
  badge?: string;
  badgeTone?: "info" | "success" | "warning" | "error";
  message: string;
  htmlBody: string;
  textBody: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerText?: string;
  style?: EmailTemplateStyle;
  colors?: Partial<EmailThemeColors>;
  logoUrl?: string;
  headerImageUrl?: string;
  placeholders: string[];
};

type Props = {
  value: TemplateEditorValue;
  brandName?: string;
  defaultLogoUrl?: string;
  defaultStyle?: EmailTemplateStyle;
  defaultColors?: Partial<EmailThemeColors>;
  layoutLocked?: boolean;
  onChange: (patch: Partial<TemplateEditorValue>) => void;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-colors";

const labelClass = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

function EditorAccordionSection({
  title,
  description,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Palette;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
        isOpen
          ? "border-cyan-500/30 bg-[#080810] ring-1 ring-cyan-500/20"
          : "border-white/10 bg-[#0F172A] hover:border-cyan-500/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              isOpen
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                : "border-white/10 bg-[#080810] text-slate-400"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3
              className={`text-base font-bold transition-colors md:text-lg ${
                isOpen ? "text-white" : "text-slate-300"
              }`}
            >
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 md:text-sm">{description}</p>
          </div>
        </div>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            isOpen ? "rotate-45 bg-cyan-500 text-slate-950" : "bg-[#080810] text-slate-400 border border-white/10"
          }`}
        >
          <Plus className="h-4 w-4" />
        </div>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-5 border-t border-white/10 px-5 pb-6 pt-5 md:px-6 md:pb-7 md:pt-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {title && (
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{title}</p>
      )}
      {children}
    </div>
  );
}

function messageToHtml(message: string, textColor: string) {
  const paragraphs = message.split(/\n\n+/).filter((p) => p.trim());
  if (!paragraphs.length) return "";
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;color:${textColor};">${p.trim().replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

function htmlToMessage(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function readImageFile(file: File, maxKb = 400) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please drop an image file (PNG, JPG, GIF, WebP).");
  }
  if (file.size > maxKb * 1024) {
    throw new Error(`Image must be under ${maxKb}KB.`);
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

export function ImageDropZone({
  label,
  hint,
  imageUrl,
  onImage,
  onClear,
  tall,
}: {
  label: string;
  hint: string;
  imageUrl?: string;
  onImage: (url: string) => void;
  onClear: () => void;
  tall?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError("");
    try {
      const url = await readImageFile(file);
      onImage(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</label>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-colors ${
          tall ? "min-h-[140px]" : "min-h-[100px]"
        } flex flex-col items-center justify-center gap-2 px-4 py-4 text-center ${
          dragging
            ? "border-cyan-500 bg-cyan-500/10"
            : "border-white/10 bg-[#080810] hover:border-cyan-500/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className={`rounded-lg object-contain ${tall ? "max-h-28 w-full" : "max-h-16"}`}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute right-2 top-2 rounded-lg bg-[#0F172A] border border-white/10 p-1 text-slate-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <ImagePlus className="h-8 w-8 text-slate-500" />
            <p className="text-xs text-slate-400">{hint}</p>
            <p className="text-[10px] text-slate-600">Drag & drop or click · max 400KB</p>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export function EmailTemplateEditor({
  value,
  brandName = "FlowDoverz",
  defaultLogoUrl,
  defaultStyle = "modern",
  defaultColors,
  layoutLocked = false,
  onChange,
}: Props) {
  const [openSections, setOpenSections] = useState({ styling: true, content: true });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(720);
  const [receiptBarcodeHtml, setReceiptBarcodeHtml] = useState("");
  const previewRef = useRef<HTMLIFrameElement>(null);
  const style = value.style || defaultStyle;
  const colors = resolveEmailColors(style, { ...defaultColors, ...value.colors });

  const applyChange = useCallback(
    (patch: Partial<TemplateEditorValue>) => {
      if (!layoutLocked) {
        onChange(patch);
        return;
      }
      const merged = { ...value, ...patch };
      const nextStyle = merged.style || defaultStyle;
      const resolved = resolveEmailColors(nextStyle, { ...defaultColors, ...merged.colors });
      const receiptVariant = merged.id === "payment_refund_receipt" ? "refund" : "payment";
      onChange({
        ...patch,
        htmlBody: buildReceiptHtmlForTemplate(
          resolved,
          nextStyle,
          receiptTextFromTemplateFields(merged),
          receiptVariant,
        ),
      });
    },
    [layoutLocked, onChange, value, defaultStyle, defaultColors],
  );

  useEffect(() => {
    let cancelled = false;
    fetchReceiptScanCodeHtml(SAMPLE_TEMPLATE_VARS["{{appUrl}}"])
      .then((html) => {
        if (!cancelled) setReceiptBarcodeHtml(html);
      })
      .catch(() => {
        if (!cancelled) setReceiptBarcodeHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const previewHtml = useMemo(() => {
    const templateVars = {
      ...SAMPLE_TEMPLATE_VARS,
      "{{receiptBarcode}}": receiptBarcodeHtml,
    };
    const { html } = renderTemplateEmail(
      {
        id: value.id as never,
        name: "",
        audience: "client",
        description: "",
        subject: value.subject,
        textBody: value.textBody,
        htmlBody: value.htmlBody,
        preheader: value.preheader,
        badge: value.badge,
        badgeTone: value.badgeTone,
        ctaLabel: value.ctaLabel,
        ctaHref: value.ctaHref,
        heading: value.heading,
        footerText: value.footerText,
        style: value.style,
        colors: value.colors,
        logoUrl: value.logoUrl,
        headerImageUrl: value.headerImageUrl,
        placeholders: value.placeholders,
      },
      templateVars,
      {
        brandName,
        defaultStyle,
        defaultLogoUrl,
        defaultColors,
        appUrl: SAMPLE_TEMPLATE_VARS["{{appUrl}}"],
      },
    );
    return html;
  }, [value, brandName, defaultStyle, defaultLogoUrl, defaultColors, receiptBarcodeHtml]);

  const syncPreviewHeight = useCallback(() => {
    const doc = previewRef.current?.contentDocument;
    if (!doc?.body) return;
    const height = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight,
    );
    setPreviewHeight(height);
  }, []);

  useEffect(() => {
    syncPreviewHeight();
  }, [previewHtml, syncPreviewHeight]);

  const updateMessage = useCallback(
    (message: string) => {
      const htmlBody = messageToHtml(message, colors.text);
      onChange({ message, htmlBody });
    },
    [colors.text, onChange],
  );

  const updateColor = (key: keyof EmailThemeColors, hex: string) => {
    applyChange({ colors: { ...value.colors, [key]: hex } });
  };

  const resetColors = () => applyChange({ colors: {} });

  const toggleSection = (section: "styling" | "content") => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <div className="space-y-3 min-w-0">
        <EditorAccordionSection
          title="Styling"
          description="Template layout, brand colors, logo and header images"
          icon={Palette}
          isOpen={openSections.styling}
          onToggle={() => toggleSection("styling")}
        >
          <FieldGroup title="Template style">
            <div className="grid gap-2 sm:grid-cols-2">
              {EMAIL_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => applyChange({ style: opt.id, colors: {} })}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    style === opt.id
                      ? "border-cyan-500 bg-[#0F172A] ring-1 ring-cyan-500/30"
                      : "border-white/10 bg-[#0F172A] hover:border-cyan-500/30"
                  }`}
                >
                  <p className="text-sm font-bold text-white">{opt.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{opt.description}</p>
                </button>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup title="Colors">
            {layoutLocked && (
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                Card = receipt paper · Primary = brand accent & QR · Secondary = total price ·
                Heading = titles · Body text = labels
              </p>
            )}
            <div className="flex items-center justify-end -mt-8 mb-1">
              <button
                type="button"
                onClick={resetColors}
                className="text-xs font-bold text-cyan-500/80 hover:text-cyan-400"
              >
                Reset colors
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {COLOR_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#0F172A] p-2.5">
                  <input
                    type="color"
                    value={
                      (value.colors?.[key] || colors[key]).startsWith("rgba")
                        ? "#06b6d4"
                        : (value.colors?.[key] || colors[key]).slice(0, 7)
                    }
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-[#080810]"
                  />
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>{label}</label>
                    <input
                      className={`${inputClass} py-1.5 font-mono text-xs`}
                      value={value.colors?.[key] ?? colors[key]}
                      onChange={(e) => updateColor(key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup title="Images">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageDropZone
                label="Logo image"
                hint="Drop your logo here"
                imageUrl={value.logoUrl || defaultLogoUrl}
                onImage={(url) => applyChange({ logoUrl: url })}
                onClear={() => applyChange({ logoUrl: "" })}
              />
              <ImageDropZone
                label="Header banner"
                hint="Hero image (Bold style)"
                imageUrl={value.headerImageUrl}
                onImage={(url) => applyChange({ headerImageUrl: url })}
                onClear={() => applyChange({ headerImageUrl: "" })}
                tall
              />
            </div>
          </FieldGroup>
        </EditorAccordionSection>

        <EditorAccordionSection
          title="Content"
          description="Subject, message text, badge, button label and footer"
          icon={Type}
          isOpen={openSections.content}
          onToggle={() => toggleSection("content")}
        >
          <FieldGroup title="Email meta">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Subject</label>
                <input
                  className={inputClass}
                  value={value.subject}
                  onChange={(e) => applyChange({ subject: e.target.value })}
                />
              </div>
              {!layoutLocked && (
                <div>
                  <label className={labelClass}>Email heading</label>
                  <input
                    className={inputClass}
                    value={value.heading || ""}
                    onChange={(e) => onChange({ heading: e.target.value })}
                    placeholder="Big title shown inside the email"
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>Preheader</label>
                <input
                  className={inputClass}
                  value={value.preheader || ""}
                  onChange={(e) => applyChange({ preheader: e.target.value })}
                  placeholder="Preview text in inbox before opening"
                />
              </div>
            </div>
          </FieldGroup>

          {!layoutLocked && (
            <FieldGroup title="Status badge">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Badge label</label>
                  <input
                    className={inputClass}
                    value={value.badge || ""}
                    onChange={(e) => onChange({ badge: e.target.value })}
                    placeholder="e.g. Pending review"
                  />
                </div>
                <div>
                  <label className={labelClass}>Badge tone</label>
                  <select
                    className={inputClass}
                    value={value.badgeTone || "info"}
                    onChange={(e) =>
                      onChange({
                        badgeTone: e.target.value as TemplateEditorValue["badgeTone"],
                      })
                    }
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </div>
            </FieldGroup>
          )}

          <FieldGroup title={layoutLocked ? "Receipt text" : "Message body"}>
            {layoutLocked ? (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Receipt title</label>
                  <input
                    className={inputClass}
                    value={
                      value.badge ||
                      (value.id === "payment_refund_receipt"
                        ? DEFAULT_REFUND_RECEIPT_TEXT.receiptLabel
                        : DEFAULT_RECEIPT_TEXT.receiptLabel)
                    }
                    onChange={(e) => applyChange({ badge: e.target.value })}
                    placeholder={
                      value.id === "payment_refund_receipt" ? "REFUND" : "RECEIPT"
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Brand name</label>
                  <input
                    className={inputClass}
                    value={value.heading || DEFAULT_RECEIPT_TEXT.brandName}
                    onChange={(e) => applyChange({ heading: e.target.value })}
                    placeholder="FLOWDOVERZ"
                  />
                </div>
                <div>
                  <label className={labelClass}>Footer note</label>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-y leading-relaxed`}
                    value={
                      value.footerText ||
                      (value.id === "payment_refund_receipt"
                        ? DEFAULT_REFUND_RECEIPT_TEXT.footerNote
                        : DEFAULT_RECEIPT_TEXT.footerNote)
                    }
                    onChange={(e) => applyChange({ footerText: e.target.value })}
                    placeholder={
                      value.id === "payment_refund_receipt"
                        ? DEFAULT_REFUND_RECEIPT_TEXT.footerNote
                        : DEFAULT_RECEIPT_TEXT.footerNote
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {value.placeholders.map((ph) => (
                    <span
                      key={ph}
                      className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] text-cyan-400/90"
                    >
                      {ph}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Message</label>
                <textarea
                  rows={6}
                  className={`${inputClass} resize-y leading-relaxed`}
                  value={value.message}
                  onChange={(e) => updateMessage(e.target.value)}
                  placeholder="Write your email message. Use blank lines between paragraphs."
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {value.placeholders.map((ph) => (
                    <span
                      key={ph}
                      className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] text-cyan-400/90"
                    >
                      {ph}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </FieldGroup>

          {!layoutLocked && (
            <FieldGroup title="Actions & footer">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>CTA button label</label>
                  <input
                    className={inputClass}
                    value={value.ctaLabel || ""}
                    onChange={(e) => onChange({ ctaLabel: e.target.value })}
                    placeholder="View dashboard"
                  />
                </div>
                <div>
                  <label className={labelClass}>Footer sign-off</label>
                  <input
                    className={inputClass}
                    value={value.footerText || ""}
                    onChange={(e) => onChange({ footerText: e.target.value })}
                    placeholder="The FlowDoverz Team"
                  />
                </div>
              </div>
            </FieldGroup>
          )}

          <div className="rounded-xl border border-white/10 bg-[#0F172A] p-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-bold text-slate-400 hover:text-slate-200"
            >
              <span>Advanced HTML & plain text</span>
              <Plus
                className={`h-4 w-4 transition-transform duration-300 ${showAdvanced ? "rotate-45 text-cyan-400" : ""}`}
              />
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                <div>
                  <label className={labelClass}>Plain text body</label>
                  <textarea
                    rows={4}
                    className={`${inputClass} resize-y font-mono text-xs`}
                    value={value.textBody}
                    onChange={(e) => onChange({ textBody: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>HTML body</label>
                  <textarea
                    rows={6}
                    className={`${inputClass} resize-y font-mono text-xs`}
                    value={value.htmlBody}
                    onChange={(e) =>
                      layoutLocked
                        ? applyChange({
                            htmlBody: e.target.value,
                            message: htmlToMessage(e.target.value),
                          })
                        : onChange({
                            htmlBody: e.target.value,
                            message: htmlToMessage(e.target.value),
                          })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </EditorAccordionSection>
      </div>

      <div className="min-w-0 xl:sticky xl:top-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Live preview</p>
          <span className="rounded-md border border-white/10 bg-[#0F172A] px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
            {EMAIL_STYLE_OPTIONS.find((o) => o.id === style)?.name || "Modern Dark"}
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#080810]">
          <iframe
            ref={previewRef}
            title="Email preview"
            srcDoc={previewHtml}
            scrolling="no"
            onLoad={syncPreviewHeight}
            className="block w-full border-0"
            style={{ height: previewHeight }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}

export function templateToEditorValue(t: {
  id: string;
  subject: string;
  heading?: string;
  preheader?: string;
  badge?: string;
  badgeTone?: TemplateEditorValue["badgeTone"];
  htmlBody: string;
  textBody: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerText?: string;
  style?: EmailTemplateStyle;
  colors?: Partial<EmailThemeColors>;
  logoUrl?: string;
  headerImageUrl?: string;
  placeholders: string[];
}): TemplateEditorValue {
  return {
    ...t,
    message: htmlToMessage(t.htmlBody),
  };
}

export function editorValueToSavePayload(value: TemplateEditorValue) {
  return {
    subject: value.subject,
    heading: value.heading,
    preheader: value.preheader,
    badge: value.badge,
    badgeTone: value.badgeTone,
    textBody: value.textBody,
    htmlBody: value.htmlBody,
    ctaLabel: value.ctaLabel,
    ctaHref: value.ctaHref,
    footerText: value.footerText,
    style: value.style,
    colors: value.colors,
    logoUrl: value.logoUrl,
    headerImageUrl: value.headerImageUrl,
  };
}
