type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  stacked?: boolean;
  className?: string;
};

const sizes = {
  sm: { icon: 32, text: "text-base" },
  md: { icon: 40, text: "text-lg" },
  lg: { icon: 56, text: "text-2xl" },
} as const;

export function BrandLogo({
  size = "md",
  showText = true,
  stacked = false,
  className = "",
}: BrandLogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className={`flex ${stacked ? "flex-col justify-center" : ""} items-center gap-2.5 ${className}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="48" height="48" rx="12" fill="url(#logo-bg)" />
        <path
          d="M8 28C8 28 14 22 24 22C34 22 40 28 40 28"
          stroke="url(#logo-bridge)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M12 28V34M18 28V34M24 28V34M30 28V34M36 28V34"
          stroke="#67e8f9"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
        <circle cx="24" cy="16" r="4" fill="#a5f3fc" />
        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="48" y2="48">
            <stop stopColor="#0c4a6e" />
            <stop offset="1" stopColor="#164e63" />
          </linearGradient>
          <linearGradient id="logo-bridge" x1="8" y1="28" x2="40" y2="28">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span
          className={`${text} font-extrabold tracking-tight bg-gradient-to-r from-cyan-200 to-teal-300 bg-clip-text text-transparent`}
        >
          FlowDoverz
        </span>
      )}
    </div>
  );
}
