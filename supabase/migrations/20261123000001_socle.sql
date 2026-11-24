-- Phase 1 — Socle : enums, métadonnées communes, organisations, départements,
-- profils, rôles et fonctions d'aide pour la RLS.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'admin_systeme', 'gerant', 'associe', 'directeur_commercial',
  'directeur_operations', 'daf', 'responsable_departement',
  'responsable_dossier', 'acheteur', 'responsable_rh', 'agent_terrain', 'client'
);

create type public.dept_code as enum ('AFF', 'SUP', 'PEF', 'DIG');

create type public.devise as enum ('USD', 'CDF');

-- ---------------------------------------------------------------------------
-- Métadonnées communes : created_at / created_by / updated_at
-- created_by est imposé à l'utilisateur connecté (non falsifiable) ;
-- created_at / created_by ne changent jamais après l'insertion.
-- ---------------------------------------------------------------------------
create function public.tg_meta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- sans utilisateur connecté (migrations, données de test) on garde la date fournie
    if auth.uid() is not null then
      new.created_at := now();
    end if;
    new.updated_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    -- profiles.organization_id = organisation par défaut (modifiable) ;
    -- organizations.organization_id est une colonne générée.
    if tg_table_name not in ('profiles', 'organizations')
       and new.organization_id is distinct from old.organization_id then
      raise exception 'organization_id ne peut pas être modifié'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisations (multi-entreprise)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  -- l'organisation est sa propre organization_id (uniformité RLS / audit)
  organization_id uuid generated always as (id) stored,
  nom text not null,
  sigle text,
  rccm text,
  nif text,
  id_nat text,
  adresse text,
  telephone text,
  email text,
  logo_path text,
  devise public.devise not null default 'USD',
  prefixe_dossier text not null default 'AAG'
    check (prefixe_dossier ~ '^[A-Z]{2,6}$'),
  parametres jsonb not null default jsonb_build_object(
    'seuil_validation_usd', 5000,
    'acompte_pct', 30,
    'garantie_jours', 90
  ),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint parametres_valides check (
    jsonb_typeof(parametres -> 'seuil_validation_usd') = 'number'
    and jsonb_typeof(parametres -> 'acompte_pct') = 'number'
    and jsonb_typeof(parametres -> 'garantie_jours') = 'number'
    and (parametres ->> 'acompte_pct')::numeric between 0 and 100
    and (parametres ->> 'seuil_validation_usd')::numeric >= 0
    and (parametres ->> 'garantie_jours')::numeric >= 0
  )
);

create trigger organizations_meta before insert or update on public.organizations
  for each row execute function public.tg_meta();

-- ---------------------------------------------------------------------------
-- Départements
-- ---------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code public.dept_code not null,
  nom text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create trigger departments_meta before insert or update on public.departments
  for each row execute function public.tg_meta();

-- ---------------------------------------------------------------------------
-- Profils (1 par utilisateur Auth). organization_id = organisation par défaut.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  nom_complet text not null default '',
  email text,
  telephone text,
  fonction text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger profiles_meta before insert or update on public.profiles
  for each row execute function public.tg_meta();

-- Création automatique du profil à l'inscription
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nom_complet, email, created_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom_complet', split_part(new.email, '@', 1)),
    new.email,
    new.id
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Rôles (un utilisateur peut en avoir plusieurs, éventuellement par département)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  department_id uuid references public.departments (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, user_id, role, department_id),
  constraint role_departement check (
    role <> 'responsable_departement' or department_id is not null
  )
);

create index user_roles_user_idx on public.user_roles (user_id, organization_id);

create trigger user_roles_meta before insert or update on public.user_roles
  for each row execute function public.tg_meta();

-- Le département d'un rôle doit appartenir à la même organisation
create function public.tg_user_roles_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = new.department_id and d.organization_id = new.organization_id
  ) then
    raise exception 'Le département n''appartient pas à l''organisation'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger user_roles_check before insert or update on public.user_roles
  for each row execute function public.tg_user_roles_check();

-- ---------------------------------------------------------------------------
-- Fonctions d'aide RLS (security definer : évitent la récursion des politiques)
-- ---------------------------------------------------------------------------
create function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct organization_id from public.user_roles where user_id = auth.uid();
$$;

create function public.has_role(p_org uuid, p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and organization_id = p_org and role = any (p_roles)
  );
$$;

-- Direction : voit et pilote toute l'organisation
create function public.is_direction(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_org, array[
    'admin_systeme', 'gerant', 'associe', 'directeur_commercial',
    'directeur_operations', 'daf'
  ]::public.app_role[]);
$$;

-- Membre interne (tout rôle sauf client)
create function public.is_internal(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and organization_id = p_org and role <> 'client'
  );
$$;

-- Départements dont l'utilisateur relève pour un ou plusieurs rôles donnés
create function public.has_dept_role(p_org uuid, p_dept uuid, p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and organization_id = p_org
      and department_id = p_dept and role = any (p_roles)
  );
$$;

revoke execute on function public.user_org_ids() from public, anon;
revoke execute on function public.has_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.is_direction(uuid) from public, anon;
revoke execute on function public.is_internal(uuid) from public, anon;
revoke execute on function public.has_dept_role(uuid, uuid, public.app_role[]) from public, anon;
grant execute on function public.user_org_ids() to authenticated;
grant execute on function public.has_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.is_direction(uuid) to authenticated;
grant execute on function public.is_internal(uuid) to authenticated;
grant execute on function public.has_dept_role(uuid, uuid, public.app_role[]) to authenticated;
