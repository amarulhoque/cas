"use client";

import { useMemo, useState } from "react";
import { useCAS } from "@/lib/store";
import { signedBalance, sumByAccount } from "@/lib/accounting";
import type { Account, AccountSubtype, AccountType } from "@/lib/types";
import { ACCOUNT_TYPE_LABEL, SUBTYPE_LABEL, SUBTYPES_BY_TYPE } from "@/lib/types";
import { cn, fmtMoney, typeColor, uid } from "@/lib/utils";
import { Badge, ConfirmDialog, EmptyState, ErrorBox, Field, Modal, PageHeader } from "@/components/ui";

const TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];
const CODE_BASE: Record<AccountType, number> = { asset: 1000, liability: 2000, equity: 3000, revenue: 4000, expense: 6000 };

function suggestCode(accounts: Account[], type: AccountType): string {
  const nums = accounts.filter((a) => a.type === type).map((a) => parseInt(a.code, 10)).filter((n) => !Number.isNaN(n));
  return String(nums.length ? Math.max(...nums) + 10 : CODE_BASE[type]);
}

function AccountForm({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { company, saveAccount } = useCAS();
  const accounts = company?.accounts ?? [];
  const [type, setType] = useState<AccountType>(account?.type ?? "expense");
  const [subtype, setSubtype] = useState<AccountSubtype>(account?.subtype ?? "operating_expense");
  const [code, setCode] = useState(account?.code ?? suggestCode(accounts, "expense"));
  const [codeTouched, setCodeTouched] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [description, setDescription] = useState(account?.description ?? "");
  const [active, setActive] = useState(account?.active ?? true);
  const [error, setError] = useState("");

  const changeType = (t: AccountType) => {
    setType(t);
    setSubtype(SUBTYPES_BY_TYPE[t][0]);
    if (!account && !codeTouched) setCode(suggestCode(accounts, t));
  };

  const submit = () => {
    const err = saveAccount({ id: account?.id ?? uid(), code, name, type, subtype, description, active });
    if (err) return setError(err);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={account ? "Edit account" : "New account"}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit}>
            {account ? "Save changes" : "Add account"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Code">
            <input className="input" value={code} onChange={(e) => { setCode(e.target.value); setCodeTouched(true); }} />
          </Field>
          <Field label="Account name" className="sm:col-span-2">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Delivery Expense" autoFocus />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select className="input" value={type} onChange={(e) => changeType(e.target.value as AccountType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category" hint="Decides where it appears on the statements.">
            <select className="input" value={subtype} onChange={(e) => setSubtype(e.target.value as AccountSubtype)}>
              {SUBTYPES_BY_TYPE[type].map((s) => (
                <option key={s} value={s}>
                  {SUBTYPE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description (optional)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (inactive accounts are hidden from new entries but kept in reports)
        </label>
        {account && (
          <p className="text-xs text-amber-600">Changing the type or category of an account that already has transactions moves it on the financial statements.</p>
        )}
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Modal>
  );
}

export default function AccountsPage() {
  const { company, saveAccount, deleteAccount } = useCAS();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const balances = useMemo(() => (company ? sumByAccount(company.entries) : new Map()), [company]);
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of company?.entries ?? []) for (const l of e.lines) m.set(l.accountId, (m.get(l.accountId) ?? 0) + 1);
    return m;
  }, [company]);

  if (!company) return null;
  const cur = company.currency;
  const s = q.trim().toLowerCase();
  const list = company.accounts.filter(
    (a) => (showInactive || a.active) && (!s || a.name.toLowerCase().includes(s) || a.code.toLowerCase().includes(s))
  );

  return (
    <>
      <PageHeader
        title="Chart of Accounts"
        subtitle="The categories your money is tracked under. Rename, add or deactivate them to fit your business."
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + New account
          </button>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <input className="input max-w-xs" placeholder="Search code or name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <span className="ml-auto text-xs text-slate-400">{list.length} accounts</span>
      </div>

      {list.length === 0 && (
        <div className="card">
          <EmptyState title="No accounts found" text="Try a different search." />
        </div>
      )}

      <div className="space-y-5">
        {TYPES.map((t) => {
          const group = list.filter((a) => a.type === t).sort((a, b) => a.code.localeCompare(b.code));
          if (group.length === 0) return null;
          return (
            <section key={t} className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2.5">
                <Badge className={typeColor[t]}>{ACCOUNT_TYPE_LABEL[t]}</Badge>
                <span className="text-xs text-slate-400">{group.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <tbody className="divide-y">
                    {group.map((a) => (
                      <tr key={a.id} className={cn("hover:bg-slate-50/70", !a.active && "opacity-60")}>
                        <td className="td w-20 font-mono text-xs text-slate-500">{a.code}</td>
                        <td className="td font-medium text-slate-800">
                          {a.name}
                          {!a.active && <span className="ml-2 text-xs font-normal text-slate-400">inactive</span>}
                        </td>
                        <td className="td text-xs text-slate-500">{SUBTYPE_LABEL[a.subtype]}</td>
                        <td className="td num whitespace-nowrap font-medium">{fmtMoney(signedBalance(a, balances.get(a.id)), cur)}</td>
                        <td className="td whitespace-nowrap text-right">
                          <button className="btn-ghost btn-sm" onClick={() => setEditing(a)}>
                            Edit
                          </button>
                          <button
                            className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setDeleteError("");
                              setDeleting(a);
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {(creating || editing) && <AccountForm account={editing} onClose={() => { setCreating(false); setEditing(null); }} />}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete account?"
        confirmLabel={deleting && (usage.get(deleting.id) ?? 0) > 0 ? (deleting.active ? "Deactivate instead" : "Close") : "Delete"}
        danger={!(deleting && (usage.get(deleting.id) ?? 0) > 0)}
        message={
          deleting && (
            <div className="space-y-2">
              <p>
                <b>
                  {deleting.code} · {deleting.name}
                </b>
              </p>
              {(usage.get(deleting.id) ?? 0) > 0 ? (
                <p>
                  This account is used in {usage.get(deleting.id)} transaction line(s), so it can&apos;t be deleted without breaking your history. You can deactivate it instead - it will be hidden from new entries but stay in reports.
                </p>
              ) : (
                <p>This account has no transactions and will be permanently removed.</p>
              )}
              <ErrorBox>{deleteError}</ErrorBox>
            </div>
          )
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          if ((usage.get(deleting.id) ?? 0) > 0) {
            if (deleting.active) saveAccount({ ...deleting, active: false });
            setDeleting(null);
            return;
          }
          const err = deleteAccount(deleting.id);
          if (err) return setDeleteError(err);
          setDeleting(null);
        }}
      />
    </>
  );
}
