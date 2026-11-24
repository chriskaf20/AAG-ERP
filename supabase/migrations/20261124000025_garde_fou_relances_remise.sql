-- Phase 2 — Garde-fous des relances et remise des factures au client

-- ---------------------------------------------------------------------------
-- Paramètres : relances désactivées et en simulation par défaut
-- ---------------------------------------------------------------------------
update public.organizations
   set parametres = parametres || jsonb_build_object('relances_actives', false, 'relances_mode', 'simulation')
 where not (parametres ? 'relances_actives');

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
  'relances_mode', 'simulation'
);

alter table public.organizations add constraint relances_parametres_valides check (
  (not (parametres ? 'relances_actives') or jsonb_typeof(parametres -> 'relances_actives') = 'boolean')
  and (not (parametres ? 'relances_mode') or parametres ->> 'relances_mode' in ('simulation', 'reel'))
);

-- Seul le gérant peut activer / désactiver les relances ou changer leur mode
create function public.tg_organizations_relances()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and ((new.parametres -> 'relances_actives') is distinct from (old.parametres -> 'relances_actives')
          or (new.parametres -> 'relances_mode') is distinct from (old.parametres -> 'relances_mode'))
     and not public.has_role(new.id, array['gerant']::public.app_role[]) then
    raise exception 'Seul le gérant peut modifier les relances automatiques' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger organizations_relances before update on public.organizations
  for each row execute function public.tg_organizations_relances();

-- Relances simulées : tracées sans envoi
alter table public.relances drop constraint relances_statut_check;
alter table public.relances add constraint relances_statut_check check (statut in ('envoyee', 'echec', 'simulee'));
create unique index relances_unique_simulee on public.relances (objet_type, objet_id, niveau)
  where statut = 'simulee';

-- ---------------------------------------------------------------------------
-- relances_a_envoyer : organisations actives uniquement, jamais d'adresse en .test,
-- indicateur de simulation, pas de doublon avec une relance déjà envoyée ou simulée.
-- ---------------------------------------------------------------------------
create or replace function public.relances_a_envoyer()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb := '[]'::jsonb;
  r record;
  v_token text;
begin
  for r in
    select d.id, d.organization_id, d.dossier_id, d.numero, d.version, d.total_ttc, d.devise, d.date_validite,
           o.nom as org_nom, o.email as org_email, ds.numero as dossier_numero,
           (o.parametres ->> 'relances_mode') is distinct from 'reel' as simulation,
           x.email, x.destinataire_nom
      from public.devis d
      join public.organizations o on o.id = d.organization_id
      join public.dossiers ds on ds.id = d.dossier_id
      join public.clients c on c.id = ds.client_id
      left join public.contacts ct on ct.id = ds.contact_id
      cross join lateral (select coalesce(ct.email, c.email) as email,
                                 coalesce(ct.nom, c.raison_sociale) as destinataire_nom) x
     where coalesce((o.parametres ->> 'relances_actives')::boolean, false)
       and x.email is not null and lower(x.email) not like '%.test'
       and d.statut = 'envoye' and d.envoye_le <= now() - interval '7 days'
       and d.date_validite >= current_date
       and not exists (select 1 from public.relances rl
                        where rl.objet_type = 'devis' and rl.objet_id = d.id and rl.statut in ('envoyee', 'simulee'))
  loop
    v_token := case when not r.simulation then
      public.creer_lien_signature('devis', r.id, r.dossier_id, r.organization_id, (r.date_validite + 1)::timestamptz) end;
    v_res := v_res || jsonb_build_object(
      'objet_type', 'devis', 'objet_id', r.id, 'niveau', 'j7', 'organization_id', r.organization_id,
      'dossier_id', r.dossier_id, 'dossier_numero', r.dossier_numero, 'numero', r.numero || ' v' || r.version,
      'montant', r.total_ttc, 'devise', r.devise, 'echeance', r.date_validite,
      'email', r.email, 'destinataire_nom', r.destinataire_nom, 'simulation', r.simulation,
      'org_nom', r.org_nom, 'org_email', r.org_email, 'token', v_token);
  end loop;

  for r in
    select y.* from (
      select f.id, f.organization_id, f.dossier_id, f.numero, f.solde_du, f.devise, f.echeance,
             f.numero_facture_normalisee,
             o.nom as org_nom, o.email as org_email, ds.numero as dossier_numero,
             (o.parametres ->> 'relances_mode') is distinct from 'reel' as simulation,
             coalesce((o.parametres ->> 'relances_actives')::boolean, false) as actives,
             coalesce(ct.email, c.email) as email, coalesce(ct.nom, c.raison_sociale) as destinataire_nom,
             case when current_date >= f.echeance + 30 then 'j30'
                  when current_date >= f.echeance + 15 then 'j15'
                  when current_date >= f.echeance + 7 then 'j7' end::public.relance_niveau as niveau
        from public.factures f
        join public.organizations o on o.id = f.organization_id
        join public.dossiers ds on ds.id = f.dossier_id
        join public.clients c on c.id = ds.client_id
        left join public.contacts ct on ct.id = ds.contact_id
       where f.statut in ('emise', 'normalisee', 'partiellement_payee', 'en_retard')
         and f.solde_du > 0 and f.echeance + 7 <= current_date
    ) y
    where y.actives
      and y.email is not null and lower(y.email) not like '%.test'
      and not exists (select 1 from public.relances rl
                       where rl.objet_type = 'facture' and rl.objet_id = y.id
                         and rl.statut in ('envoyee', 'simulee') and rl.niveau >= y.niveau)
  loop
    v_res := v_res || jsonb_build_object(
      'objet_type', 'facture', 'objet_id', r.id, 'niveau', r.niveau, 'organization_id', r.organization_id,
      'dossier_id', r.dossier_id, 'dossier_numero', r.dossier_numero,
      'numero', coalesce(r.numero_facture_normalisee, r.numero),
      'montant', r.solde_du, 'devise', r.devise, 'echeance', r.echeance,
      'email', r.email, 'destinataire_nom', r.destinataire_nom, 'simulation', r.simulation,
      'org_nom', r.org_nom, 'org_email', r.org_email, 'token', null);
  end loop;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- Remise de la facture au client (la facture de solde doit être normalisée)
-- ---------------------------------------------------------------------------
alter table public.factures
  add column remise_client_le timestamptz,
  add column remise_client_par uuid references public.profiles (id) on delete set null;

create function public.marquer_facture_remise(p_facture uuid)
returns public.factures
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.factures;
begin
  select * into f from public.factures where id = p_facture for update;
  if not found or not (public.is_finance(f.organization_id) or public.can_edit_dossier(f.dossier_id)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if f.statut in ('brouillon', 'annulee') then
    raise exception 'Facture % : remise impossible', f.statut using errcode = 'check_violation';
  end if;
  if f.remise_client_le is not null then
    raise exception 'Facture déjà remise au client' using errcode = 'check_violation';
  end if;
  if f.type = 'solde' and f.normalisee_le is null then
    raise exception 'Facture de solde : normalisation e-DEF requise avant la remise au client'
      using errcode = 'check_violation';
  end if;
  perform set_config('atlas.finance_systeme', 'on', true);
  update public.factures set remise_client_le = clock_timestamp(), remise_client_par = auth.uid()
   where id = f.id returning * into f;
  perform set_config('atlas.finance_systeme', 'off', true);
  return f;
end;
$$;

revoke execute on function public.marquer_facture_remise(uuid) from public, anon;
grant execute on function public.marquer_facture_remise(uuid) to authenticated;

-- La remise ne passe que par marquer_facture_remise()
create or replace function public.tg_factures_remise_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.remise_client_le is distinct from old.remise_client_le
      or new.remise_client_par is distinct from old.remise_client_par)
     and coalesce(current_setting('atlas.finance_systeme', true), '') <> 'on' then
    raise exception 'La remise au client passe par marquer_facture_remise()' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger factures_remise_guard before update on public.factures
  for each row execute function public.tg_factures_remise_guard();
