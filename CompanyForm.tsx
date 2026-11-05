"use client";

import { useState } from "react";
import type { BusinessType } from "@/lib/types";
import { BUSINESS_TYPE_LABEL } from "@/lib/types";
import type { NewCompanyInput } from "@/lib/store";
import { CURRENCIES } from "@/lib/utils";
import { Field } from "./ui";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const TYPE_HINT: Record<BusinessType, string> = {
  general: "A flexible chart of accounts with inventory and cost of goods sold. A good start for any business.",
  retail: "Merchandise inventory, cost of goods sold, freight and packaging.",
  service: "Service revenue and direct labour - no inventory.",
  restaurant: "Food and beverage sales, ingredient cost and catering income.",
  manufacturing: "Raw materials, work in progress, finished goods and factory overheads.",
  property: "Rental income, tenant receivables, security deposits, land and buildings.",
  nonprofit: "Donations, grants and program costs; equity is shown as fund balance.",
};

export function CompanyForm({ onSubmit, submitLabel = "Create company" }: { onSubmit: (c: NewCompanyInput) => void; submitLabel?: string }) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("general");
  const [currency, setCurrency] = useState("BDT");
  const [fy, setFy] = useState(1);
  const [address, setAddress] = useState("");
  const [err, setErr] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setErr("Please enter the business name.");
        onSubmit({ name, businessType, currency, fiscalYearStartMonth: fy, address });
      }}
    >
      <Field label="Business name">
        <input className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="e.g. Nagar Style" autoFocus />
      </Field>
      <Field label="Type of business" hint={TYPE_HINT[businessType]}>
        <select className="input" value={businessType} onChange={(e) => setBusinessType(e.target.value as BusinessType)}>
          {(Object.keys(BUSINESS_TYPE_LABEL) as BusinessType[]).map((t) => (
            <option key={t} value={t}>
              {BUSINESS_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency">
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Financial year starts in">
          <select className="input" value={fy} onChange={(e) => setFy(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Address (optional)">
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button type="submit" className="btn-primary w-full">
        {submitLabel}
      </button>
      <p className="text-xs text-slate-400">The chart of accounts is created for you and can be fully changed later (add, edit, deactivate accounts).</p>
    </form>
  );
}
