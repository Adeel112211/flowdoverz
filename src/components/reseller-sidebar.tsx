"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useResellerNav } from "@/components/reseller-nav";

export function ResellerSidebar({ brandName }: { brandName: string }) {
  const pathname = usePathname();
  const nav = useResellerNav();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { name: "Dashboard", href: nav.home, icon: LayoutDashboard },
    { name: "Clients", href: nav.clients, icon: Users },
    { name: "Password", href: nav.password, icon: KeyRound },
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/reseller-panel/auth", { method: "DELETE", credentials: "include" });
    } catch {
      // still leave the panel
    }
    window.location.href = nav.home;
  };

  return (
    <>
      <div className="admin-mobile-topbar z-50 flex shrink-0 items-center justify-between border-b border-white/5 bg-[#0F172A] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
        <Link href={nav.home} className="min-w-0">
          <BrandLogo size="md" className="gap-2 [&_img]:!h-10 [&_img]:!w-10" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="-mr-2 rounded-lg p-2 text-slate-300 hover:bg-white/5 hover:text-white"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="reseller-mobile-nav"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 top-[var(--admin-mobile-topbar-height,4.5rem)] z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="reseller-mobile-nav"
        className={`fixed z-40 flex h-[calc(100dvh-var(--admin-mobile-topbar-height,4.5rem))] w-[min(18rem,88vw)] shrink-0 flex-col border-r border-white/5 bg-[#0F172A]/95 backdrop-blur-xl transition-transform duration-300 lg:relative lg:top-0 lg:h-full lg:w-64 lg:translate-x-0 lg:bg-[#0F172A]/80 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } top-[var(--admin-mobile-topbar-height,4.5rem)] lg:top-0`}
      >
        <div className="hidden border-b border-white/5 p-6 lg:block">
          <Link href={nav.home}>
            <BrandLogo size="md" className="gap-2 [&_img]:!h-11 [&_img]:!w-11" />
          </Link>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto py-6">
          <div className="mb-2 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Reseller panel</div>
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              pathname === `/reseller${item.href === "/" ? "" : item.href}` ||
              (item.href === "/reseller" && pathname === "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition-all max-lg:min-h-11 max-lg:py-3.5 ${
                  active ? "bg-cyan-500 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-white/5 p-4">
          <div className="mb-3 truncate px-2 text-xs text-slate-500">{brandName}</div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
