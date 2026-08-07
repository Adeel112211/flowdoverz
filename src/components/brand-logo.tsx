"use client";

import { useId } from "react";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  showIcon?: boolean;
  showText?: boolean;
  showTagline?: boolean;
  stacked?: boolean;
  className?: string;
  variant?: "svg" | "png";
};

const sizes = {
  sm: { icon: 36, text: "text-lg", gap: "gap-2.5", tagline: "text-[8px]" },
  md: { icon: 48, text: "text-xl", gap: "gap-3", tagline: "text-[9px]" },
  lg: { icon: 64, text: "text-3xl", gap: "gap-3.5", tagline: "text-[10px]" },
  xl: { icon: 80, text: "text-4xl", gap: "gap-4", tagline: "text-[11px]" },
  hero: { icon: 112, text: "text-5xl", gap: "gap-5", tagline: "text-xs" },
} as const;

function LogoMark({ icon }: { icon: number }) {
  const uid = useId().replace(/:/g, "");
  const flowA = `logo-flow-a-${uid}`;
  const flowB = `logo-flow-b-${uid}`;
  const play = `logo-play-${uid}`;
  const node = `logo-node-${uid}`;

  return (
    <svg
      width={icon}
      height={icon}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_0_20px_rgba(34,211,238,0.22)]"
    >
      <path
        d="M4 29C4 13 16 5 27 8C37 11 43 19 41 28"
        stroke={`url(#${flowA})`}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M8 33C8 22 17 16 27 18C35 20 39 25 37 31"
        stroke={`url(#${flowB})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M16 14 16 34 32 24 16 14Z" fill={`url(#${play})`} />
      <path d="M20 20 20 28 27 24 20 20Z" fill="#030305" fillOpacity="0.22" />
      <circle cx="41" cy="28" r="2.6" fill={`url(#${node})`} />
      <circle cx="41" cy="28" r="4.4" stroke="#22d3ee" strokeOpacity="0.22" />
      <defs>
        <linearGradient id={flowA} x1="4" y1="29" x2="41" y2="8">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id={flowB} x1="8" y1="33" x2="37" y2="18">
          <stop stopColor="#67e8f9" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id={play} x1="16" y1="14" x2="32" y2="34">
          <stop stopColor="#ecfeff" />
          <stop offset="0.35" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
        <radialGradient
          id={node}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(41 28) scale(2.6)"
        >
          <stop stopColor="#a5f3fc" />
          <stop offset="1" stopColor="#10b981" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function BrandLogo({
  size = "md",
  showIcon = true,
  showText = true,
  showTagline,
  stacked = false,
  className = "",
  variant = "svg",
}: BrandLogoProps) {
  const { icon, text, gap, tagline } = sizes[size];
  const taglineVisible =
    showTagline ??
    (stacked && (size === "lg" || size === "xl" || size === "hero"));

  return (
    <div
      className={`flex items-center ${stacked ? "flex-col justify-center" : ""} ${gap} ${className}`}
    >
      {showIcon &&
        (variant === "png" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo.png"
            alt=""
            width={icon}
            height={icon}
            className="shrink-0 drop-shadow-[0_0_20px_rgba(34,211,238,0.22)]"
          />
        ) : (
          <LogoMark icon={icon} />
        ))}
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
