-- Phase 3 — Réception tacite (contrat), garantie, avis client, paramètres,
-- arrondi des factures (solde exact au centime).

-- ---------------------------------------------------------------------------
-- Contrats : clause de réception tacite
-- ---------------------------------------------------------------------------
alter table public.contrats add column reception_tacite boolean not null default false;

-- ---------------------------------------------------------------------------
-- Dossiers : réception et garantie (renseignées par le changement de statut)
-- ---------------------------------------------------------------------------
alter table public.dossiers
  add column receptionne_le timestamptz,
  add column reception_tacite boolean not null default false,
  add column garantie_fin date;

create or replace function public.tg_dossiers_before_update()
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
      or new.statut_change_le is distinct from old.statut_change_le
      or new.receptionne_le is distinct from old.receptionne_le
      or new.reception_tacite is distinct from old.reception_tacite
      or new.garantie_fin is distinct from old.garantie_fin)
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

-- ---------------------------------------------------------------------------
-- Avis client (FP-04) : obligatoire avant la clôture
-- ---------------------------------------------------------------------------
create table public.avis_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null unique references public.dossiers (id) on delete cascade,
  note smallint not null check (note between 1 and 5),
  commentaire text,
  saisi_par uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index avis_clients_org_fk_idx on public.avis_clients (organization_id);
create index avis_clients_saisi_par_fk_idx on public.avis_clients (saisi_par);
create index avis_clients_created_by_fk_idx on public.avis_clients (created_by);

create trigger avis_clients_meta before insert or update on public.avis_clients
  for each row execute function public.tg_meta();

create function public.tg_avis_clients_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_statut public.dossier_statut;
begin
  select statut into v_statut from public.dossiers
   where id = coalesce(new.dossier_id, old.dossier_id)
     and organization_id = coalesce(new.organization_id, old.organization_id);
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Avis client : suppression interdite' using errcode = 'insufficient_privilege';
  end if;
  if v_statut <> 'receptionne_a_facturer' then
    raise exception 'L''avis client se saisit sur un dossier réceptionné, avant sa clôture'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.dossier_id is distinct from old.dossier_id then
    raise exception 'Dossier d''un avis immuable' using errcode = 'check_violation';
  end if;
  new.saisi_par := coalesce(auth.uid(), new.saisi_par);
  return new;
end;
$$;

create trigger avis_clients_guard before insert or update or delete on public.avis_clients
  for each row execute function public.tg_avis_clients_guard();

-- ---------------------------------------------------------------------------
-- Paramètres : délai de réception tacite, e-mail des points d'avancement
-- (désactivé et en simulation par défaut, réservé au gérant)
-- ---------------------------------------------------------------------------
update public.organizations
   set parametres = jsonb_build_object(
         'reception_tacite_jours', 7,
         'points_avancement_email_actifs', false,
         'points_avancement_email_mode', 'simulation') || parametres;

alter table public.organizations alter column parametres set default jsonb_build_object(
  'seuil_validation_usd', 5000,
  'acompte_pct', 30,
  'garantie_jours', 90,
  'taxes', jsonb_build_array(jsonb_build_object('code', 'TVA', 'libelle', 'TVA', 'taux', 16)),
  'devis_validite_jours', 30,
  'taux_cdf', 2800,
  'delai_paiement_jours', 15,
  'conditions_paiement', 'Acompte à la signature, solde à la réception.',
  'def_mode', 'manuel',
  'relances_actives', false,
  'relances_mode', 'simulation',
  'reception_tacite_jours', 7,
  'points_avancement_email_actifs', false,
  'points_avancement_email_mode', 'simulation'
);

alter table public.organizations add constraint points_avancement_parametres_valides check (
  (not (parametres ? 'points_avancement_email_actifs')
     or jsonb_typeof(parametres -> 'points_avancement_email_actifs') = 'boolean')
  and (not (parametres ? 'points_avancement_email_mode')
     or parametres ->> 'points_avancement_email_mode' in ('simulation', 'reel'))
  and (not (parametres ? 'reception_tacite_jours')
     or (jsonb_typeof(parametres -> 'reception_tacite_jours') = 'number'
         and (parametres ->> 'reception_tacite_jours')::numeric between 1 and 90))
);

create function public.tg_organizations_points_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and ((new.parametres -> 'points_avancement_email_actifs') is distinct from (old.parametres -> 'points_avancement_email_actifs')
          or (new.parametres -> 'points_avancement_email_mode') is distinct from (old.parametres -> 'points_avancement_email_mode'))
     and not public.has_role(new.id, array['gerant']::public.app_role[]) then
    raise exception 'Seul le gérant peut modifier l''envoi des points d''avancement par e-mail'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger organizations_points_email before update on public.organizations
  for each row execute function public.tg_organizations_points_email();

-- ---------------------------------------------------------------------------
-- Factures : arrondi (± 0,05 au plus), posé par le système uniquement
-- ---------------------------------------------------------------------------
alter table public.factures
  add column arrondi numeric(4, 2) not null default 0 check (abs(arrondi) <= 0.05);

create or replace function public.facture_totaux(f public.factures)
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
  f.total_ttc := f.total_ht + f.total_taxes + f.arrondi;
  return f;
end;
$$;

-- S'exécute avant factures_before (ordre alphabétique des déclencheurs)
create function public.tg_factures_arrondi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('atlas.finance_systeme', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.arrondi := 0;
    elsif new.arrondi is distinct from old.arrondi then
      new.arrondi := old.arrondi;
    end if;
  end if;
  return new;
end;
$$;

create trigger factures_arrondi before insert or update on public.factures
  for each row execute function public.tg_factures_arrondi();
