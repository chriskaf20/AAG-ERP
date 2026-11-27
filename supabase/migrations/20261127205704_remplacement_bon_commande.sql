alter table public.bons_commande
  add column bon_origine_id uuid,
  add column reliquat_annule_le timestamptz,
  add column mentions_emission jsonb,
  add constraint bons_commande_origine_fk foreign key (organization_id, bon_origine_id)
    references public.bons_commande (organization_id, id) on delete restrict,
  add constraint bons_commande_origine_distincte check (bon_origine_id <> id),
  add constraint bons_commande_remplacement_unique unique (organization_id, bon_origine_id);
alter table public.bons_commande drop constraint bons_commande_statut_check;
alter table public.bons_commande add constraint bons_commande_statut_check
  check (statut in ('brouillon', 'a_valider', 'valide', 'emis', 'recu_partiel', 'recu', 'annule', 'reliquat_annule')
    and (statut = 'reliquat_annule') = (reliquat_annule_le is not null));

-- Figer aussi les mentions reprises par le PDF pour les émissions suivantes.
create function public.tg_bon_mentions_emission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.emis_le is not null and old.mentions_emission is null then
    select jsonb_build_object(
      'org', jsonb_build_object(
        'nom', o.nom, 'sigle', o.sigle, 'rccm', o.rccm, 'nif', o.nif, 'id_nat', o.id_nat,
        'adresse', o.adresse, 'telephone', o.telephone, 'email', o.email),
      'fournisseur', jsonb_build_object(
        'raison_sociale', f.nom, 'rccm', f.rccm, 'nif', f.nif, 'contact', f.contact,
        'email', f.email, 'telephone', f.telephone, 'adresse', null, 'id_nat', null),
      'dossierNumero', d.numero
    ) into new.mentions_emission
    from public.organizations o
    join public.fournisseurs f on f.id = new.fournisseur_id and f.organization_id = o.id
    left join public.dossiers d on d.id = new.dossier_id and d.organization_id = o.id
    where o.id = new.organization_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.tg_bon_mentions_emission() from public, anon, authenticated, service_role;

create trigger bons_commande_mentions_emission before update of emis_le, reliquat_annule_le
  on public.bons_commande for each row execute function public.tg_bon_mentions_emission();

update public.bons_commande set emis_le = emis_le where emis_le is not null;

create function public.remplacer_bon_commande(p_org uuid, p_bon uuid, p_motif text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  bon public.bons_commande;
  remplacement uuid;
  ht numeric;
begin
  select * into bon from public.bons_commande b where b.id = p_bon and b.organization_id = p_org for update;
  if not found or not public.achat_autorise(p_org, bon.department_id, 'achats.write') then
    raise exception 'Remplacement réservé aux acheteurs habilités pour ce bon'
      using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(p_motif), '') is null then
    raise exception 'Motif d’annulation du reliquat obligatoire' using errcode = 'check_violation';
  end if;
  if bon.statut = 'reliquat_annule' and bon.motif_annulation = trim(p_motif) then
    select id into remplacement from public.bons_commande where organization_id = p_org and bon_origine_id = p_bon;
    if found then return remplacement; end if;
  end if;
  if bon.statut not in ('emis', 'recu_partiel') then
    raise exception 'Ce bon ne comporte aucun reliquat à remplacer' using errcode = 'check_violation';
  end if;

  insert into public.bons_commande(
    organization_id, bon_origine_id, fournisseur_id, department_id, dossier_id, objet,
    devise, taux_cdf, taxes, total_ht, total_ttc
  ) values (
    p_org, p_bon, bon.fournisseur_id, bon.department_id, bon.dossier_id, bon.objet,
    bon.devise, bon.taux_cdf, bon.taxes, 0, 0
  ) returning id into remplacement;

  insert into public.bon_commande_lignes(organization_id, bon_id, ordre, description, quantite, prix_unitaire)
  select p_org, remplacement, l.ordre, l.description, l.quantite - coalesce(r.recu, 0), l.prix_unitaire
  from public.bon_commande_lignes l
  left join (
    select ligne_id, sum(quantite) as recu
    from public.reception_achat_lignes where bon_id = p_bon group by ligne_id
  ) r on r.ligne_id = l.id
  where l.bon_id = p_bon and l.quantite > coalesce(r.recu, 0);
  if not found then
    raise exception 'Ce bon ne comporte aucun reliquat à remplacer' using errcode = 'check_violation';
  end if;

  select sum(round(quantite * prix_unitaire, 2)) into ht from public.bon_commande_lignes where bon_id = remplacement;
  update public.bons_commande set total_ht = ht, total_ttc = ht + public.calcul_taxes(ht, bon.taxes)
    where id = remplacement;
  update public.bons_commande set statut = 'reliquat_annule', reliquat_annule_le = clock_timestamp(),
    motif_annulation = trim(p_motif) where id = p_bon;
  return remplacement;
end;
$$;
revoke execute on function public.remplacer_bon_commande(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.remplacer_bon_commande(uuid, uuid, text) to authenticated;

create or replace function public.enregistrer_bon_commande(
  p_org uuid, p_fournisseur uuid, p_departement uuid, p_dossier uuid,
  p_objet text, p_devise public.devise, p_lignes jsonb, p_bon uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  bon public.bons_commande;
  ligne record;
  cfg jsonb;
  v_taxes jsonb;
  v_taux numeric;
  v_ht numeric := 0;
  v_id uuid;
begin
  if not public.achat_autorise(p_org, p_departement, 'achats.write') then
    raise exception 'Écriture réservée aux acheteurs habilités pour ce département' using errcode = 'insufficient_privilege';
  end if;
  if p_bon is not null then
    select * into bon from public.bons_commande b where b.id = p_bon and b.organization_id = p_org for update;
    if not found or not public.achat_autorise(p_org, bon.department_id, 'achats.write') then
      raise exception 'Bon de commande introuvable' using errcode = 'insufficient_privilege';
    end if;
    if bon.statut <> 'brouillon' then
      raise exception 'Seul un brouillon peut être modifié' using errcode = 'check_violation';
    end if;
  end if;
  if not exists (select 1 from public.departments where id = p_departement and organization_id = p_org)
    or (p_dossier is not null and not exists (
      select 1 from public.dossiers where id = p_dossier and organization_id = p_org and department_id = p_departement
    )) then
    raise exception 'Le dossier doit appartenir au département du bon et à son organisation' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.fournisseurs where id = p_fournisseur and organization_id = p_org and actif) then
    raise exception 'Sélectionnez un fournisseur actif de cette organisation' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Ajoutez au moins une ligne au bon de commande' using errcode = 'check_violation';
  end if;

  if bon.bon_origine_id is not null and (
    p_departement is distinct from bon.department_id or p_dossier is distinct from bon.dossier_id
    or (select jsonb_agg(jsonb_build_array(l.description, l.quantite) order by l.ordre)
        from public.bon_commande_lignes l where l.bon_id = p_bon)
      is distinct from (
        select jsonb_agg(jsonb_build_array(trim(x.valeur ->> 'description'),
          round((x.valeur ->> 'quantite')::numeric, 3)) order by x.ordre)
        from jsonb_array_elements(p_lignes) with ordinality as x(valeur, ordre)
      )
  ) then
    raise exception 'Un remplacement conserve le département, le dossier et les lignes du reliquat'
      using errcode = 'check_violation';
  end if;

  select parametres into cfg from public.organizations where id = p_org;
  v_taxes := coalesce(bon.taxes, cfg -> 'taxes', '[]'::jsonb);
  v_taux := case when p_devise = 'USD' then 1
             when bon.devise = p_devise then bon.taux_cdf
             else (cfg ->> 'taux_cdf')::numeric end;
  if v_taux is null or v_taux <= 0 then
    raise exception 'Configurez le taux USD/CDF de l’organisation' using errcode = 'check_violation';
  end if;

  v_id := coalesce(p_bon, gen_random_uuid());
  if p_bon is null then
    insert into public.bons_commande(id, organization_id, fournisseur_id, department_id, dossier_id, objet, devise, taux_cdf, taxes, total_ht, total_ttc)
    values (v_id, p_org, p_fournisseur, p_departement, p_dossier, trim(p_objet), p_devise, v_taux, v_taxes, 0, 0);
  else
    delete from public.bon_commande_lignes where bon_id = p_bon;
  end if;

  for ligne in
    select x.ordre::integer, trim(x.valeur ->> 'description') as description,
           round((x.valeur ->> 'quantite')::numeric, 3) as quantite,
           round((x.valeur ->> 'prix_unitaire')::numeric, 2) as prix_unitaire
    from jsonb_array_elements(p_lignes) with ordinality as x(valeur, ordre)
  loop
    insert into public.bon_commande_lignes(organization_id, bon_id, ordre, description, quantite, prix_unitaire)
    values (p_org, v_id, ligne.ordre, ligne.description, ligne.quantite, ligne.prix_unitaire);
    v_ht := v_ht + round(ligne.quantite * ligne.prix_unitaire, 2);
  end loop;

  update public.bons_commande set fournisseur_id = p_fournisseur, department_id = p_departement,
    dossier_id = p_dossier, objet = trim(p_objet), devise = p_devise, taux_cdf = v_taux, total_ht = v_ht,
    total_ttc = v_ht + public.calcul_taxes(v_ht, v_taxes)
  where id = v_id;
  return v_id;
end;
$$;
