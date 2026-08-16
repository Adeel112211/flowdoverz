"use client";

import { useState } from "react";
import { LogOut, User } from "lucide-react";
import { signOut, type Session } from "@/lib/auth";

type Props = {
  session: Session;
};

export function UserMenuButton({ session }: Props) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  function handleSignOut() {
    signOut();
    window.location.href = "/";
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 shadow-inner transition-all hover:border-cyan-500/40 hover:bg-cyan-500/20"
        aria-label="Account menu"
      >
        <User size={18} />
      </button>

      {isDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
          <div className="absolute right-0 z-50 mt-3 w-64 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c16] shadow-[0_16px_48px_rgba(0,0,0,0.85)]">
            <div className="flex items-center gap-3 border-b border-white/5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-lg font-black uppercase text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                {session.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{session.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <p className="truncate text-xs text-slate-400">{session.email}</p>
                </div>
              </div>
            </div>
            <div className="p-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-400 transition-all hover:bg-rose-500/10 hover:shadow-[inset_0_0_10px_rgba(225,29,72,0.1)]"
              >
                <LogOut size={16} className="transition-transform group-hover:-translate-x-1" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
