"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { useCAS } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CompanyForm } from "./CompanyForm";

const NAV = [
  { href: "/", label: "Dashboard", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
  { href: "/transactions", label: "Transactions", icon: "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" },
  { href: "/accounts", label: "Chart of Accounts", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/reports", label: "Reports", icon: "M4 20V10m6 10V4m6 16v-7m4 7H2" },
  { href: "/settings", label: "Settings", icon: "M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6" },
];

function Logo({ className, large }: { className?: string; large?: boolean }) {
  return (
    <div className={cn("flex items-center", large ? "gap-4" : "gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="CAS logo"
        width={large ? 80 : 40}
        height={large ? 80 : 40}
        priority
        className={cn("shrink-0 rounded-full shadow-sm", large ? "h-20 w-20" : "h-10 w-10")}
      />
      <div className="leading-tight">
        <div className={cn("font-semibold text-slate-900", large ? "text-lg" : "text-sm")}>CAS</div>
        <div className={cn("text-slate-500", large ? "text-xs" : "text-[11px]")}>Common Accounting System</div>
      </div>
    </div>
  );
}

function Welcome() {
  const { createCompany, addDemoCompany } = useCAS();
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-4 py-10 md:flex-row md:items-center">
      <div className="md:w-1/2">
        <Logo large />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">Accounting for any business, in one place.</h1>
        <p className="mt-3 text-slate-600">
          Record money in and out, and CAS keeps the books for you: Income Statement, Balance Sheet and Cash Flow Statement are always up to date and always agree with each other.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-slate-600">
          <li>✓ Ready-made chart of accounts for retail, services, restaurants, manufacturing, property and non-profits</li>
          <li>✓ Simple entry for everyday work, full double-entry journal when you need it</li>
          <li>✓ Add, edit and delete anything. Export reports to CSV or print them</li>
        </ul>
        <button onClick={addDemoCompany} className="btn-secondary mt-6">
          Explore with demo data
        </button>
      </div>
      <div className="card p-6 md:w-1/2">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Set up your business</h2>
        <CompanyForm onSubmit={createCompany} />
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { ready, company, state, selectCompany } = useCAS();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading CAS…</div>;
  if (!company) return <Welcome />;

  const nav = (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={n.icon} />
            </svg>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3 lg:hidden">
        <Logo />
        <button className="btn-secondary btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">
          {open ? "Close" : "Menu"}
        </button>
      </header>

      <aside
        className={cn(
          "no-print z-20 w-full shrink-0 border-r bg-white px-4 py-5 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64",
          open ? "block" : "hidden"
        )}
      >
        <Logo className="mb-6 hidden lg:flex" />
        <div className="mb-5">
          <label className="label" htmlFor="company-switch">
            Business
          </label>
          <select id="company-switch" className="input" value={company.id} onChange={(e) => selectCompany(e.target.value)}>
            {state.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Link href="/settings#companies" onClick={() => setOpen(false)} className="mt-1.5 inline-block text-xs text-brand-700 hover:underline">
            + Add another business
          </Link>
        </div>
        {nav}
        <p className="mt-8 hidden text-[11px] leading-snug text-slate-400 lg:block">
          Data is saved in this browser. Use Settings → Backup to export a copy regularly.
        </p>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
