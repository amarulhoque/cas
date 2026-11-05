import assert from "node:assert/strict";
import { balanceSheet, cashFlow, incomeStatement, trialBalance, validateEntry, ledger } from "../lib/accounting";
import { buildDemoCompany } from "../lib/demo";
import { buildChartOfAccounts } from "../lib/templates";
import { fiscalYearRange, periodRange, toCents, today, addDays } from "../lib/utils";
import type { BusinessType } from "../lib/types";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("  ✓", name);
};

const c = buildDemoCompany();
const t = today();

test("every business template has unique codes and a cash account", () => {
  const types: BusinessType[] = ["general", "retail", "service", "restaurant", "manufacturing", "property", "nonprofit"];
  for (const bt of types) {
    const accs = buildChartOfAccounts(bt);
    assert.equal(new Set(accs.map((a) => a.code)).size, accs.length, bt + " duplicate codes");
    assert.ok(accs.some((a) => a.subtype === "cash"), bt + " lacks cash account");
    assert.ok(accs.some((a) => a.subtype === "operating_revenue"), bt + " lacks revenue");
  }
});

test("all demo entries are balanced and valid", () => {
  const ids = new Set(c.accounts.map((a) => a.id));
  for (const e of c.entries) assert.equal(validateEntry(e, ids), null, e.description);
});

test("trial balance debits equal credits", () => {
  const tb = trialBalance(c.accounts, c.entries, t);
  assert.equal(tb.difference, 0);
  assert.ok(tb.debit > 0);
});

test("balance sheet balances (assets = liabilities + equity) at every month end", () => {
  for (let i = 0; i < 8; i++) {
    const d = addDays(t, -30 * i);
    const bs = balanceSheet(c.accounts, c.entries, d, 1);
    assert.equal(bs.difference, 0, "unbalanced at " + d);
  }
});

test("balance sheet balances for non-January fiscal years too", () => {
  for (const m of [4, 7, 10]) {
    const bs = balanceSheet(c.accounts, c.entries, t, m);
    assert.equal(bs.difference, 0, "unbalanced for FY start " + m);
  }
});

test("cash flow reconciles to the change in cash for many periods", () => {
  const cuts = [0, 30, 60, 90, 120, 150, 200].map((n) => addDays(t, -n));
  for (const from of cuts)
    for (const to of cuts) {
      if (to < from) continue;
      const cf = cashFlow(c.accounts, c.entries, from, to);
      assert.equal(cf.difference, 0, `cash flow off for ${from}..${to}`);
    }
});

test("net income on the cash flow equals the income statement", () => {
  const { from, to } = { from: addDays(t, -90), to: t };
  const is = incomeStatement(c.accounts, c.entries, from, to);
  const cf = cashFlow(c.accounts, c.entries, from, to);
  assert.equal(cf.netIncome, is.netIncome);
});

test("income statement arithmetic", () => {
  const is = incomeStatement(c.accounts, c.entries, "1900-01-01", "2999-12-31");
  assert.equal(is.grossProfit, is.revenue.total - is.cogs.total);
  assert.equal(is.operatingIncome, is.grossProfit - is.opex.total);
  assert.equal(is.netIncome, is.operatingIncome + is.otherIncome.total - is.otherExpense.total);
});

test("no cash account is negative at the end of the demo", () => {
  const bs = balanceSheet(c.accounts, c.entries, t, 1);
  for (const r of bs.currentAssets.rows) if (r.account.subtype === "cash") assert.ok(r.amount >= 0, r.account.name);
});

test("ledger running balance ends at the trial balance figure", () => {
  const bank = c.accounts.find((a) => a.code === "1010")!;
  const l = ledger(bank, c.entries, "1900-01-01", "2999-12-31");
  const tb = trialBalance(c.accounts, c.entries, t).rows.find((r) => r.account.id === bank.id)!;
  assert.equal(l.closing, tb.debit - tb.credit);
});

test("validation rejects unbalanced, one-sided and empty entries", () => {
  const ids = new Set(c.accounts.map((a) => a.id));
  const a = c.accounts[0].id;
  const b = c.accounts[1].id;
  assert.ok(validateEntry({ date: t, lines: [{ accountId: a, debit: 100, credit: 0 }, { accountId: b, debit: 0, credit: 99 }] }, ids));
  assert.ok(validateEntry({ date: t, lines: [{ accountId: a, debit: 100, credit: 0 }] }, ids));
  assert.ok(validateEntry({ date: "", lines: [{ accountId: a, debit: 100, credit: 0 }, { accountId: b, debit: 0, credit: 100 }] }, ids));
  assert.ok(validateEntry({ date: t, lines: [{ accountId: a, debit: 100, credit: 100 }, { accountId: b, debit: 0, credit: 0 }] }, ids));
  assert.equal(validateEntry({ date: t, lines: [{ accountId: a, debit: 100, credit: 0 }, { accountId: b, debit: 0, credit: 100 }] }, ids), null);
});

test("money parsing avoids floating-point drift", () => {
  assert.equal(toCents("1,234.50"), 123450);
  assert.equal(toCents("0.1") + toCents("0.2"), 30);
  assert.equal(toCents("19.99"), 1999);
  assert.ok(Number.isNaN(toCents("abc")));
});

test("fiscal year ranges", () => {
  assert.deepEqual(fiscalYearRange(1, "2026-11-04"), { from: "2026-01-01", to: "2026-12-31" });
  assert.deepEqual(fiscalYearRange(7, "2026-11-04"), { from: "2026-07-01", to: "2027-06-30" });
  assert.deepEqual(fiscalYearRange(7, "2026-03-04"), { from: "2025-07-01", to: "2026-06-30" });
  assert.deepEqual(periodRange("last_fy", 7, "2026-11-04"), { from: "2025-07-01", to: "2026-06-30" });
});

console.log(`\n${passed} tests passed`);
