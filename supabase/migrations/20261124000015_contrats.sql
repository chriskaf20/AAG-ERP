-- Phase 2 — Contrats (CTR-AAAA-NNN) et avenants, liés au dossier et au devis

create type public.contrat_statut as enum ('brouillon', 'signe', 'resilie');

create table public.contrats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  devis_id uuid references public.devis (id) on delete set null,
  numero text not null default '',
  objet text not null check (length(trim(objet)) > 0),
  date_debut date,
  date_fin date,
  montant numeric(14, 2) check (montant is null or montant >= 0),
  devise public.devise not null default 'USD',
  statut public.contrat_statut not null default 'brouillon',
  document_id uuid references public.documents (id) on delete set null,
  signe_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, numero),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create index contrats_dossier_idx on public.contrats (dossier_id);

create trigger contrats_meta before insert or update on public.contrats
  for each row execute function public.tg_meta();

create table public.avenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contrat_id uuid not null references public.contrats (id) on delete cascade,
  numero text not null default '',
  objet text not null check (length(trim(objet)) > 0),
  montant_delta numeric(14, 2) not null default 0,
  date_effet date,
  statut public.contrat_statut not null default 'brouillon',
  document_id uuid references public.documents (id) on delete set null,
  signe_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (contrat_id, numero)
);

create trigger avenants_meta before insert or update on public.avenants
  for each row execute function public.tg_meta();

create function public.tg_contrats_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.statut <> 'brouillon' then
      raise exception 'Contrat signé : suppression interdite' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.dossiers where id = new.dossier_id and organization_id = new.organization_id) then
      raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    if new.devis_id is not null and not exists (
      select 1 from public.devis where id = new.devis_id and dossier_id = new.dossier_id) then
      raise exception 'Le devis n''appartient pas au dossier' using errcode = 'check_violation';
    end if;
    new.numero := public.prochain_numero(new.organization_id, 'CTR');
    if new.statut = 'signe' then new.signe_le := coalesce(new.signe_le, now()); end if;
    return new;
  end if;
  if new.numero is distinct from old.numero then
    raise exception 'Numéro de contrat immuable' using errcode = 'check_violation';
  end if;
  if old.statut = 'signe' and (new.statut <> 'resilie'
       or (to_jsonb(new) - array['statut', 'updated_at']) is distinct from (to_jsonb(old) - array['statut', 'updated_at'])) then
    raise exception 'Contrat signé : non modifiable (établissez un avenant)' using errcode = 'insufficient_privilege';
  end if;
  if old.statut = 'resilie' then
    raise exception 'Contrat résilié : non modifiable' using errcode = 'insufficient_privilege';
  end if;
  if new.statut = 'signe' and old.statut = 'brouillon' then new.signe_le := now(); end if;
  return new;
end;
$$;

create trigger contrats_guard before insert or update or delete on public.contrats
  for each row execute function public.tg_contrats_guard();

create function public.tg_avenants_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrat public.contrats;
begin
  if tg_op = 'DELETE' then
    if old.statut <> 'brouillon' then
      raise exception 'Avenant signé : suppression interdite' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    select * into v_contrat from public.contrats where id = new.contrat_id;
    if v_contrat.id is null or v_contrat.organization_id <> new.organization_id then
      raise exception 'Contrat invalide' using errcode = 'check_violation';
    end if;
    if v_contrat.statut <> 'signe' then
      raise exception 'Un avenant ne s''établit que sur un contrat signé' using errcode = 'check_violation';
    end if;
    new.numero := v_contrat.numero || '-A' ||
      ((select count(*) from public.avenants where contrat_id = new.contrat_id) + 1);
    if new.statut = 'signe' then new.signe_le := coalesce(new.signe_le, now()); end if;
    return new;
  end if;
  if old.statut <> 'brouillon' then
    raise exception 'Avenant signé : non modifiable' using errcode = 'insufficient_privilege';
  end if;
  if new.numero is distinct from old.numero then
    raise exception 'Numéro d''avenant immuable' using errcode = 'check_violation';
  end if;
  if new.statut = 'signe' then new.signe_le := now(); end if;
  return new;
end;
$$;

create trigger avenants_guard before insert or update or delete on public.avenants
  for each row execute function public.tg_avenants_guard();
