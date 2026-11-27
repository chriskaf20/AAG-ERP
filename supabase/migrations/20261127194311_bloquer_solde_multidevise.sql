-- Sécurité du solde : une seule devise tant qu'aucun taux de rapprochement n'est validé.
create function public.verifier_devise_solde(p_dossier uuid, p_devise public.devise)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.factures f
    where f.dossier_id = p_dossier and f.statut not in ('brouillon', 'annulee')
      and f.devise <> p_devise and f.total_ttc <> f.montant_avoirs
  ) or exists (
    select 1 from public.avenants a
    join public.contrats c on c.id = a.contrat_id
    where c.dossier_id = p_dossier and a.statut = 'signe'
      and c.devise <> p_devise and a.montant_delta <> 0
  ) or exists (
    select 1 from public.devis d
    where d.id = (select ds.id from public.devis ds
                   where ds.dossier_id = p_dossier and ds.statut = 'signe'
                   order by ds.signe_le desc nulls last, ds.id desc limit 1)
      and d.devise <> p_devise
  ) then
    raise exception 'Solde bloqué : le dossier combine des montants en USD et en CDF. Aucun taux de conversion du solde n''a été validé.'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.verifier_devise_solde(uuid, public.devise) from public, anon, authenticated, service_role;

create or replace function public.generer_facture_solde(p_dossier uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
  f public.factures;
  r record;
  v_total numeric;
  v_deja numeric;
  v_solde numeric;
  v_k numeric;
  v_correction_ht numeric;
  v_id uuid;
  v_ordre integer := 1;
begin
  perform 1 from public.dossiers where id = p_dossier for update;
  select * into d from public.devis
   where dossier_id = p_dossier and statut = 'signe'
   order by signe_le desc nulls last, id desc limit 1;
  if not found then return null; end if;
  if exists (select 1 from public.factures
              where dossier_id = p_dossier and type = 'solde' and statut not in ('brouillon', 'annulee')) then
    return null;
  end if;
  perform public.verifier_devise_solde(p_dossier, d.devise);
  select id into v_id from public.factures
   where dossier_id = p_dossier and type = 'solde' and statut = 'brouillon'
   order by created_at, id limit 1 for update;

  v_total := d.total_ttc + coalesce((
    select sum(a.montant_delta) from public.avenants a
    join public.contrats c on c.id = a.contrat_id
    where c.dossier_id = p_dossier and c.devise = d.devise and a.statut = 'signe'), 0);
  v_deja := coalesce((
    select sum(total_ttc - montant_avoirs) from public.factures
     where dossier_id = p_dossier and devise = d.devise and statut not in ('brouillon', 'annulee')), 0);
  v_solde := round(v_total - v_deja, 2);
  if v_solde <= 0 then
    delete from public.factures where id = v_id;
    return null;
  end if;

  select 1 + coalesce(sum((t ->> 'taux')::numeric), 0) / 100 into v_k
    from jsonb_array_elements(d.taxes) t;

  perform set_config('atlas.finance_systeme', 'on', true);
  if v_id is null then
    insert into public.factures (organization_id, dossier_id, devis_id, type, objet, devise, taux_cdf, taxes)
    values (d.organization_id, d.dossier_id, d.id, 'solde', 'Solde — ' || coalesce(d.objet, d.numero),
            d.devise, d.taux_cdf, d.taxes)
    returning id into v_id;
  else
    delete from public.facture_lignes where facture_id = v_id;
    update public.factures set devis_id = d.id, devise = d.devise, taux_cdf = d.taux_cdf, taxes = d.taxes, arrondi = 0
     where id = v_id;
  end if;

  insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
  values (d.organization_id, v_id, 1, 'Montant total du devis ' || d.numero || ' v' || d.version, 1, d.total_ht);

  for r in select a.numero, a.objet, a.montant_delta from public.avenants a
            join public.contrats c on c.id = a.contrat_id
            where c.dossier_id = p_dossier and c.devise = d.devise and a.statut = 'signe' and a.montant_delta <> 0
            order by a.signe_le, a.numero loop
    v_ordre := v_ordre + 1;
    insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
    values (d.organization_id, v_id, v_ordre, 'Avenant ' || r.numero || ' — ' || r.objet, 1,
            round(r.montant_delta / v_k, 2));
  end loop;

  for r in select numero, total_ttc, montant_avoirs from public.factures
            where dossier_id = p_dossier and devise = d.devise and statut not in ('brouillon', 'annulee')
              and total_ttc - montant_avoirs <> 0
            order by numero loop
    v_ordre := v_ordre + 1;
    insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
    values (d.organization_id, v_id, v_ordre,
            'Déduction facture ' || r.numero || case when r.montant_avoirs > 0 then ' (nette d''avoirs)' else '' end,
            1,
            -round((r.total_ttc - r.montant_avoirs) / v_k, 2));
  end loop;

  -- Arrondi : le TTC de la facture doit être exactement le solde calculé
  select * into f from public.factures where id = v_id;
  if abs(v_solde - f.total_ttc) > 0.05 then
    v_correction_ht := round((v_solde - f.total_ttc) / v_k, 2);
    insert into public.facture_lignes (organization_id, facture_id, ordre, description, prix_unitaire)
    values (d.organization_id, v_id, v_ordre + 1, 'Ajustement d''arrondi des lignes', v_correction_ht);
    select * into f from public.factures where id = v_id;
  end if;
  if f.total_ttc <> v_solde then
    update public.factures set arrondi = v_solde - f.total_ttc where id = v_id;
  end if;
  perform set_config('atlas.finance_systeme', 'off', true);
  return v_id;
end;
$$;

create or replace function public.emettre_facture(p_facture uuid)
returns public.factures
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.factures;
begin
  select * into f from public.factures where id = p_facture;
  if not found or not public.can_see_finance(f.dossier_id) then
    raise exception 'Facture introuvable' using errcode = 'no_data_found';
  end if;
  if not public.is_finance(f.organization_id) then
    raise exception 'Émission réservée au DAF, au gérant ou à l''administrateur' using errcode = 'insufficient_privilege';
  end if;
  -- Même ordre de verrouillage que la génération du solde.
  perform 1 from public.dossiers where id = f.dossier_id for update;
  select * into f from public.factures where id = p_facture for update;
  if not found then
    raise exception 'Facture introuvable' using errcode = 'no_data_found';
  end if;
  if f.statut <> 'brouillon' then
    raise exception 'Facture déjà émise' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.facture_lignes where facture_id = f.id) or f.total_ttc <= 0 then
    raise exception 'Facture vide ou de montant nul' using errcode = 'check_violation';
  end if;
  if f.type = 'solde' then
    perform public.verifier_devise_solde(f.dossier_id, f.devise);
  end if;
  if f.type = 'solde' and exists (
    select 1 from public.factures
     where dossier_id = f.dossier_id and id <> f.id
       and statut not in ('brouillon', 'annulee') and normalisee_le is null) then
    raise exception 'Facture de solde : les factures précédentes du dossier doivent être normalisées (e-DEF)'
      using errcode = 'check_violation';
  end if;

  perform set_config('atlas.finance_systeme', 'on', true);
  update public.factures
     set numero = public.prochain_numero(f.organization_id, 'FAC'),
         statut = 'emise',
         date_emission = current_date,
         echeance = current_date + f.delai_paiement_jours,
         emise_par = auth.uid(),
         emise_le = clock_timestamp()
   where id = f.id;
  perform set_config('atlas.finance_systeme', 'off', true);
  f := public.facture_recalculer(f.id);
  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (f.organization_id, 'factures', f.id, 'STATUT',
          jsonb_build_object('statut', f.statut, 'numero', f.numero, 'total_ttc', f.total_ttc), auth.uid());
  return f;
end;
$$;
