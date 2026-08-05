"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { useEffect, useState } from "react";
import { getSession, signOut, type Session } from "@/lib/auth";
import { LogOut, User } from "lucide-react";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function SiteHeader() {
  const [session, setSession] = useState<Session | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

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
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white sm:inline-flex hover:bg-white/5 border border-white/5"
              >
                Dashboard
              </Link>
              
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-transform hover:scale-105 border-2 border-[#080810]"
                >
                  <User size={18} />
                </button>

                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-[#0c0c16]/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden transform origin-top-right transition-all">
                      <div className="p-4 border-b border-white/5">
                        <p className="font-bold text-white truncate">{session.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                          </div>
                          <p className="text-xs text-slate-400 truncate">{session.email}</p>
                        </div>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <LogOut size={16} /> Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
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
