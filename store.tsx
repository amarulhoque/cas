"use client";

/**
 * CAS data store.
 *
 * Storage is isolated behind this file: today everything is kept in the browser (localStorage) so the
 * app works instantly with no setup. To move to Supabase/PostgreSQL later, replace `load()` / `persist()`
 * and the mutation helpers with API calls - the UI and the accounting engine do not change.
 * See supabase/schema.sql for the matching database design.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Account, AppState, BusinessType, Company, JournalEntry } from "./types";
import { SUBTYPES_BY_TYPE } from "./types";
import { buildChartOfAccounts } from "./templates";
import { buildDemoCompany } from "./demo";
import { validateEntry } from "./accounting";
import { uid } from "./utils";

const STORAGE_KEY = "cas:v1";
const EMPTY: AppState = { version: 1, companies: [], activeId: null };

export interface NewCompanyInput {
  name: string;
  businessType: BusinessType;
  currency: string;
  fiscalYearStartMonth: number;
  address?: string;
}

interface CASContext {
  ready: boolean;
  state: AppState;
  company: Company | null;
  createCompany: (input: NewCompanyInput) => void;
  addDemoCompany: () => void;
  selectCompany: (id: string) => void;
  updateCompany: (patch: Partial<Pick<Company, "name" | "currency" | "fiscalYearStartMonth" | "address">>) => void;
  deleteCompany: (id: string) => void;
  saveAccount: (account: Account) => string | null;
  deleteAccount: (id: string) => string | null;
  saveEntry: (entry: JournalEntry) => string | null;
  deleteEntry: (id: string) => void;
  exportJSON: () => string;
  importJSON: (text: string) => string | null;
  resetAll: () => void;
}

const Ctx = createContext<CASContext | null>(null);

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function isValidState(s: unknown): s is AppState {
  if (!s || typeof s !== "object") return false;
  const st = s as AppState;
  return (
    st.version === 1 &&
    Array.isArray(st.companies) &&
    st.companies.every((c) => c && typeof c.id === "string" && Array.isArray(c.accounts) && Array.isArray(c.entries))
  );
}

export function CASProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const ref = useRef<AppState>(EMPTY);

  useEffect(() => {
    const s = load();
    ref.current = s;
    setState(s);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked - data stays in memory for this session */
    }
  }, [state, ready]);

  const commit = useCallback((next: AppState) => {
    ref.current = next;
    setState(next);
  }, []);

  const activeCompany = useCallback((): Company | null => {
    const s = ref.current;
    return s.companies.find((c) => c.id === s.activeId) ?? null;
  }, []);

  const mutate = useCallback(
    (fn: (c: Company) => Company) => {
      const s = ref.current;
      commit({ ...s, companies: s.companies.map((c) => (c.id === s.activeId ? fn(c) : c)) });
    },
    [commit]
  );

  const value = useMemo<CASContext>(() => {
    const company = state.companies.find((c) => c.id === state.activeId) ?? null;
    return {
      ready,
      state,
      company,

      createCompany: (input) => {
        const c: Company = {
          id: uid(),
          name: input.name.trim() || "My Business",
          businessType: input.businessType,
          currency: input.currency,
          fiscalYearStartMonth: input.fiscalYearStartMonth,
          address: input.address?.trim() || undefined,
          accounts: buildChartOfAccounts(input.businessType),
          entries: [],
          createdAt: new Date().toISOString(),
        };
        const s = ref.current;
        commit({ ...s, companies: [...s.companies, c], activeId: c.id });
      },

      addDemoCompany: () => {
        const c = buildDemoCompany();
        const s = ref.current;
        commit({ ...s, companies: [...s.companies, c], activeId: c.id });
      },

      selectCompany: (id) => commit({ ...ref.current, activeId: id }),

      updateCompany: (patch) => mutate((c) => ({ ...c, ...patch })),

      deleteCompany: (id) => {
        const s = ref.current;
        const companies = s.companies.filter((c) => c.id !== id);
        const activeId = s.activeId === id ? (companies[0]?.id ?? null) : s.activeId;
        commit({ ...s, companies, activeId });
      },

      saveAccount: (account) => {
        const c = activeCompany();
        if (!c) return "No company selected.";
        const code = account.code.trim();
        const name = account.name.trim();
        if (!code) return "Account code is required.";
        if (!name) return "Account name is required.";
        if (!SUBTYPES_BY_TYPE[account.type].includes(account.subtype)) return "Choose a valid category for this account type.";
        if (c.accounts.some((a) => a.id !== account.id && a.code.toLowerCase() === code.toLowerCase()))
          return `Code ${code} is already used by another account.`;
        const clean: Account = { ...account, code, name, description: account.description?.trim() || undefined };
        const exists = c.accounts.some((a) => a.id === account.id);
        mutate((co) => ({
          ...co,
          accounts: exists ? co.accounts.map((a) => (a.id === clean.id ? clean : a)) : [...co.accounts, clean],
        }));
        return null;
      },

      deleteAccount: (id) => {
        const c = activeCompany();
        if (!c) return "No company selected.";
        const used = c.entries.filter((e) => e.lines.some((l) => l.accountId === id)).length;
        if (used > 0)
          return `This account is used in ${used} transaction${used > 1 ? "s" : ""}. Deactivate it instead, or edit those transactions first.`;
        mutate((co) => ({ ...co, accounts: co.accounts.filter((a) => a.id !== id) }));
        return null;
      },

      saveEntry: (entry) => {
        const c = activeCompany();
        if (!c) return "No company selected.";
        const err = validateEntry(entry, new Set(c.accounts.map((a) => a.id)));
        if (err) return err;
        const now = new Date().toISOString();
        const exists = c.entries.some((e) => e.id === entry.id);
        const clean: JournalEntry = {
          ...entry,
          reference: entry.reference.trim(),
          description: entry.description.trim(),
          updatedAt: now,
          createdAt: exists ? entry.createdAt : now,
        };
        mutate((co) => ({
          ...co,
          entries: exists ? co.entries.map((e) => (e.id === clean.id ? clean : e)) : [...co.entries, clean],
        }));
        return null;
      },

      deleteEntry: (id) => mutate((co) => ({ ...co, entries: co.entries.filter((e) => e.id !== id) })),

      exportJSON: () => JSON.stringify(ref.current, null, 2),

      importJSON: (text) => {
        try {
          const parsed = JSON.parse(text);
          if (!isValidState(parsed)) return "This file is not a valid CAS backup.";
          const activeId = parsed.companies.some((c) => c.id === parsed.activeId) ? parsed.activeId : (parsed.companies[0]?.id ?? null);
          commit({ ...parsed, activeId });
          return null;
        } catch {
          return "Could not read the file. Is it a CAS backup (.json)?";
        }
      },

      resetAll: () => commit(EMPTY),
    };
  }, [state, ready, commit, mutate, activeCompany]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCAS(): CASContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCAS must be used inside <CASProvider>");
  return v;
}
