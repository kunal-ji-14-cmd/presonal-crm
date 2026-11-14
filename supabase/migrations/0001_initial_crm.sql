-- Nexus AI CRM: tenant-aware foundation.
-- Run this migration in the Supabase SQL Editor or with the Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','manager','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.organization_members m where m.organization_id = target_org and m.user_id = auth.uid()) $$;

create or replace function public.has_org_role(target_org uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.organization_members m where m.organization_id = target_org and m.user_id = auth.uid() and m.role = any(allowed_roles)) $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  website text,
  industry text,
  phone text,
  email text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create index if not exists companies_org_name_idx on public.companies(organization_id,name);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  job_title text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  constraint contacts_company_org_fk foreign key (organization_id,company_id) references public.companies(organization_id,id) on delete restrict
);
create index if not exists contacts_org_email_idx on public.contacts(organization_id,email);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid,
  contact_id uuid,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  source text,
  status text not null default 'new' check (status in ('new','contacted','qualified','unqualified','converted')),
  score integer not null default 0 check (score between 0 and 100),
  estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  notes text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  constraint leads_company_org_fk foreign key (organization_id,company_id) references public.companies(organization_id,id) on delete restrict,
  constraint leads_contact_org_fk foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete restrict
);
create index if not exists leads_org_status_idx on public.leads(organization_id,status);
create index if not exists leads_org_created_idx on public.leads(organization_id,created_at desc);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid,
  contact_id uuid,
  title text not null,
  stage text not null default 'discovery',
  amount numeric(14,2) not null default 0 check (amount >= 0),
  probability integer not null default 0 check (probability between 0 and 100),
  expected_close_date date,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_company_org_fk foreign key (organization_id,company_id) references public.companies(organization_id,id) on delete restrict,
  constraint deals_contact_org_fk foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete restrict
);
create index if not exists deals_org_stage_idx on public.deals(organization_id,stage);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_org_due_idx on public.tasks(organization_id,due_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['organizations','companies','contacts','leads','deals','tasks'] loop
    execute format('drop trigger if exists set_updated_at on public.%I',t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
  end loop;
end $$;

-- Every new user receives a private starter organization and owner membership.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare org_name text; org_slug text; new_org_id uuid;
begin
  org_name := coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'),''), 'My Workspace');
  org_slug := trim(both '-' from regexp_replace(lower(org_name), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(new.id::text,'-',''),1,8);
  insert into public.organizations(name,slug,created_by) values (org_name,org_slug,new.id) returning id into new_org_id;
  insert into public.organization_members(organization_id,user_id,role) values (new_org_id,new.id,'owner');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.tasks enable row level security;

create policy "members can view their organizations" on public.organizations for select using (public.is_org_member(id));
create policy "owners and admins can update organizations" on public.organizations for update using (public.has_org_role(id,array['owner','admin'])) with check (public.has_org_role(id,array['owner','admin']));
create policy "members can view organization membership" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "owners and admins can manage membership" on public.organization_members for all using (public.has_org_role(organization_id,array['owner','admin'])) with check (public.has_org_role(organization_id,array['owner','admin']));

create policy "members access companies" on public.companies for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members access contacts" on public.contacts for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members access leads" on public.leads for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members access deals" on public.deals for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members access tasks" on public.tasks for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

grant usage on schema public to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.companies, public.contacts, public.leads, public.deals, public.tasks to authenticated;