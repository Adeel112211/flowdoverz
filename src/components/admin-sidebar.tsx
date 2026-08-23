"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, CreditCard, Cookie, Settings, LayoutDashboard, LogOut, Menu, X, Activity, Radio, Mail, Send, Tag, Puzzle, Receipt, Construction, Store } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const navItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Client Manager", href: "/admin/clients", icon: Users },
  { name: "Payments", href: "/admin/payments", icon: CreditCard },
  { name: "Receipts", href: "/admin/receipts", icon: Receipt },
  { name: "Cookie Manager", href: "/admin/cookies", icon: Cookie },
  { name: "Resellers", href: "/admin/resellers", icon: Store },
  { name: "Sync Status", href: "/admin/sync", icon: Radio },
  { name: "SMTP & Templates", href: "/admin/smtp", icon: Send },
  { name: "Activity Log", href: "/admin/activity", icon: Activity },
  { name: "Email History", href: "/admin/emails", icon: Mail },
  { name: "Pricing", href: "/admin/pricing", icon: Tag },
  { name: "Extension", href: "/admin/extension", icon: Puzzle },
  { name: "Maintenance", href: "/admin/maintenance", icon: Construction },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const handleLock = async () => {
    try {
      await fetch("/api/admin", { method: "DELETE" });
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {/* Mobile Top Header — stays in fixed admin shell (works in installed PWA too) */}
      <div className="admin-mobile-topbar lg:hidden z-50 flex shrink-0 items-center justify-between border-b border-white/5 bg-[#0F172A] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/admin" className="min-w-0">
          <BrandLogo
            size="md"
            className="gap-2 [&_img]:!h-10 [&_img]:!w-10 [&_img]:!max-h-10 sm:[&_img]:!h-11 sm:[&_img]:!w-11"
          />
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="p-2 -mr-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-mobile-nav"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 top-[var(--admin-mobile-topbar-height,4.5rem)] z-30 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="admin-mobile-nav"
        className={`fixed lg:relative top-[var(--admin-mobile-topbar-height,4.5rem)] lg:top-0 z-40 w-[min(18rem,88vw)] lg:w-64 shrink-0 border-r border-white/5 bg-[#0F172A]/95 lg:bg-[#0F172A]/80 backdrop-blur-xl flex flex-col h-[calc(100dvh-var(--admin-mobile-topbar-height,4.5rem))] lg:h-full transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="hidden lg:block p-6 border-b border-white/5">
          <Link href="/admin" className="min-w-0">
            <BrandLogo
              size="md"
              className="gap-2 [&_img]:!h-11 [&_img]:!w-11 [&_img]:!max-h-11"
            />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1">
          <div className="mb-2 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">
            Admin Dashboard
          </div>

          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition-all group max-lg:min-h-11 max-lg:py-3.5 ${
                  isActive
                    ? "bg-cyan-500 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/5 relative">
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-[calc(100%-16px)] left-4 right-4 mb-2 rounded-xl border border-white/10 bg-[#0F172A]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="p-1">
                  <button
                    type="button"
                    onClick={handleLock}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-rose-400 hover:bg-white/5 hover:text-rose-300 transition-colors rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    Lock Admin
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`w-full flex items-center gap-3 rounded-xl p-3 transition-colors ${
              menuOpen ? "bg-white/10" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white shadow-lg">
              AD
            </div>
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-sm font-bold text-slate-200 truncate w-full text-left">
                Admin
              </span>
              <span className="text-xs font-medium text-slate-500 truncate w-full text-left">
                Owner
              </span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
