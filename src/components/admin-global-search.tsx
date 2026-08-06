"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

type ClientHit = { email: string; name?: string };

export function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientHit[]>([]);
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientHit[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/clients", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setClients(d.clients || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }
    setResults(
      clients
        .filter(
          (c) =>
            c.email.toLowerCase().includes(q) ||
            (c.name || "").toLowerCase().includes(q),
        )
        .slice(0, 8),
    );
  }, [query, clients]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients..."
          className="w-full rounded-xl border border-white/10 bg-[#080810]/80 pl-10 pr-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500/50"
        />
      </div>
      {open && query.trim() && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl overflow-hidden z-50">
          {results.map((c) => (
            <Link
              key={c.email}
              href={`/admin/clients/${encodeURIComponent(c.email)}`}
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
              className="block px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0"
            >
              <p className="text-sm font-semibold text-slate-200 truncate">{c.name || c.email}</p>
              <p className="text-xs text-slate-500 truncate">{c.email}</p>
            </Link>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-sm text-slate-500 z-50">
          No clients found
        </div>
      )}
    </div>
  );
}
