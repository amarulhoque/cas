import type { AccountType } from "./types";

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ---------------- money ---------------- */

export const CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee" },
  { code: "AED", symbol: "AED ", name: "UAE Dirham" },
  { code: "SAR", symbol: "SAR ", name: "Saudi Riyal" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
];

export const currencySymbol = (code: string) =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? code + " ";

const nfIntl = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** South Asian digit grouping (12,89,250.00) for the currencies that use lakh/crore. */
const nfSouthAsia = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usesLakh = (code: string) => code === "BDT" || code === "INR" || code === "PKR";

/** Format minor units. `parens` shows negatives as (1,234.00) like financial statements. */
export function fmtMoney(cents: number, currency = "BDT", opts: { parens?: boolean; symbol?: boolean } = {}): string {
  const { parens = false, symbol = true } = opts;
  const abs = (usesLakh(currency) ? nfSouthAsia : nfIntl).format(Math.abs(cents) / 100);
  const body = symbol ? currencySymbol(currency) + abs : abs;
  if (cents < 0) return parens ? `(${body})` : `-${body}`;
  return body;
}

/** Parse user input like "1,234.50" into minor units. Returns NaN if invalid. */
export function toCents(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const cleaned = input.replace(/[,\s]/g, "");
  if (cleaned === "" || !/^-?\d*\.?\d*$/.test(cleaned)) return NaN;
  return Math.round(parseFloat(cleaned) * 100);
}

export const centsToInput = (cents: number) => (cents === 0 ? "" : (cents / 100).toFixed(2));

/* ---------------- dates ---------------- */

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDate(new Date());

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const addDays = (s: string, n: number) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};

export const startOfMonth = (s: string) => s.slice(0, 8) + "01";
export const endOfMonth = (s: string) => {
  const d = parseISO(s);
  return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

export const addMonths = (s: string, n: number) => {
  const d = parseISO(s);
  return isoDate(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

export function fmtDate(s: string): string {
  if (!s) return "";
  return parseISO(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export const monthLabel = (s: string) =>
  parseISO(s).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

/** Fiscal year containing `ref`, for a fiscal year that starts in `startMonth` (1-12). */
export function fiscalYearRange(startMonth: number, ref: string): { from: string; to: string } {
  const d = parseISO(ref);
  let startYear = d.getFullYear();
  if (d.getMonth() + 1 < startMonth) startYear -= 1;
  const from = isoDate(new Date(startYear, startMonth - 1, 1));
  const to = isoDate(new Date(startYear + 1, startMonth - 1, 0));
  return { from, to };
}

export type PeriodPreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_fy"
  | "last_fy"
  | "all_time"
  | "custom";

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  this_fy: "This fiscal year",
  last_fy: "Last fiscal year",
  all_time: "All time",
  custom: "Custom range",
};

export function periodRange(preset: PeriodPreset, startMonth: number, ref = today()): { from: string; to: string } {
  switch (preset) {
    case "this_month":
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    case "last_month": {
      const lm = addMonths(startOfMonth(ref), -1);
      return { from: lm, to: endOfMonth(lm) };
    }
    case "this_quarter": {
      const d = parseISO(ref);
      const qStartMonth = Math.floor(d.getMonth() / 3) * 3;
      const from = isoDate(new Date(d.getFullYear(), qStartMonth, 1));
      return { from, to: endOfMonth(addMonths(from, 2)) };
    }
    case "this_fy":
      return fiscalYearRange(startMonth, ref);
    case "last_fy": {
      const cur = fiscalYearRange(startMonth, ref);
      return fiscalYearRange(startMonth, addDays(cur.from, -1));
    }
    case "all_time":
      return { from: "1900-01-01", to: "2999-12-31" };
    default:
      return { from: startOfMonth(ref), to: ref };
  }
}

/* ---------------- misc ---------------- */

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
}

export const typeColor: Record<AccountType, string> = {
  asset: "bg-sky-50 text-sky-700 ring-sky-200",
  liability: "bg-amber-50 text-amber-700 ring-amber-200",
  equity: "bg-violet-50 text-violet-700 ring-violet-200",
  revenue: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  expense: "bg-rose-50 text-rose-700 ring-rose-200",
};
