"use client";

import type { Account, AccountType } from "@/lib/types";
import { ACCOUNT_TYPE_LABEL } from "@/lib/types";

const ORDER: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];

export function AccountSelect({
  accounts,
  value,
  onChange,
  filter,
  placeholder = "Select account…",
  className = "input",
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  filter?: (a: Account) => boolean;
  placeholder?: string;
  className?: string;
}) {
  // Keep the currently selected account visible even if it is now inactive / filtered out (e.g. when editing old entries).
  const visible = accounts.filter((a) => a.id === value || (a.active && (!filter || filter(a))));
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {ORDER.map((t) => {
        const group = visible.filter((a) => a.type === t).sort((a, b) => a.code.localeCompare(b.code));
        if (group.length === 0) return null;
        return (
          <optgroup key={t} label={ACCOUNT_TYPE_LABEL[t]}>
            {group.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
                {a.active ? "" : " (inactive)"}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
