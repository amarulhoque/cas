/** Core data model for CAS. All money is stored as integer minor units (cents/poisha). */

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type AccountSubtype =
  | "cash" // cash, bank, mobile wallet
  | "current_asset" // receivables, inventory, prepayments
  | "fixed_asset" // equipment, buildings, accumulated depreciation
  | "current_liability" // payables, accruals, taxes payable
  | "long_term_liability" // loans
  | "equity"
  | "operating_revenue"
  | "other_income"
  | "cogs"
  | "operating_expense"
  | "depreciation"
  | "other_expense"; // interest, income tax, misc

export type BusinessType =
  | "general"
  | "retail"
  | "service"
  | "restaurant"
  | "manufacturing"
  | "property"
  | "nonprofit";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  description?: string;
  active: boolean;
}

export interface JournalLine {
  accountId: string;
  debit: number; // minor units
  credit: number; // minor units
  memo?: string;
}

export type EntryKind =
  | "journal"
  | "money_in"
  | "money_out"
  | "transfer"
  | "credit_sale"
  | "credit_purchase";

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  reference: string;
  description: string;
  kind: EntryKind;
  lines: JournalLine[];
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  businessType: BusinessType;
  currency: string; // ISO code
  fiscalYearStartMonth: number; // 1-12
  address?: string;
  accounts: Account[];
  entries: JournalEntry[];
  createdAt: string;
}

export interface AppState {
  version: 1;
  companies: Company[];
  activeId: string | null;
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

export const SUBTYPE_LABEL: Record<AccountSubtype, string> = {
  cash: "Cash & Bank",
  current_asset: "Current asset",
  fixed_asset: "Fixed / non-current asset",
  current_liability: "Current liability",
  long_term_liability: "Long-term liability",
  equity: "Equity",
  operating_revenue: "Operating revenue",
  other_income: "Other income",
  cogs: "Cost of goods sold / direct cost",
  operating_expense: "Operating expense",
  depreciation: "Depreciation & amortization",
  other_expense: "Other expense (interest, tax)",
};

/** Which subtypes are valid for each account type. */
export const SUBTYPES_BY_TYPE: Record<AccountType, AccountSubtype[]> = {
  asset: ["cash", "current_asset", "fixed_asset"],
  liability: ["current_liability", "long_term_liability"],
  equity: ["equity"],
  revenue: ["operating_revenue", "other_income"],
  expense: ["cogs", "operating_expense", "depreciation", "other_expense"],
};

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  general: "General business (any)",
  retail: "Retail / Trading",
  service: "Service / Consulting",
  restaurant: "Restaurant / Food",
  manufacturing: "Manufacturing",
  property: "Property management / Rental",
  nonprofit: "Non-profit / Foundation",
};

export const isDebitNormal = (t: AccountType) => t === "asset" || t === "expense";
