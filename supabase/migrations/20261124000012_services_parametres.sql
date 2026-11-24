-- Phase 2 — Catalogue de services, paramètres financiers, numérotation générique

create type public.unite_service as enum ('forfait', 'jour', 'mois', 'm2', 'course');

-- Paramètres financiers par défaut (organisations existantes et futures)
update public.organizations
   set parametres = jsonb_build_object(
         'taxes', jsonb_build_array(jsonb_build_object('code', 'TVA', 'libelle', 'TVA', 'taux', 16)),
         'devis_validite_jours', 30,
         'taux_cdf', 2800,
         'delai_paiement_jours', 15,
         'conditions_paiement', 'Acompte à la signature, solde à la réception.',
         'def_mode', 'manuel'
       ) || parametres
 where not (parametres ? 'taxes');

alter table public.organizations alter column parametres set default jsonb_build_object(
  'seuil_validation_usd', 5000,
  'acompte_pct', 30,
  'garantie_jours', 90,
  'taxes', jsonb_build_array(jsonb_build_object('code', 'TVA', 'libelle', 'TVA', 'taux', 16)),
  'devis_validite_jours', 30,
  'taux_cdf', 2800,
  'delai_paiement_jours', 15,
  'conditions_paiement', 'Acompte à la signature, solde à la réception.',
  'def_mode', 'manuel'
);

-- ---------------------------------------------------------------------------
-- Catalogue de services
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  nom text not null check (length(trim(nom)) > 0),
  description text,
  unite public.unite_service not null default 'forfait',
  prix_base_usd numeric(14, 2) not null default 0 check (prix_base_usd >= 0),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, nom)
);

create trigger services_meta before insert or update on public.services
  for each row execute function public.tg_meta();

-- ---------------------------------------------------------------------------
-- Compteurs génériques (DEV, FAC, REC, AV, CTR) par organisation et par année
-- ---------------------------------------------------------------------------
create table public.compteurs (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (type ~ '^[A-Z]{2,4}$'),
  annee integer not null,
  dernier integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, type, annee)
);

create trigger compteurs_meta before insert or update on public.compteurs
  for each row execute function public.tg_meta();

create function public.prochain_numero(p_org uuid, p_type text, p_date date default current_date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_annee integer := extract(year from p_date)::integer;
  v_num integer;
begin
  insert into public.compteurs as c (organization_id, type, annee, dernier)
  values (p_org, p_type, v_annee, 1)
  on conflict (organization_id, type, annee) do update set dernier = c.dernier + 1
  returning dernier into v_num;
  return p_type || '-' || v_annee || '-' || lpad(v_num::text, 3, '0');
end;
$$;

revoke execute on function public.prochain_numero(uuid, text, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Visibilité financière d'un dossier
--   direction (dont DAF) : tout ; responsable du département ; responsable du dossier.
--   Agents terrain, acheteurs, RH, clients : aucun accès.
-- ---------------------------------------------------------------------------
create function public.can_see_finance(p_dossier uuid)
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

-- Gestion financière (émission, encaissement, avoirs, normalisation)
create function public.is_finance(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_org, array['admin_systeme', 'gerant', 'daf']::public.app_role[]);
$$;

revoke execute on function public.can_see_finance(uuid) from public, anon;
revoke execute on function public.is_finance(uuid) from public, anon;
grant execute on function public.can_see_finance(uuid) to authenticated;
grant execute on function public.is_finance(uuid) to authenticated;

-- Taxes : somme des taxes paramétrées appliquées à un montant HT
create function public.calcul_taxes(p_ht numeric, p_taxes jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(round(p_ht * (t ->> 'taux')::numeric / 100, 2)), 0)
  from jsonb_array_elements(coalesce(p_taxes, '[]'::jsonb)) t;
$$;
