-- Phase 1 — Clients et contacts

create type public.client_type as enum ('entreprise', 'particulier');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type public.client_type not null default 'entreprise',
  -- raison sociale (entreprise) ou nom complet (particulier)
  raison_sociale text not null check (length(trim(raison_sociale)) > 0),
  rccm text,
  nif text,
  id_nat text,
  adresse text,
  ville text default 'Lubumbashi',
  telephone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index clients_org_idx on public.clients (organization_id, raison_sociale);

create trigger clients_meta before insert or update on public.clients
  for each row execute function public.tg_meta();

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  fonction text,
  telephone text,
  email text,
  est_signataire boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index contacts_client_idx on public.contacts (client_id);

create trigger contacts_meta before insert or update on public.contacts
  for each row execute function public.tg_meta();

-- Le contact appartient à la même organisation que son client
create function public.tg_contacts_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clients c
    where c.id = new.client_id and c.organization_id = new.organization_id
  ) then
    raise exception 'Le client n''appartient pas à l''organisation'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger contacts_check before insert or update on public.contacts
  for each row execute function public.tg_contacts_check();
