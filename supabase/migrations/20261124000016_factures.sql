-- Phase 2 — Factures (FAC-AAAA-NNN attribué à l'émission), avoirs (AV-AAAA-NNN),
-- normalisation DGI (e-DEF), structure de transmission DEF/SFE.

create type public.facture_type as enum ('acompte', 'solde', 'mensuelle');
create type public.facture_statut as enum (
  'brouillon', 'emise', 'normalisee', 'partiellement_payee', 'payee', 'en_retard', 'annulee'
);

create table public.factures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete restrict,
  devis_id uuid references public.devis (id) on delete restrict,
  type public.facture_type not null,
  numero text,
  statut public.facture_statut not null default 'brouillon',
  objet text,
  devise public.devise not null default 'USD',
  taux_cdf numeric(14, 4) not null default 1 check (taux_cdf > 0),
  taxes jsonb,
  delai_paiement_jours integer not null default 15 check (delai_paiement_jours >= 0),
  periode_debut date,
  periode_fin date,
  date_emission date,
  echeance date,
  total_brut numeric(14, 2) not null default 0,
  total_remise numeric(14, 2) not null default 0,
  total_ht numeric(14, 2) not null default 0,
  total_taxes numeric(14, 2) not null default 0,
  total_ttc numeric(14, 2) not null default 0,
  montant_paye numeric(14, 2) not null default 0,
  montant_avoirs numeric(14, 2) not null default 0,
  solde_du numeric(14, 2) generated always as (total_ttc - montant_paye - montant_avoirs) stored,
  emise_par uuid references public.profiles (id) on delete set null,
  emise_le timestamptz,
  -- Normalisation DGI (facture normalisée e-DEF)
  numero_facture_normalisee text,
  code_authentification_def text,
  qr_code text,
  normalisee_le timestamptz,
  normalisee_par uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, numero),
  check ((statut = 'brouillon') = (numero is null)),
  check (normalisee_le is null or (numero_facture_normalisee is not null and code_authentification_def is not null))
);

create index factures_dossier_idx on public.factures (dossier_id);
create index factures_statut_idx on public.factures (organization_id, statut);

create trigger factures_meta before insert or update on public.factures
  for each row execute function public.tg_meta();

create table public.facture_lignes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  facture_id uuid not null references public.factures (id) on delete cascade,
  ordre integer not null default 0,
  service_id uuid references public.services (id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  unite public.unite_service not null default 'forfait',
  quantite numeric(12, 2) not null default 1 check (quantite > 0),
  -- négatif autorisé : déduction des acomptes sur la facture de solde
  prix_unitaire numeric(14, 2) not null default 0,
  remise_pct numeric(5, 2) not null default 0 check (remise_pct between 0 and 100),
  montant_brut numeric(14, 2) generated always as (round(quantite * prix_unitaire, 2)) stored,
  montant_ht numeric(14, 2) generated always as (round(quantite * prix_unitaire * (1 - remise_pct / 100), 2)) stored,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index facture_lignes_facture_idx on public.facture_lignes (facture_id, ordre);

create trigger facture_lignes_meta before insert or update on public.facture_lignes
  for each row execute function public.tg_meta();

create table public.avoirs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  facture_id uuid not null references public.factures (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete restrict,
  numero text not null,
  date_avoir date not null default current_date,
  montant_ttc numeric(14, 2) not null check (montant_ttc > 0),
  motif text not null check (length(trim(motif)) > 0),
  numero_avoir_normalise text,
  code_authentification_def text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);

create index avoirs_facture_idx on public.avoirs (facture_id);

create trigger avoirs_meta before insert or update on public.avoirs
  for each row execute function public.tg_meta();

-- Journal des échanges avec la DGI (saisie manuelle aujourd'hui, API DEF/SFE plus tard)
create table public.def_transmissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  facture_id uuid references public.factures (id) on delete set null,
  avoir_id uuid references public.avoirs (id) on delete set null,
  mode text not null check (mode in ('manuel', 'api')),
  fournisseur text,
  requete jsonb,
  reponse jsonb,
  statut text not null check (statut in ('en_attente', 'acceptee', 'rejetee', 'erreur')),
  message text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger def_transmissions_meta before insert or update on public.def_transmissions
  for each row execute function public.tg_meta();

-- ---------------------------------------------------------------------------
-- Totaux et statut
-- ---------------------------------------------------------------------------
create function public.facture_totaux(f public.factures)
returns public.factures
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  select coalesce(sum(montant_brut), 0), coalesce(sum(montant_ht), 0)
    into f.total_brut, f.total_ht
  from public.facture_lignes where facture_id = f.id;
  f.total_remise := f.total_brut - f.total_ht;
  f.total_taxes := public.calcul_taxes(f.total_ht, f.taxes);
  f.total_ttc := f.total_ht + f.total_taxes;
  return f;
end;
$$;

-- Statut de paiement : annulée > payée > partiellement payée > en retard > normalisée > émise
create function public.facture_statut_calcule(f public.factures)
returns public.facture_statut
language sql
stable
set search_path = ''
as $$
  select case
    when f.statut = 'brouillon' then 'brouillon'::public.facture_statut
    when f.montant_avoirs >= f.total_ttc and f.montant_paye = 0 then 'annulee'
    when f.total_ttc - f.montant_paye - f.montant_avoirs <= 0 then 'payee'
    when f.montant_paye > 0 then 'partiellement_payee'
    when f.echeance < current_date then 'en_retard'
    when f.normalisee_le is not null then 'normalisee'
    else 'emise'
  end;
$$;

create function public.facture_recalculer(p_facture uuid)
returns public.factures
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.factures;
begin
  select * into f from public.factures where id = p_facture for update;
  f.montant_paye := coalesce((select sum(montant) from public.paiements where facture_id = p_facture), 0);
  f.montant_avoirs := coalesce((select sum(montant_ttc) from public.avoirs where facture_id = p_facture), 0);
  perform set_config('atlas.finance_systeme', 'on', true);
  update public.factures
     set montant_paye = f.montant_paye,
         montant_avoirs = f.montant_avoirs,
         statut = public.facture_statut_calcule(f)
   where id = p_facture
  returning * into f;
  perform set_config('atlas.finance_systeme', 'off', true);
  return f;
end;
$$;

revoke execute on function public.facture_recalculer(uuid) from public, anon, authenticated;

create function public.tg_factures_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
  v_systeme boolean := coalesce(current_setting('atlas.finance_systeme', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.statut <> 'brouillon' then
      raise exception 'Facture émise : suppression interdite (établissez un avoir)'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    select * into v_org from public.organizations where id = new.organization_id;
    if not exists (select 1 from public.dossiers where id = new.dossier_id and organization_id = new.organization_id) then
      raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    if new.devis_id is not null and not exists (
      select 1 from public.devis where id = new.devis_id and dossier_id = new.dossier_id) then
      raise exception 'Le devis n''appartient pas au dossier' using errcode = 'check_violation';
    end if;
    if not v_systeme and auth.uid() is not null then
      new.statut := 'brouillon';
      new.numero := null;
      new.date_emission := null; new.echeance := null; new.emise_par := null; new.emise_le := null;
      new.normalisee_le := null; new.normalisee_par := null;
      new.numero_facture_normalisee := null; new.code_authentification_def := null; new.qr_code := null;
    end if;
    new.montant_paye := 0;
    new.montant_avoirs := 0;
    new.taxes := coalesce(new.taxes, v_org.parametres -> 'taxes', '[]'::jsonb);
    new.delai_paiement_jours := coalesce((v_org.parametres ->> 'delai_paiement_jours')::integer, new.delai_paiement_jours);
    if new.devise = 'CDF' and new.taux_cdf = 1 then
      new.taux_cdf := coalesce((v_org.parametres ->> 'taux_cdf')::numeric, 1);
    end if;
    return public.facture_totaux(new);
  end if;

  if not v_systeme then
    if old.statut <> 'brouillon' then
      raise exception 'Facture émise : non modifiable (établissez un avoir)' using errcode = 'insufficient_privilege';
    end if;
    if new.statut is distinct from old.statut or new.numero is distinct from old.numero
       or new.date_emission is distinct from old.date_emission
       or new.normalisee_le is distinct from old.normalisee_le
       or new.montant_paye is distinct from old.montant_paye
       or new.montant_avoirs is distinct from old.montant_avoirs then
      raise exception 'Émission, paiements et normalisation passent par les fonctions dédiées'
        using errcode = 'insufficient_privilege';
    end if;
    if new.dossier_id is distinct from old.dossier_id then
      raise exception 'Dossier d''une facture immuable' using errcode = 'check_violation';
    end if;
  end if;

  if new.statut = 'brouillon' then
    new := public.facture_totaux(new);
  end if;
  return new;
end;
$$;

create trigger factures_before before insert or update or delete on public.factures
  for each row execute function public.tg_factures_before();

create function public.tg_facture_lignes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_facture uuid := coalesce(new.facture_id, old.facture_id);
begin
  if exists (select 1 from public.factures where id = v_facture and statut <> 'brouillon')
     and coalesce(current_setting('atlas.finance_systeme', true), '') <> 'on' then
    raise exception 'Facture émise : lignes non modifiables' using errcode = 'insufficient_privilege';
  end if;
  if tg_op <> 'DELETE' and not exists (
    select 1 from public.factures where id = new.facture_id and organization_id = new.organization_id) then
    raise exception 'Facture invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger facture_lignes_guard before insert or update or delete on public.facture_lignes
  for each row execute function public.tg_facture_lignes_guard();

create function public.tg_facture_lignes_after_ins()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.factures set updated_at = now()
   where id in (select facture_id from nouvelles) and statut = 'brouillon';
  return null;
end; $$;

create function public.tg_facture_lignes_after_del()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.factures set updated_at = now()
   where id in (select facture_id from anciennes) and statut = 'brouillon';
  return null;
end; $$;

create trigger facture_lignes_after_ins after insert on public.facture_lignes
  referencing new table as nouvelles
  for each statement execute function public.tg_facture_lignes_after_ins();
create trigger facture_lignes_after_upd after update on public.facture_lignes
  referencing new table as nouvelles
  for each statement execute function public.tg_facture_lignes_after_ins();
create trigger facture_lignes_after_del after delete on public.facture_lignes
  referencing old table as anciennes
  for each statement execute function public.tg_facture_lignes_after_del();

-- Avoirs : définitifs ; seules les références de normalisation peuvent être ajoutées une fois
create function public.tg_avoirs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Avoir : suppression interdite' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - array['numero_avoir_normalise', 'code_authentification_def', 'updated_at'])
       is distinct from (to_jsonb(old) - array['numero_avoir_normalise', 'code_authentification_def', 'updated_at'])
     or old.numero_avoir_normalise is not null then
    raise exception 'Avoir : définitif, non modifiable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger avoirs_guard before update or delete on public.avoirs
  for each row execute function public.tg_avoirs_guard();
