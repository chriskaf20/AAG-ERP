-- Phase 1 — Dossiers (fiche F-01), numérotation, affectations, historique

create type public.dossier_statut as enum (
  'nouveau', 'en_verification', 'complement_requis', 'accepte', 'devis_envoye',
  'en_lancement', 'en_cours', 'livre', 'reserves', 'receptionne_a_facturer',
  'cloture', 'refuse', 'classe_sans_suite'
);

create type public.canal_reception as enum ('visite', 'appel', 'whatsapp', 'email', 'site_web');

create type public.piece_type as enum ('rccm', 'id_nat', 'nif', 'piece_identite', 'autre');

-- ---------------------------------------------------------------------------
-- Compteur de numérotation par organisation et par année
-- ---------------------------------------------------------------------------
create table public.dossier_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  annee integer not null,
  dernier integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, annee)
);

create trigger dossier_counters_meta before insert or update on public.dossier_counters
  for each row execute function public.tg_meta();

-- ---------------------------------------------------------------------------
-- Dossiers
-- ---------------------------------------------------------------------------
create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  numero text not null,
  annee integer not null,
  date_reception date not null default current_date,
  canal public.canal_reception not null,
  client_id uuid not null references public.clients (id) on delete restrict,
  contact_id uuid references public.contacts (id) on delete set null,
  service text not null check (length(trim(service)) > 0),
  besoin text not null check (length(trim(besoin)) > 0),
  delai_souhaite date,
  budget_indicatif numeric(14, 2) check (budget_indicatif is null or budget_indicatif >= 0),
  budget_devise public.devise not null default 'USD',
  department_id uuid not null references public.departments (id) on delete restrict,
  responsable_id uuid references public.profiles (id) on delete set null,
  pieces_recues public.piece_type[] not null default '{}',
  pieces_autres text,
  accuse_reception_envoye boolean not null default false,
  statut public.dossier_statut not null default 'nouveau',
  statut_motif text,
  statut_change_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);

create index dossiers_org_statut_idx on public.dossiers (organization_id, statut);
create index dossiers_responsable_idx on public.dossiers (responsable_id);
create index dossiers_department_idx on public.dossiers (department_id);
create index dossiers_client_idx on public.dossiers (client_id);

create trigger dossiers_meta before insert or update on public.dossiers
  for each row execute function public.tg_meta();

-- Numéro AAG-AAAA-NNN, cohérence organisation, statut initial
create function public.tg_dossiers_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefixe text;
  v_num integer;
begin
  -- Cohérence des références avec l'organisation
  if not exists (select 1 from public.clients
                 where id = new.client_id and organization_id = new.organization_id) then
    raise exception 'Client invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.departments
                 where id = new.department_id and organization_id = new.organization_id) then
    raise exception 'Département invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  if new.contact_id is not null and not exists (
    select 1 from public.contacts where id = new.contact_id and client_id = new.client_id) then
    raise exception 'Le contact n''appartient pas au client' using errcode = 'check_violation';
  end if;

  -- Un dossier créé par un utilisateur démarre toujours à « nouveau »
  -- (seules les données de test, sans utilisateur connecté, peuvent fixer un statut)
  if auth.uid() is not null then
    new.statut := 'nouveau';
    new.statut_motif := null;
    new.statut_change_le := null;
  end if;

  select prefixe_dossier into v_prefixe
  from public.organizations where id = new.organization_id;

  new.annee := extract(year from coalesce(new.date_reception, current_date))::integer;

  insert into public.dossier_counters as c (organization_id, annee, dernier)
  values (new.organization_id, new.annee, 1)
  on conflict (organization_id, annee)
    do update set dernier = c.dernier + 1
  returning dernier into v_num;

  new.numero := v_prefixe || '-' || new.annee || '-' || lpad(v_num::text, 3, '0');
  return new;
end;
$$;

create trigger dossiers_before_insert before insert on public.dossiers
  for each row execute function public.tg_dossiers_before_insert();

-- Le statut ne change que par change_dossier_status(); numéro immuable
create function public.tg_dossiers_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.numero is distinct from old.numero or new.annee is distinct from old.annee then
    raise exception 'Le numéro de dossier est immuable' using errcode = 'check_violation';
  end if;
  if (new.statut is distinct from old.statut
      or new.statut_motif is distinct from old.statut_motif
      or new.statut_change_le is distinct from old.statut_change_le)
     and coalesce(current_setting('atlas.changement_statut', true), '') <> 'on' then
    raise exception 'Le statut ne peut être modifié que via change_dossier_status()'
      using errcode = 'insufficient_privilege';
  end if;
  if new.client_id is distinct from old.client_id and old.statut <> 'nouveau' then
    raise exception 'Le client ne peut plus être changé après le début de la vérification'
      using errcode = 'check_violation';
  end if;
  if new.department_id is distinct from old.department_id and not exists (
    select 1 from public.departments
    where id = new.department_id and organization_id = new.organization_id) then
    raise exception 'Département invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger dossiers_before_update before update on public.dossiers
  for each row execute function public.tg_dossiers_before_update();

-- ---------------------------------------------------------------------------
-- Affectations (agents terrain et autres intervenants)
-- ---------------------------------------------------------------------------
create table public.dossier_affectations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (dossier_id, user_id)
);

create index dossier_affectations_user_idx on public.dossier_affectations (user_id);

create trigger dossier_affectations_meta before insert or update on public.dossier_affectations
  for each row execute function public.tg_meta();

-- ---------------------------------------------------------------------------
-- Historique des statuts (écrit uniquement par change_dossier_status)
-- ---------------------------------------------------------------------------
create table public.dossier_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  ancien_statut public.dossier_statut,
  nouveau_statut public.dossier_statut not null,
  motif text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index dossier_status_history_dossier_idx
  on public.dossier_status_history (dossier_id, created_at);

create trigger dossier_status_history_meta before insert or update on public.dossier_status_history
  for each row execute function public.tg_meta();

-- ---------------------------------------------------------------------------
-- Visibilité / édition d'un dossier (utilisées par la RLS et les fonctions)
-- ---------------------------------------------------------------------------
-- Lecture :
--   direction (admin_systeme, gerant, associe, directeurs, daf) : toute l'organisation
--   responsable_departement, acheteur, responsable_rh : dossiers de leur département
--   responsable du dossier (responsable_id) : ses dossiers
--   personne affectée (agent_terrain…) : dossiers affectés uniquement
create function public.can_see_dossier(p_dossier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dossiers d
    where d.id = p_dossier
      and (
        public.is_direction(d.organization_id)
        or public.has_dept_role(d.organization_id, d.department_id, array[
             'responsable_departement', 'acheteur', 'responsable_rh'
           ]::public.app_role[])
        or (d.responsable_id = auth.uid() and public.is_internal(d.organization_id))
        or exists (
          select 1 from public.dossier_affectations a
          where a.dossier_id = d.id and a.user_id = auth.uid()
        )
      )
  );
$$;

-- Édition (hors statut) : direction, responsable du département, responsable du dossier
create function public.can_edit_dossier(p_dossier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dossiers d
    where d.id = p_dossier
      and (
        public.is_direction(d.organization_id)
        or public.has_dept_role(d.organization_id, d.department_id,
             array['responsable_departement']::public.app_role[])
        or (d.responsable_id = auth.uid() and public.is_internal(d.organization_id))
      )
  );
$$;

revoke execute on function public.can_see_dossier(uuid) from public, anon;
revoke execute on function public.can_edit_dossier(uuid) from public, anon;
grant execute on function public.can_see_dossier(uuid) to authenticated;
grant execute on function public.can_edit_dossier(uuid) to authenticated;
