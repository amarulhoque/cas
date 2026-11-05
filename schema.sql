-- CAS - Common Accounting System: PostgreSQL / Supabase schema (multi-business, multi-user)
-- Not wired into the app yet. The app currently stores data in the browser (lib/store.tsx);
-- this is the matching design for when you move to Supabase. Money is stored as integer minor units (cents/poisha).

create extension if not exists "pgcrypto";

create type account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
create type account_subtype as enum (
  'cash', 'current_asset', 'fixed_asset',
  'current_liability', 'long_term_liability', 'equity',
  'operating_revenue', 'other_income',
  'cogs', 'operating_expense', 'depreciation', 'other_expense'
);
create type entry_kind as enum ('journal', 'money_in', 'money_out', 'transfer', 'credit_sale', 'credit_purchase');
create type member_role as enum ('owner', 'accountant', 'viewer');

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text not null default 'general',
  currency char(3) not null default 'BDT',
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  address text,
  created_at timestamptz not null default now()
);

create table company_members (
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'viewer',
  primary key (company_id, user_id)
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  type account_type not null,
  subtype account_subtype not null,
  description text,
  active boolean not null default true,
  unique (company_id, code)
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_date date not null,
  reference text not null default '',
  description text not null default '',
  kind entry_kind not null default 'journal',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on journal_entries (company_id, entry_date);

create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references journal_entries(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict, -- accounts with history cannot be deleted
  debit bigint not null default 0 check (debit >= 0),
  credit bigint not null default 0 check (credit >= 0),
  memo text,
  check (debit = 0 or credit = 0),
  check (debit > 0 or credit > 0)
);
create index on journal_lines (company_id, account_id);
create index on journal_lines (entry_id);

-- Every entry must balance (checked at commit, so all lines can be inserted first).
create or replace function assert_entry_balanced() returns trigger language plpgsql as $$
declare e uuid := coalesce(new.entry_id, old.entry_id); d bigint; c bigint; n int;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*) into d, c, n from journal_lines where entry_id = e;
  if n > 0 and (d <> c or n < 2) then
    raise exception 'Journal entry % is not balanced (debit %, credit %)', e, d, c;
  end if;
  return null;
end $$;

create constraint trigger journal_lines_balanced
  after insert or update or delete on journal_lines
  deferrable initially deferred
  for each row execute function assert_entry_balanced();

-- ---------- Row level security: users only see businesses they belong to ----------
create or replace function is_member(cid uuid, min_role member_role default 'viewer') returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from company_members m
    where m.company_id = cid and m.user_id = auth.uid()
      and (min_role = 'viewer'
           or (min_role = 'accountant' and m.role in ('owner', 'accountant'))
           or (min_role = 'owner' and m.role = 'owner'))
  );
$$;

alter table companies enable row level security;
alter table company_members enable row level security;
alter table accounts enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;

create policy companies_read on companies for select using (is_member(id));
create policy companies_update on companies for update using (is_member(id, 'owner'));
create policy companies_delete on companies for delete using (is_member(id, 'owner'));
create policy companies_insert on companies for insert with check (auth.uid() is not null);

create policy members_read on company_members for select using (user_id = auth.uid() or is_member(company_id));
create policy members_manage on company_members for all using (is_member(company_id, 'owner')) with check (is_member(company_id, 'owner'));

create policy accounts_read on accounts for select using (is_member(company_id));
create policy accounts_write on accounts for all using (is_member(company_id, 'accountant')) with check (is_member(company_id, 'accountant'));

create policy entries_read on journal_entries for select using (is_member(company_id));
create policy entries_write on journal_entries for all using (is_member(company_id, 'accountant')) with check (is_member(company_id, 'accountant'));

create policy lines_read on journal_lines for select using (is_member(company_id));
create policy lines_write on journal_lines for all using (is_member(company_id, 'accountant')) with check (is_member(company_id, 'accountant'));

-- Make the creator of a business its owner.
create or replace function add_owner_member() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into company_members (company_id, user_id, role) values (new.id, auth.uid(), 'owner');
  return new;
end $$;
create trigger companies_add_owner after insert on companies for each row execute function add_owner_member();
