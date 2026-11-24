-- Phase 2 — Devis (DEV-AAAA-NNN), versions et lignes
-- Modifiable en brouillon / validé uniquement ; toute modification d'un devis
-- validé annule la validation. Envoyé ou signé : figé (nouvelle version).

create type public.devis_statut as enum (
  'brouillon', 'valide', 'envoye', 'signe', 'refuse', 'expire', 'remplace'
);

create table public.devis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  numero text not null default '',
  version integer not null default 1,
  version_precedente_id uuid references public.devis (id) on delete set null,
  statut public.devis_statut not null default 'brouillon',
  objet text,
  devise public.devise not null default 'USD',
  taux_cdf numeric(14, 4) not null default 1 check (taux_cdf > 0),
  taxes jsonb,
  acompte_pct numeric(5, 2) check (acompte_pct between 0 and 100),
  date_devis date not null default current_date,
  validite_jours integer not null default 30 check (validite_jours > 0),
  date_validite date,
  conditions_paiement text,
  total_brut numeric(14, 2) not null default 0,
  total_remise numeric(14, 2) not null default 0,
  total_ht numeric(14, 2) not null default 0,
  total_taxes numeric(14, 2) not null default 0,
  total_ttc numeric(14, 2) not null default 0,
  total_ttc_usd numeric(14, 2) not null default 0,
  depasse_seuil boolean not null default false,
  valide_par uuid references public.profiles (id) on delete set null,
  valide_le timestamptz,
  envoye_par uuid references public.profiles (id) on delete set null,
  envoye_le timestamptz,
  signe_le timestamptz,
  signature_id uuid,
  refuse_le timestamptz,
  motif_refus text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, numero, version)
);

create index devis_dossier_idx on public.devis (dossier_id);
create index devis_statut_idx on public.devis (organization_id, statut);

create trigger devis_meta before insert or update on public.devis
  for each row execute function public.tg_meta();

create table public.devis_lignes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  devis_id uuid not null references public.devis (id) on delete cascade,
  ordre integer not null default 0,
  service_id uuid references public.services (id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  unite public.unite_service not null default 'forfait',
  quantite numeric(12, 2) not null default 1 check (quantite > 0),
  prix_unitaire numeric(14, 2) not null default 0 check (prix_unitaire >= 0),
  remise_pct numeric(5, 2) not null default 0 check (remise_pct between 0 and 100),
  montant_brut numeric(14, 2) generated always as (round(quantite * prix_unitaire, 2)) stored,
  montant_ht numeric(14, 2) generated always as (round(quantite * prix_unitaire * (1 - remise_pct / 100), 2)) stored,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index devis_lignes_devis_idx on public.devis_lignes (devis_id, ordre);

create trigger devis_lignes_meta before insert or update on public.devis_lignes
  for each row execute function public.tg_meta();

-- ---------------------------------------------------------------------------
-- Totaux d'un devis (appelé par les triggers)
-- ---------------------------------------------------------------------------
create function public.devis_totaux(d public.devis)
returns public.devis
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seuil numeric;
begin
  select coalesce(sum(montant_brut), 0), coalesce(sum(montant_ht), 0)
    into d.total_brut, d.total_ht
  from public.devis_lignes where devis_id = d.id;

  d.total_remise := d.total_brut - d.total_ht;
  d.total_taxes := public.calcul_taxes(d.total_ht, d.taxes);
  d.total_ttc := d.total_ht + d.total_taxes;
  d.total_ttc_usd := case when d.devise = 'CDF' then round(d.total_ttc / d.taux_cdf, 2) else d.total_ttc end;

  select (parametres ->> 'seuil_validation_usd')::numeric into v_seuil
  from public.organizations where id = d.organization_id;
  d.depasse_seuil := d.total_ttc_usd > coalesce(v_seuil, 0);
  d.date_validite := d.date_devis + d.validite_jours;
  return d;
end;
$$;

create function public.tg_devis_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
  v_prec public.devis;
  v_systeme boolean := coalesce(current_setting('atlas.finance_systeme', true), '') = 'on';
  v_modifie boolean := coalesce(current_setting('atlas.devis_lignes_modifiees', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.statut <> 'brouillon' then
      raise exception 'Seul un devis brouillon peut être supprimé' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    select * into v_org from public.organizations where id = new.organization_id;
    if not exists (select 1 from public.dossiers d
                   where d.id = new.dossier_id and d.organization_id = new.organization_id) then
      raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    if auth.uid() is not null then
      if not exists (select 1 from public.dossiers d where d.id = new.dossier_id
                     and d.statut in ('accepte', 'devis_envoye', 'en_lancement', 'en_cours', 'livre', 'reserves')) then
        raise exception 'Un devis ne peut être établi que pour un dossier accepté'
          using errcode = 'check_violation';
      end if;
      if not v_systeme then
        new.statut := 'brouillon';
        new.valide_par := null; new.valide_le := null;
        new.envoye_par := null; new.envoye_le := null;
        new.signe_le := null; new.signature_id := null;
      end if;
    end if;

    if new.version_precedente_id is null then
      new.numero := public.prochain_numero(new.organization_id, 'DEV', new.date_devis);
      new.version := 1;
    else
      select * into v_prec from public.devis where id = new.version_precedente_id;
      if v_prec.id is null or v_prec.dossier_id <> new.dossier_id then
        raise exception 'Version précédente invalide' using errcode = 'check_violation';
      end if;
      new.numero := v_prec.numero;
      new.version := (select max(version) + 1 from public.devis
                      where organization_id = new.organization_id and numero = v_prec.numero);
    end if;

    new.taxes := coalesce(new.taxes, v_org.parametres -> 'taxes', '[]'::jsonb);
    new.acompte_pct := coalesce(new.acompte_pct, (v_org.parametres ->> 'acompte_pct')::numeric, 0);
    new.validite_jours := coalesce((v_org.parametres ->> 'devis_validite_jours')::integer, new.validite_jours);
    new.conditions_paiement := coalesce(new.conditions_paiement, v_org.parametres ->> 'conditions_paiement');
    if new.devise = 'CDF' and new.taux_cdf = 1 then
      new.taux_cdf := coalesce((v_org.parametres ->> 'taux_cdf')::numeric, 1);
    end if;
    return public.devis_totaux(new);
  end if;

  -- UPDATE
  if new.numero is distinct from old.numero or new.version is distinct from old.version
     or new.dossier_id is distinct from old.dossier_id then
    raise exception 'Numéro, version et dossier d''un devis sont immuables' using errcode = 'check_violation';
  end if;

  if not v_systeme then
    if old.statut not in ('brouillon', 'valide') then
      raise exception 'Devis % : non modifiable (créez une nouvelle version)', old.statut
        using errcode = 'insufficient_privilege';
    end if;
    if new.statut is distinct from old.statut
       or new.valide_par is distinct from old.valide_par or new.valide_le is distinct from old.valide_le
       or new.envoye_le is distinct from old.envoye_le or new.signe_le is distinct from old.signe_le
       or new.signature_id is distinct from old.signature_id then
      raise exception 'Le statut du devis ne change que via les fonctions dédiées'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  new := public.devis_totaux(new);

  -- Toute modification de contenu annule la validation du gérant
  if not v_systeme and old.statut = 'valide' and (
       v_modifie
       or (to_jsonb(new) - array['updated_at', 'total_brut', 'total_remise', 'total_ht', 'total_taxes',
                                 'total_ttc', 'total_ttc_usd', 'depasse_seuil', 'date_validite'])
          is distinct from
          (to_jsonb(old) - array['updated_at', 'total_brut', 'total_remise', 'total_ht', 'total_taxes',
                                 'total_ttc', 'total_ttc_usd', 'depasse_seuil', 'date_validite'])
       or new.total_ttc <> old.total_ttc) then
    new.statut := 'brouillon';
    new.valide_par := null;
    new.valide_le := null;
  end if;
  return new;
end;
$$;

create trigger devis_before before insert or update or delete on public.devis
  for each row execute function public.tg_devis_before();

-- Lignes : modifiables seulement si le devis est brouillon / validé
create function public.tg_devis_lignes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_devis uuid := coalesce(new.devis_id, old.devis_id);
  v_statut public.devis_statut;
begin
  select statut into v_statut from public.devis where id = v_devis;
  if v_statut is not null and v_statut not in ('brouillon', 'valide')
     and coalesce(current_setting('atlas.finance_systeme', true), '') <> 'on' then
    raise exception 'Devis % : lignes non modifiables (créez une nouvelle version)', v_statut
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op <> 'DELETE' and not exists (
    select 1 from public.devis where id = new.devis_id and organization_id = new.organization_id) then
    raise exception 'Devis invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger devis_lignes_guard before insert or update or delete on public.devis_lignes
  for each row execute function public.tg_devis_lignes_guard();


-- Triggers par instruction (tables de transition)
create function public.tg_devis_lignes_after_ins()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('atlas.devis_lignes_modifiees', 'on', true);
  update public.devis set updated_at = now() where id in (select devis_id from nouvelles);
  perform set_config('atlas.devis_lignes_modifiees', 'off', true);
  return null;
end; $$;

create function public.tg_devis_lignes_after_del()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('atlas.devis_lignes_modifiees', 'on', true);
  update public.devis set updated_at = now() where id in (select devis_id from anciennes);
  perform set_config('atlas.devis_lignes_modifiees', 'off', true);
  return null;
end; $$;


create trigger devis_lignes_after_ins after insert on public.devis_lignes
  referencing new table as nouvelles
  for each statement execute function public.tg_devis_lignes_after_ins();
create trigger devis_lignes_after_upd after update on public.devis_lignes
  referencing new table as nouvelles
  for each statement execute function public.tg_devis_lignes_after_ins();
create trigger devis_lignes_after_del after delete on public.devis_lignes
  referencing old table as anciennes
  for each statement execute function public.tg_devis_lignes_after_del();
