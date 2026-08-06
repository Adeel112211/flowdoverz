"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { useClientSession } from "@/hooks/use-client-session";
import { UserMenuButton } from "@/components/user-menu-button";
import { appPath } from "@/lib/site-urls";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function SiteHeader() {
  const session = useClientSession();

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-white/5 bg-[#080810]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="FlowDoverz home">
          <BrandLogo size="sm" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-slate-400 transition-colors hover:text-cyan-200"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <div className="flex items-center gap-3">
              <Link
                href={appPath("/dashboard")}
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_4px_20px_rgba(34,211,238,0.25)] transition-transform hover:-translate-y-px"
              >
                Dashboard
              </Link>
              <UserMenuButton session={session} />
            </div>
          ) : (
            <>
              <Link
                href={appPath("/login")}
                className="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href={appPath("/signup")}
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_4px_20px_rgba(34,211,238,0.25)] transition-transform hover:-translate-y-px"
              >
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
