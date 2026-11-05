import type { Account, AccountSubtype, AccountType, BusinessType } from "./types";
import { uid } from "./utils";

type Row = [code: string, name: string, type: AccountType, subtype: AccountSubtype];

/** Accounts every business gets. Industry packs below rename, add or remove from this base. */
const BASE: Row[] = [
  ["1000", "Cash on Hand", "asset", "cash"],
  ["1010", "Bank Account", "asset", "cash"],
  ["1020", "Mobile Wallet", "asset", "cash"],
  ["1100", "Accounts Receivable", "asset", "current_asset"],
  ["1150", "Advances & Prepayments", "asset", "current_asset"],
  ["1500", "Equipment & Furniture", "asset", "fixed_asset"],
  ["1510", "Accumulated Depreciation", "asset", "fixed_asset"],

  ["2000", "Accounts Payable", "liability", "current_liability"],
  ["2100", "Accrued Expenses", "liability", "current_liability"],
  ["2150", "Taxes Payable", "liability", "current_liability"],
  ["2200", "Customer Advances & Deposits", "liability", "current_liability"],
  ["2500", "Bank Loan", "liability", "long_term_liability"],
  ["2510", "Owner / Director Loan", "liability", "long_term_liability"],

  ["3000", "Owner's Capital", "equity", "equity"],
  ["3100", "Retained Earnings", "equity", "equity"],
  ["3200", "Owner's Drawings", "equity", "equity"],

  ["4000", "Sales / Service Revenue", "revenue", "operating_revenue"],
  ["4900", "Other Income", "revenue", "other_income"],

  ["6000", "Salaries & Wages", "expense", "operating_expense"],
  ["6100", "Rent", "expense", "operating_expense"],
  ["6200", "Utilities", "expense", "operating_expense"],
  ["6300", "Office & Administration", "expense", "operating_expense"],
  ["6400", "Marketing & Advertising", "expense", "operating_expense"],
  ["6500", "Transport & Travel", "expense", "operating_expense"],
  ["6600", "Repairs & Maintenance", "expense", "operating_expense"],
  ["6700", "Professional Fees", "expense", "operating_expense"],
  ["6800", "Bank Charges", "expense", "operating_expense"],
  ["6900", "Depreciation Expense", "expense", "depreciation"],
  ["7000", "Interest Expense", "expense", "other_expense"],
  ["7100", "Income Tax Expense", "expense", "other_expense"],
  ["7200", "Miscellaneous Expense", "expense", "other_expense"],
];

interface Pack {
  rename?: Record<string, string>;
  remove?: string[];
  add?: Row[];
}

const PACKS: Record<BusinessType, Pack> = {
  general: {
    add: [
      ["1200", "Inventory", "asset", "current_asset"],
      ["5000", "Cost of Goods Sold", "expense", "cogs"],
    ],
  },
  retail: {
    rename: { "4000": "Sales Revenue" },
    add: [
      ["1200", "Merchandise Inventory", "asset", "current_asset"],
      ["4100", "Delivery Charges Income", "revenue", "operating_revenue"],
      ["5000", "Cost of Goods Sold", "expense", "cogs"],
      ["5100", "Purchase Freight & Handling", "expense", "cogs"],
      ["6450", "Packaging Supplies", "expense", "operating_expense"],
    ],
  },
  service: {
    rename: { "4000": "Service Revenue" },
    add: [
      ["4100", "Consulting Fees", "revenue", "operating_revenue"],
      ["5000", "Direct Labour & Subcontractors", "expense", "cogs"],
    ],
  },
  restaurant: {
    rename: { "4000": "Food Sales" },
    add: [
      ["1200", "Food & Beverage Inventory", "asset", "current_asset"],
      ["4100", "Beverage Sales", "revenue", "operating_revenue"],
      ["4200", "Catering Income", "revenue", "operating_revenue"],
      ["5000", "Food & Beverage Cost", "expense", "cogs"],
      ["6250", "Gas & Fuel", "expense", "operating_expense"],
    ],
  },
  manufacturing: {
    rename: { "4000": "Product Sales", "1500": "Machinery & Equipment" },
    add: [
      ["1200", "Raw Materials", "asset", "current_asset"],
      ["1210", "Work in Progress", "asset", "current_asset"],
      ["1220", "Finished Goods", "asset", "current_asset"],
      ["5000", "Cost of Goods Sold", "expense", "cogs"],
      ["5100", "Direct Labour", "expense", "cogs"],
      ["5200", "Factory Overheads", "expense", "cogs"],
    ],
  },
  property: {
    rename: {
      "1100": "Rent Receivable (Tenants)",
      "2200": "Security Deposits Held",
      "4000": "Rental Income",
    },
    add: [
      ["1400", "Land", "asset", "fixed_asset"],
      ["1450", "Buildings", "asset", "fixed_asset"],
      ["4100", "Service Charge Income", "revenue", "operating_revenue"],
      ["4200", "Parking & Facility Income", "revenue", "operating_revenue"],
      ["5000", "Direct Property Costs", "expense", "cogs"],
      ["6650", "Property Insurance", "expense", "operating_expense"],
      ["6750", "Municipal / Land Taxes", "expense", "operating_expense"],
    ],
  },
  nonprofit: {
    rename: {
      "3000": "Opening Fund Balance",
      "3100": "Accumulated Surplus",
      "4000": "Donations",
    },
    remove: ["3200"],
    add: [
      ["4100", "Grants", "revenue", "operating_revenue"],
      ["4200", "Program Fees", "revenue", "operating_revenue"],
      ["5000", "Direct Program Costs", "expense", "cogs"],
      ["6050", "Volunteer & Training Costs", "expense", "operating_expense"],
    ],
  },
};

/** Build a fresh chart of accounts (new ids) for a business type. */
export function buildChartOfAccounts(type: BusinessType): Account[] {
  const pack = PACKS[type];
  const rows = BASE.filter((r) => !pack.remove?.includes(r[0])).map(
    (r) => [r[0], pack.rename?.[r[0]] ?? r[1], r[2], r[3]] as Row
  );
  const all = [...rows, ...(pack.add ?? [])].sort((a, b) => a[0].localeCompare(b[0]));
  return all.map(([code, name, type, subtype]) => ({
    id: uid(),
    code,
    name,
    type,
    subtype,
    active: true,
  }));
}
