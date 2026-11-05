import { buildChartOfAccounts } from "./templates";
import { nextReference, REF_PREFIX } from "./accounting";
import type { Company, EntryKind, JournalEntry } from "./types";
import { addMonths, startOfMonth, today, uid } from "./utils";

/** A small trading business with six months of realistic activity, so every screen has data. */
export function buildDemoCompany(): Company {
  const accounts = buildChartOfAccounts("retail");
  const id = (code: string) => {
    const a = accounts.find((x) => x.code === code);
    if (!a) throw new Error("Missing account " + code);
    return a.id;
  };
  const entries: JournalEntry[] = [];
  const now = new Date().toISOString();
  const t = today();
  const start = addMonths(startOfMonth(t), -6); // 6 full months plus the current month so far

  const add = (
    date: string,
    kind: EntryKind,
    description: string,
    debitCode: string,
    creditCode: string,
    amount: number // major units
  ) => {
    if (date > t) return; // never create future-dated demo entries
    const d = date;
    const cents = Math.round(amount * 100);
    entries.push({
      id: uid(),
      date: d,
      reference: nextReference(entries, REF_PREFIX[kind]),
      description,
      kind,
      lines: [
        { accountId: id(debitCode), debit: cents, credit: 0 },
        { accountId: id(creditCode), debit: 0, credit: cents },
      ],
      createdAt: now,
      updatedAt: now,
    });
  };

  // Opening position
  entries.push({
    id: uid(),
    date: start,
    reference: "JV-0001",
    description: "Owner's capital introduced",
    kind: "journal",
    lines: [
      { accountId: id("1010"), debit: 50000000, credit: 0 },
      { accountId: id("1000"), debit: 10000000, credit: 0 },
      { accountId: id("3000"), debit: 0, credit: 60000000 },
    ],
    createdAt: now,
    updatedAt: now,
  });
  add(start, "money_in", "Bank loan received", "1010", "2500", 200000);
  add(start, "money_out", "Shop equipment & furniture", "1500", "1010", 100000);
  add(start, "money_out", "Opening stock purchased", "1200", "1010", 100000);

  let prevCredit = 0;
  let prevPurchase = 0;
  for (let m = 0; m < 7; m++) {
    const month = addMonths(start, m);
    const day = (n: number) => month.slice(0, 8) + String(n).padStart(2, "0");
    const g = 1 + m * 0.04 + ((m * 7) % 5) * 0.01;
    const cashSales = Math.round((200000 * g) / 1000) * 1000;
    const creditSales = Math.round((100000 * g) / 1000) * 1000;
    const sales = cashSales + creditSales;
    const purchases = Math.round((sales * 0.6) / 1000) * 1000;

    add(day(3), "credit_purchase", "Stock purchased from supplier", "1200", "2000", purchases);
    if (m > 0) add(day(8), "money_out", "Supplier payment", "2000", "1010", prevPurchase);
    add(day(1), "money_out", "Shop rent", "6100", "1010", 25000);
    add(day(10), "money_in", "Cash sales - counter", "1000", "4000", cashSales / 2);
    add(day(12), "money_in", "Mobile wallet sales", "1020", "4000", cashSales / 2);
    add(day(15), "credit_sale", "Sales to corporate customers", "1100", "4000", creditSales);
    if (m > 0) add(day(20), "money_in", "Customer collections", "1010", "1100", prevCredit);
    add(day(26), "transfer", "Cash deposited to bank", "1010", "1000", cashSales / 2 - 5000);
    add(day(26), "transfer", "Wallet cash-out to bank", "1010", "1020", cashSales / 2 - 2000);
    add(day(27), "money_out", "Electricity & internet", "6200", "1010", 8000 + (m % 3) * 500);
    add(day(27), "money_out", "Advertising", "6400", "1010", 6000 + (m % 2) * 2000);
    add(day(27), "money_out", "Delivery & transport", "6500", "1010", 4000 + (m % 4) * 250);
    add(day(28), "money_out", "Staff salaries", "6000", "1010", 60000);
    add(day(28), "money_out", "Bank charges", "6800", "1010", 500);
    add(day(28), "money_out", "Loan interest", "7000", "1010", 2000);
    if (m >= 2) add(day(28), "money_out", "Loan instalment", "2500", "1010", 5000);
    add(day(28), "journal", "Cost of goods sold for the month", "5000", "1200", Math.round(sales * 0.6));
    add(day(28), "journal", "Monthly depreciation", "6900", "1510", 1500);
    add(day(29), "money_out", "Owner's drawings", "3200", "1010", 10000);

    prevCredit = creditSales;
    prevPurchase = purchases;
  }

  return {
    id: uid(),
    name: "Demo Trading Co.",
    businessType: "retail",
    currency: "BDT",
    fiscalYearStartMonth: 1,
    address: "Sample data - safe to delete",
    accounts,
    entries,
    createdAt: now,
  };
}
