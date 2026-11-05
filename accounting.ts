/**
 * CAS accounting engine - pure functions, no UI or storage.
 * Everything is derived from the journal: the three statements always agree with each other.
 */
import type { Account, AccountSubtype, JournalEntry } from "./types";
import { isDebitNormal } from "./types";
import { addDays, fiscalYearRange } from "./utils";

export interface Totals {
  debit: number;
  credit: number;
}
export interface Row {
  account: Account;
  amount: number;
}
export interface Section {
  rows: Row[];
  total: number;
}

interface Range {
  from?: string; // inclusive
  to?: string; // inclusive
  before?: string; // exclusive
}

/** Sum debits and credits per account for entries inside a date range. */
export function sumByAccount(entries: JournalEntry[], range: Range = {}): Map<string, Totals> {
  const map = new Map<string, Totals>();
  for (const e of entries) {
    if (range.from && e.date < range.from) continue;
    if (range.to && e.date > range.to) continue;
    if (range.before && e.date >= range.before) continue;
    for (const l of e.lines) {
      const t = map.get(l.accountId) ?? { debit: 0, credit: 0 };
      t.debit += l.debit;
      t.credit += l.credit;
      map.set(l.accountId, t);
    }
  }
  return map;
}

/** Balance in the account's natural direction (assets/expenses: debit - credit; others: credit - debit). */
export function signedBalance(account: Account, t?: Totals): number {
  if (!t) return 0;
  return isDebitNormal(account.type) ? t.debit - t.credit : t.credit - t.debit;
}

function section(accounts: Account[], totals: Map<string, Totals>, subtypes: AccountSubtype[]): Section {
  const rows: Row[] = accounts
    .filter((a) => subtypes.includes(a.subtype))
    .map((a) => ({ account: a, amount: signedBalance(a, totals.get(a.id)) }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));
  return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

/* ------------------------------------------------------------------ */
/* Income statement                                                    */
/* ------------------------------------------------------------------ */

export interface IncomeStatement {
  revenue: Section;
  cogs: Section;
  grossProfit: number;
  opex: Section; // operating expenses incl. depreciation
  operatingIncome: number;
  otherIncome: Section;
  otherExpense: Section;
  netIncome: number;
}

export function incomeStatement(accounts: Account[], entries: JournalEntry[], from: string, to: string): IncomeStatement {
  const totals = sumByAccount(entries, { from, to });
  const revenue = section(accounts, totals, ["operating_revenue"]);
  const cogs = section(accounts, totals, ["cogs"]);
  const opex = section(accounts, totals, ["operating_expense", "depreciation"]);
  const otherIncome = section(accounts, totals, ["other_income"]);
  const otherExpense = section(accounts, totals, ["other_expense"]);
  const grossProfit = revenue.total - cogs.total;
  const operatingIncome = grossProfit - opex.total;
  const netIncome = operatingIncome + otherIncome.total - otherExpense.total;
  return { revenue, cogs, grossProfit, opex, operatingIncome, otherIncome, otherExpense, netIncome };
}

/** Net profit (revenue - expenses) for a range, regardless of statement grouping. */
export function netIncomeFor(accounts: Account[], entries: JournalEntry[], range: Range): number {
  const totals = sumByAccount(entries, range);
  let ni = 0;
  for (const a of accounts) {
    if (a.type === "revenue") ni += signedBalance(a, totals.get(a.id));
    else if (a.type === "expense") ni -= signedBalance(a, totals.get(a.id));
  }
  return ni;
}

/* ------------------------------------------------------------------ */
/* Balance sheet                                                       */
/* ------------------------------------------------------------------ */

export interface BalanceSheet {
  currentAssets: Section;
  nonCurrentAssets: Section;
  totalAssets: number;
  currentLiabilities: Section;
  longTermLiabilities: Section;
  totalLiabilities: number;
  equity: Section; // equity accounts (capital, drawings, retained earnings account)
  priorEarnings: number; // profit of earlier fiscal years not yet closed to equity
  currentEarnings: number; // profit of the current fiscal year to date
  totalEquity: number;
  difference: number; // assets - (liabilities + equity); must be 0
}

export function balanceSheet(accounts: Account[], entries: JournalEntry[], asOf: string, fiscalStartMonth = 1): BalanceSheet {
  const totals = sumByAccount(entries, { to: asOf });
  const currentAssets = section(accounts, totals, ["cash", "current_asset"]);
  const nonCurrentAssets = section(accounts, totals, ["fixed_asset"]);
  const currentLiabilities = section(accounts, totals, ["current_liability"]);
  const longTermLiabilities = section(accounts, totals, ["long_term_liability"]);
  const equity = section(accounts, totals, ["equity"]);

  const fy = fiscalYearRange(fiscalStartMonth, asOf);
  const priorEarnings = netIncomeFor(accounts, entries, { before: fy.from });
  const currentEarnings = netIncomeFor(accounts, entries, { from: fy.from, to: asOf });

  const totalAssets = currentAssets.total + nonCurrentAssets.total;
  const totalLiabilities = currentLiabilities.total + longTermLiabilities.total;
  const totalEquity = equity.total + priorEarnings + currentEarnings;
  return {
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    currentLiabilities,
    longTermLiabilities,
    totalLiabilities,
    equity,
    priorEarnings,
    currentEarnings,
    totalEquity,
    difference: totalAssets - (totalLiabilities + totalEquity),
  };
}

/* ------------------------------------------------------------------ */
/* Cash flow statement (indirect method)                               */
/* ------------------------------------------------------------------ */

export interface CashFlowStatement {
  netIncome: number;
  depreciation: number;
  workingCapital: Row[]; // changes in current assets / current liabilities
  operating: number;
  investing: number;
  financing: Row[];
  financingTotal: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  difference: number; // closingCash - openingCash - netChange; must be 0
}

export function cashFlow(accounts: Account[], entries: JournalEntry[], from: string, to: string): CashFlowStatement {
  const opening = sumByAccount(entries, { before: from });
  const closing = sumByAccount(entries, { to });
  const delta = (a: Account) => signedBalance(a, closing.get(a.id)) - signedBalance(a, opening.get(a.id));
  const byCode = (a: Row, b: Row) => a.account.code.localeCompare(b.account.code);

  const netIncome = netIncomeFor(accounts, entries, { from, to });
  const periodTotals = sumByAccount(entries, { from, to });
  const depreciation = accounts
    .filter((a) => a.subtype === "depreciation")
    .reduce((s, a) => s + signedBalance(a, periodTotals.get(a.id)), 0);

  const workingCapital: Row[] = [];
  for (const a of accounts) {
    if (a.subtype === "current_asset") workingCapital.push({ account: a, amount: -delta(a) });
    if (a.subtype === "current_liability") workingCapital.push({ account: a, amount: delta(a) });
  }
  const wc = workingCapital.filter((r) => r.amount !== 0).sort(byCode);

  const operating = netIncome + depreciation + wc.reduce((s, r) => s + r.amount, 0);

  // Net change in fixed assets already includes depreciation (accumulated depreciation),
  // so purchases = change in net fixed assets + depreciation charge.
  const fixedDelta = accounts.filter((a) => a.subtype === "fixed_asset").reduce((s, a) => s + delta(a), 0);
  const investing = -(fixedDelta + depreciation);

  const financing: Row[] = accounts
    .filter((a) => a.subtype === "long_term_liability" || a.subtype === "equity")
    .map((a) => ({ account: a, amount: delta(a) }))
    .filter((r) => r.amount !== 0)
    .sort(byCode);
  const financingTotal = financing.reduce((s, r) => s + r.amount, 0);

  const cashAccounts = accounts.filter((a) => a.subtype === "cash");
  const openingCash = cashAccounts.reduce((s, a) => s + signedBalance(a, opening.get(a.id)), 0);
  const closingCash = cashAccounts.reduce((s, a) => s + signedBalance(a, closing.get(a.id)), 0);
  const netChange = operating + investing + financingTotal;

  return {
    netIncome,
    depreciation,
    workingCapital: wc,
    operating,
    investing,
    financing,
    financingTotal,
    netChange,
    openingCash,
    closingCash,
    difference: closingCash - openingCash - netChange,
  };
}

/* ------------------------------------------------------------------ */
/* Trial balance & ledger                                              */
/* ------------------------------------------------------------------ */

export interface TrialRow {
  account: Account;
  debit: number;
  credit: number;
}

export function trialBalance(accounts: Account[], entries: JournalEntry[], asOf: string) {
  const totals = sumByAccount(entries, { to: asOf });
  const rows: TrialRow[] = [];
  for (const a of accounts) {
    const t = totals.get(a.id);
    if (!t) continue;
    const net = t.debit - t.credit;
    if (net === 0 && t.debit === 0) continue;
    rows.push({ account: a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
  }
  rows.sort((a, b) => a.account.code.localeCompare(b.account.code));
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, debit, credit, difference: debit - credit };
}

export interface LedgerLine {
  entry: JournalEntry;
  debit: number;
  credit: number;
  balance: number; // running balance in the account's natural direction
}

export function ledger(account: Account, entries: JournalEntry[], from: string, to: string) {
  const openingTotals = sumByAccount(entries, { before: from }).get(account.id);
  const opening = signedBalance(account, openingTotals);
  let balance = opening;
  const lines: LedgerLine[] = [];
  const sorted = [...entries].sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
  for (const e of sorted) {
    if (e.date < from || e.date > to) continue;
    let d = 0;
    let c = 0;
    for (const l of e.lines) if (l.accountId === account.id) (d += l.debit), (c += l.credit);
    if (d === 0 && c === 0) continue;
    balance += isDebitNormal(account.type) ? d - c : c - d;
    lines.push({ entry: e, debit: d, credit: c, balance });
  }
  return { opening, lines, closing: balance };
}

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

export const entryTotal = (e: Pick<JournalEntry, "lines">) => e.lines.reduce((s, l) => s + l.debit, 0);

/** Returns an error message, or null if the entry is valid. */
export function validateEntry(
  e: Pick<JournalEntry, "date" | "lines">,
  accountIds: Set<string>
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return "Please choose a valid date.";
  if (e.lines.length < 2) return "An entry needs at least two lines (a debit and a credit).";
  let d = 0;
  let c = 0;
  for (const l of e.lines) {
    if (!l.accountId || !accountIds.has(l.accountId)) return "Every line needs an account.";
    if (!Number.isFinite(l.debit) || !Number.isFinite(l.credit) || l.debit < 0 || l.credit < 0)
      return "Amounts must be positive numbers.";
    if (l.debit > 0 && l.credit > 0) return "A line cannot have both a debit and a credit.";
    if (l.debit === 0 && l.credit === 0) return "Remove empty lines or enter an amount on each line.";
    d += l.debit;
    c += l.credit;
  }
  if (d !== c) return "Total debits and credits must be equal.";
  if (d === 0) return "The entry amount must be greater than zero.";
  return null;
}

export function nextReference(entries: JournalEntry[], prefix = "JV"): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const e of entries) {
    const m = re.exec(e.reference);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

/** Revenue and expense totals per month, for charts. `months` are first-of-month ISO dates. */
export function monthlySeries(accounts: Account[], entries: JournalEntry[], months: string[]) {
  return months.map((m) => {
    const next = addDays(m, 32).slice(0, 8) + "01";
    const to = addDays(next, -1);
    const totals = sumByAccount(entries, { from: m, to });
    let revenue = 0;
    let expense = 0;
    for (const a of accounts) {
      if (a.type === "revenue") revenue += signedBalance(a, totals.get(a.id));
      if (a.type === "expense") expense += signedBalance(a, totals.get(a.id));
    }
    return { month: m, revenue, expense };
  });
}

export const REF_PREFIX: Record<JournalEntry["kind"], string> = {
  journal: "JV",
  money_in: "RC",
  money_out: "PV",
  transfer: "TR",
  credit_sale: "SI",
  credit_purchase: "PI",
};
