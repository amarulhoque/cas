import type { BalanceSheet, CashFlowStatement, IncomeStatement, Row } from "./accounting";

/** A single printable line of a financial statement. The same list drives the on-screen table and the CSV export. */
export interface ReportLine {
  kind: "heading" | "item" | "subtotal" | "total" | "grand" | "note";
  label: string;
  amount?: number;
}

const items = (rows: Row[]): ReportLine[] => rows.map((r) => ({ kind: "item", label: `${r.account.code}  ${r.account.name}`, amount: r.amount }));

export function incomeStatementLines(is: IncomeStatement): ReportLine[] {
  const L: ReportLine[] = [];
  L.push({ kind: "heading", label: "Revenue" }, ...items(is.revenue.rows), { kind: "subtotal", label: "Total revenue", amount: is.revenue.total });
  if (is.cogs.rows.length) {
    L.push({ kind: "heading", label: "Cost of goods sold / direct costs" }, ...items(is.cogs.rows), { kind: "subtotal", label: "Total direct costs", amount: is.cogs.total });
  }
  L.push({ kind: "total", label: "Gross profit", amount: is.grossProfit });
  L.push({ kind: "heading", label: "Operating expenses" }, ...items(is.opex.rows), { kind: "subtotal", label: "Total operating expenses", amount: is.opex.total });
  L.push({ kind: "total", label: "Operating profit", amount: is.operatingIncome });
  if (is.otherIncome.rows.length) {
    L.push({ kind: "heading", label: "Other income" }, ...items(is.otherIncome.rows), { kind: "subtotal", label: "Total other income", amount: is.otherIncome.total });
  }
  if (is.otherExpense.rows.length) {
    L.push({ kind: "heading", label: "Other expenses (interest, tax, misc.)" }, ...items(is.otherExpense.rows), { kind: "subtotal", label: "Total other expenses", amount: is.otherExpense.total });
  }
  L.push({ kind: "grand", label: "Net profit / (loss)", amount: is.netIncome });
  return L;
}

export function balanceSheetLines(bs: BalanceSheet): ReportLine[] {
  const L: ReportLine[] = [];
  L.push({ kind: "heading", label: "ASSETS" });
  L.push({ kind: "heading", label: "Current assets" }, ...items(bs.currentAssets.rows), { kind: "subtotal", label: "Total current assets", amount: bs.currentAssets.total });
  if (bs.nonCurrentAssets.rows.length)
    L.push({ kind: "heading", label: "Non-current assets" }, ...items(bs.nonCurrentAssets.rows), { kind: "subtotal", label: "Total non-current assets", amount: bs.nonCurrentAssets.total });
  L.push({ kind: "grand", label: "TOTAL ASSETS", amount: bs.totalAssets });

  L.push({ kind: "heading", label: "LIABILITIES" });
  if (bs.currentLiabilities.rows.length)
    L.push({ kind: "heading", label: "Current liabilities" }, ...items(bs.currentLiabilities.rows), { kind: "subtotal", label: "Total current liabilities", amount: bs.currentLiabilities.total });
  if (bs.longTermLiabilities.rows.length)
    L.push({ kind: "heading", label: "Long-term liabilities" }, ...items(bs.longTermLiabilities.rows), { kind: "subtotal", label: "Total long-term liabilities", amount: bs.longTermLiabilities.total });
  L.push({ kind: "total", label: "Total liabilities", amount: bs.totalLiabilities });

  L.push({ kind: "heading", label: "EQUITY" }, ...items(bs.equity.rows));
  if (bs.priorEarnings !== 0) L.push({ kind: "item", label: "Retained profit (prior years)", amount: bs.priorEarnings });
  L.push({ kind: "item", label: "Net profit / (loss) - current year", amount: bs.currentEarnings });
  L.push({ kind: "total", label: "Total equity", amount: bs.totalEquity });
  L.push({ kind: "grand", label: "TOTAL LIABILITIES & EQUITY", amount: bs.totalLiabilities + bs.totalEquity });
  return L;
}

export function cashFlowLines(cf: CashFlowStatement): ReportLine[] {
  const L: ReportLine[] = [];
  L.push({ kind: "heading", label: "Cash flow from operating activities" });
  L.push({ kind: "item", label: "Net profit / (loss)", amount: cf.netIncome });
  if (cf.depreciation !== 0) L.push({ kind: "item", label: "Add back: depreciation (non-cash)", amount: cf.depreciation });
  for (const r of cf.workingCapital) L.push({ kind: "item", label: `Change in ${r.account.name}`, amount: r.amount });
  L.push({ kind: "total", label: "Net cash from operating activities", amount: cf.operating });

  L.push({ kind: "heading", label: "Cash flow from investing activities" });
  L.push({ kind: "item", label: "Purchase / sale of fixed assets (net)", amount: cf.investing });
  L.push({ kind: "total", label: "Net cash from investing activities", amount: cf.investing });

  L.push({ kind: "heading", label: "Cash flow from financing activities" });
  for (const r of cf.financing) L.push({ kind: "item", label: r.account.name, amount: r.amount });
  if (cf.financing.length === 0) L.push({ kind: "item", label: "No financing activity", amount: 0 });
  L.push({ kind: "total", label: "Net cash from financing activities", amount: cf.financingTotal });

  L.push({ kind: "grand", label: "Net increase / (decrease) in cash", amount: cf.netChange });
  L.push({ kind: "item", label: "Cash at beginning of period", amount: cf.openingCash });
  L.push({ kind: "grand", label: "Cash at end of period", amount: cf.closingCash });
  return L;
}
