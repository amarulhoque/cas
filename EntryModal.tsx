"use client";

import { useMemo, useState } from "react";
import type { Account, EntryKind, JournalEntry, JournalLine } from "@/lib/types";
import { useCAS } from "@/lib/store";
import { nextReference, REF_PREFIX } from "@/lib/accounting";
import { centsToInput, cn, fmtMoney, toCents, today, uid } from "@/lib/utils";
import { AccountSelect } from "./AccountSelect";
import { ErrorBox, Field, Modal } from "./ui";

type QuickKind = Exclude<EntryKind, "journal">;

interface Side {
  label: string;
  filter: (a: Account) => boolean;
  prefer?: (a: Account) => boolean;
}

const isCash = (a: Account) => a.subtype === "cash";
const notCash = (a: Account) => a.subtype !== "cash";

export const KIND_LABEL: Record<EntryKind, string> = {
  money_in: "Money In",
  money_out: "Money Out",
  transfer: "Transfer",
  credit_sale: "Credit Sale",
  credit_purchase: "Credit Purchase",
  journal: "Journal",
};

export const KIND_BADGE: Record<EntryKind, string> = {
  money_in: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  money_out: "bg-rose-50 text-rose-700 ring-rose-200",
  transfer: "bg-sky-50 text-sky-700 ring-sky-200",
  credit_sale: "bg-teal-50 text-teal-700 ring-teal-200",
  credit_purchase: "bg-amber-50 text-amber-700 ring-amber-200",
  journal: "bg-slate-100 text-slate-700 ring-slate-200",
};

const QUICK: Record<QuickKind, { hint: string; debit: Side; credit: Side }> = {
  money_in: {
    hint: "Money received in cash, bank or wallet - a sale, a collection from a customer, a loan, capital from the owner…",
    debit: { label: "Received into", filter: isCash },
    credit: { label: "Received for / from", filter: notCash, prefer: (a) => a.type === "revenue" },
  },
  money_out: {
    hint: "Money paid out of cash, bank or wallet - an expense, a supplier payment, a loan repayment, owner's drawings…",
    debit: { label: "Paid for", filter: notCash, prefer: (a) => a.type === "expense" },
    credit: { label: "Paid from", filter: isCash },
  },
  transfer: {
    hint: "Move money between your own cash, bank and wallet accounts.",
    debit: { label: "Transfer to", filter: isCash },
    credit: { label: "Transfer from", filter: isCash },
  },
  credit_sale: {
    hint: "A sale where the customer will pay later. Records revenue now and an amount owed to you.",
    debit: { label: "Customer owes (receivable)", filter: (a) => a.subtype === "current_asset" },
    credit: { label: "Revenue account", filter: (a) => a.type === "revenue" },
  },
  credit_purchase: {
    hint: "A purchase or bill you will pay later. Records the expense or asset now and an amount you owe.",
    debit: { label: "Expense / asset bought", filter: (a) => a.type === "expense" || a.subtype === "current_asset" || a.subtype === "fixed_asset" },
    credit: { label: "You owe (payable)", filter: (a) => a.subtype === "current_liability" },
  },
};

const TAB_ORDER: EntryKind[] = ["money_in", "money_out", "transfer", "credit_sale", "credit_purchase", "journal"];

interface JLine {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}
const blankLine = (): JLine => ({ key: uid(), accountId: "", debit: "", credit: "", memo: "" });

export function EntryModal({
  open,
  entry,
  initialKind = "money_in",
  onClose,
}: {
  open: boolean;
  entry?: JournalEntry | null;
  initialKind?: EntryKind;
  onClose: () => void;
}) {
  if (!open) return null;
  return <EntryForm entry={entry ?? null} initialKind={initialKind} onClose={onClose} />;
}

function EntryForm({ entry, initialKind, onClose }: { entry: JournalEntry | null; initialKind: EntryKind; onClose: () => void }) {
  const { company, saveEntry } = useCAS();
  const accounts = useMemo(() => company?.accounts ?? [], [company]);
  const entries = useMemo(() => company?.entries ?? [], [company]);
  const currency = company?.currency ?? "BDT";
  const editing = !!entry;

  const pick = (side: Side): string => {
    const list = accounts.filter((a) => a.active && side.filter(a)).sort((a, b) => a.code.localeCompare(b.code));
    return (side.prefer ? list.find(side.prefer) : undefined)?.id ?? list[0]?.id ?? "";
  };

  const initQuick = (k: EntryKind) =>
    k === "journal" ? { d: "", c: "" } : { d: pick(QUICK[k].debit), c: pick(QUICK[k].credit) };

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? initialKind);
  const [date, setDate] = useState(entry?.date ?? today());
  const [reference, setReference] = useState(entry?.reference ?? nextReference(entries, REF_PREFIX[entry?.kind ?? initialKind]));
  const [refTouched, setRefTouched] = useState(false);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [error, setError] = useState("");

  const dl = entry?.lines.find((l) => l.debit > 0);
  const cl = entry?.lines.find((l) => l.credit > 0);
  const [debitId, setDebitId] = useState(entry && entry.kind !== "journal" ? (dl?.accountId ?? "") : initQuick(initialKind).d);
  const [creditId, setCreditId] = useState(entry && entry.kind !== "journal" ? (cl?.accountId ?? "") : initQuick(initialKind).c);
  const [amount, setAmount] = useState(entry && entry.kind !== "journal" ? centsToInput(dl?.debit ?? 0) : "");

  const [jlines, setJlines] = useState<JLine[]>(
    entry && entry.kind === "journal"
      ? entry.lines.map((l) => ({
          key: uid(),
          accountId: l.accountId,
          debit: centsToInput(l.debit),
          credit: centsToInput(l.credit),
          memo: l.memo ?? "",
        }))
      : [blankLine(), blankLine()]
  );

  const switchKind = (k: EntryKind) => {
    setKind(k);
    setError("");
    if (!refTouched) setReference(nextReference(entries, REF_PREFIX[k]));
    const q = initQuick(k);
    setDebitId(q.d);
    setCreditId(q.c);
  };

  const parse = (s: string) => (s.trim() === "" ? 0 : toCents(s));
  const totals = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const l of jlines) {
      const dv = parse(l.debit);
      const cv = parse(l.credit);
      if (Number.isFinite(dv)) d += dv;
      if (Number.isFinite(cv)) c += cv;
    }
    return { d, c, diff: d - c };
  }, [jlines]);

  const updateLine = (key: string, patch: Partial<JLine>) =>
    setJlines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = () => {
    setError("");
    let lines: JournalLine[];
    if (kind === "journal") {
      lines = [];
      for (const l of jlines) {
        if (!l.accountId && !l.debit.trim() && !l.credit.trim()) continue; // ignore fully blank lines
        const d = parse(l.debit);
        const c = parse(l.credit);
        if (Number.isNaN(d) || Number.isNaN(c)) return setError("Amounts must be numbers, for example 1500 or 1,500.50.");
        lines.push({ accountId: l.accountId, debit: d, credit: c, memo: l.memo.trim() || undefined });
      }
    } else {
      const cents = toCents(amount);
      if (!(cents > 0)) return setError("Enter an amount greater than zero.");
      if (!debitId || !creditId) return setError("Please choose both accounts.");
      if (debitId === creditId) return setError("The two accounts must be different.");
      lines = [
        { accountId: debitId, debit: cents, credit: 0 },
        { accountId: creditId, debit: 0, credit: cents },
      ];
    }
    const e: JournalEntry = {
      id: entry?.id ?? uid(),
      date,
      reference: reference.trim() || nextReference(entries, REF_PREFIX[kind]),
      description,
      kind,
      lines,
      createdAt: entry?.createdAt ?? "",
      updatedAt: "",
    };
    const err = saveEntry(e);
    if (err) return setError(err);
    onClose();
  };

  const q = kind !== "journal" ? QUICK[kind] : null;
  const title = editing ? `Edit ${KIND_LABEL[kind].toLowerCase()} entry` : "New transaction";

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size={kind === "journal" ? "xl" : "md"}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit}>
            {editing ? "Save changes" : "Save transaction"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!editing && (
          <div className="-mx-1 flex flex-wrap gap-1.5">
            {TAB_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => switchKind(k)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
                  kind === k ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                )}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {q ? q.hint : "Full double-entry journal: use any accounts, and make total debits equal total credits. Good for adjustments, depreciation, accruals and opening balances."}
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Reference">
            <input
              className="input"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setRefTouched(true);
              }}
            />
          </Field>
          {q && (
            <Field label={`Amount (${currency})`}>
              <input className="input" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </Field>
          )}
        </div>

        {q ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={q.debit.label}>
              <AccountSelect accounts={accounts} value={debitId} onChange={setDebitId} filter={q.debit.filter} />
            </Field>
            <Field label={q.credit.label}>
              <AccountSelect accounts={accounts} value={creditId} onChange={setCreditId} filter={q.credit.filter} />
            </Field>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th w-[40%]">Account</th>
                  <th className="th">Memo</th>
                  <th className="th w-32 text-right">Debit</th>
                  <th className="th w-32 text-right">Credit</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {jlines.map((l) => (
                  <tr key={l.key}>
                    <td className="p-1.5">
                      <AccountSelect accounts={accounts} value={l.accountId} onChange={(id) => updateLine(l.key, { accountId: id })} />
                    </td>
                    <td className="p-1.5">
                      <input className="input" value={l.memo} onChange={(e) => updateLine(l.key, { memo: e.target.value })} />
                    </td>
                    <td className="p-1.5">
                      <input
                        className="input text-right"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={l.debit}
                        onChange={(e) => updateLine(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        className="input text-right"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={l.credit}
                        onChange={(e) => updateLine(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
                      />
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        aria-label="Remove line"
                        disabled={jlines.length <= 2}
                        onClick={() => setJlines((ls) => ls.filter((x) => x.key !== l.key))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="p-2" colSpan={2}>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setJlines((ls) => [...ls, blankLine()])}>
                      + Add line
                    </button>
                  </td>
                  <td className="td num font-semibold">{fmtMoney(totals.d, currency, { symbol: false })}</td>
                  <td className="td num font-semibold">{fmtMoney(totals.c, currency, { symbol: false })}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={5} className="px-3 pb-2 text-right text-xs">
                    {totals.d === 0 && totals.c === 0 ? (
                      <span className="text-slate-400">Enter amounts - total debits must equal total credits.</span>
                    ) : totals.diff === 0 ? (
                      <span className="font-medium text-emerald-600">✓ Balanced</span>
                    ) : (
                      <span className="font-medium text-amber-600">
                        Out of balance by {fmtMoney(Math.abs(totals.diff), currency)} ({totals.diff > 0 ? "more debit" : "more credit"})
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <Field label="Description / notes">
          <input className="input" placeholder="e.g. Rent for November" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <ErrorBox>{error}</ErrorBox>
      </div>
    </Modal>
  );
}
