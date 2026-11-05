# CAS - Common Accounting System

Accounting for **any type of business**: keep your books and get a live **Balance Sheet**, **Income Statement** and **Cash Flow Statement**.

## What it does

- **Record transactions** - Money In, Money Out, Transfer, Credit Sale, Credit Purchase (simple forms), or a full double-entry **Journal**. **Add, edit and delete** any of them.
- **Chart of Accounts** - ready-made sets for General, Retail, Service, Restaurant, Manufacturing, Property/Rental and Non-profit businesses. Add, rename, edit, deactivate or delete accounts. An account with history cannot be deleted, only deactivated.
- **Reports** (all generated live from the journal, so they always agree):
  Income Statement · Balance Sheet · Cash Flow (indirect method) · Trial Balance · Account Ledger.
  Choose a period (month, quarter, financial year, custom), export to **CSV**, or **Print / Save as PDF**.
- **Multiple businesses** in one place, each with its own books, currency and financial-year start.
- **Backup & restore** (JSON) and a demo business to explore with.
- Currency formats include BDT with lakh/crore grouping.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # accounting engine tests
npm run build      # production build
```

Deploy to Vercel or Netlify like any Next.js app (no environment variables needed today).

## How it is built

| Folder | Purpose |
| --- | --- |
| `lib/accounting.ts` | Pure double-entry engine: trial balance, income statement, balance sheet, cash flow, ledger, validation |
| `lib/templates.ts` | Chart-of-accounts packs per business type - add a new industry here |
| `lib/store.tsx` | Data layer (currently browser storage). Swap this file to move to a database |
| `lib/reports.ts` | Turns engine output into printable statement lines |
| `app/*`, `components/*` | Next.js (App Router) + Tailwind screens |
| `supabase/schema.sql` | PostgreSQL schema with row-level security and a balanced-entry check, for the move to Supabase |
| `tests/accounting.test.ts` | Checks that the balance sheet balances and the cash flow reconciles |

Money is stored as integer minor units (no floating-point errors). Every account has a **type** (asset, liability, equity, revenue, expense) and a **category**; the category decides where it shows on the statements and in the cash-flow section.

## Current limits (and the next step)

- Data lives **in the browser** on one device; use Settings → Backup regularly. There are no logins yet.
- Next step is Supabase: create the project, run `supabase/schema.sql`, add Auth, and replace the functions in `lib/store.tsx` with database calls. The screens and accounting engine do not change.
- Not built yet: invoicing/bills with customer & supplier records, bank reconciliation, budgets, attachments, tax/VAT handling, and an audit log.
