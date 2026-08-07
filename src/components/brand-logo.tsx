type BrandLogoProps = {
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  showIcon?: boolean;
  showText?: boolean;
  showTagline?: boolean;
  stacked?: boolean;
  className?: string;
  /** @deprecated Always uses /logo.png */
  variant?: "svg" | "png";
};

const sizes = {
  sm: { icon: 36, text: "text-lg", gap: "gap-2.5", tagline: "text-[8px]" },
  md: { icon: 48, text: "text-xl", gap: "gap-3", tagline: "text-[9px]" },
  lg: { icon: 72, text: "text-3xl", gap: "gap-3.5", tagline: "text-[10px]" },
  xl: { icon: 80, text: "text-4xl", gap: "gap-4", tagline: "text-[11px]" },
  hero: { icon: 112, text: "text-5xl", gap: "gap-5", tagline: "text-xs" },
} as const;

/** Site-wide brand mark — always `public/logo.png`. */
export const BRAND_LOGO_SRC = "/logo.png";

export function BrandLogo({
  size = "md",
  showIcon = true,
  showText = true,
  showTagline,
  stacked = false,
  className = "",
}: BrandLogoProps) {
  const { icon, text, gap, tagline } = sizes[size];
  const taglineVisible =
    showTagline ??
    (stacked && (size === "lg" || size === "xl" || size === "hero"));

  return (
    <div
      className={`flex items-center ${stacked ? "flex-col justify-center" : ""} ${gap} ${className}`}
    >
      {showIcon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={BRAND_LOGO_SRC}
          alt="FlowDoverz"
          width={icon}
          height={icon}
          className={`shrink-0 object-contain drop-shadow-[0_0_20px_rgba(34,211,238,0.22)] ${stacked ? "ml-0" : ""}`}
        />
      ) : null}
      {showText && (
        <div className={`${stacked ? "text-center" : ""} leading-none`}>
          <span
            className={`${text} block font-black tracking-tight bg-gradient-to-r from-white via-cyan-100 to-emerald-300 bg-clip-text text-transparent`}
          >
            FlowDoverz
          </span>
          {taglineVisible && (
            <span
              className={`${tagline} mt-2 block font-semibold uppercase tracking-[0.24em] text-cyan-400/75`}
            >
              Google Flow Workspace
            </span>
          )}
        </div>
      )}
    </div>
  );
}
