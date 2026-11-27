create table public.stock_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 50),
  nom text not null check (length(trim(nom)) between 1 and 200),
  unite text not null check (length(trim(unite)) between 1 and 30),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.stock_emplacements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nom text not null check (length(trim(nom)) between 1 and 120),
  par_defaut boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index stock_articles_code_unique on public.stock_articles(organization_id, lower(trim(code)));
create unique index stock_emplacements_nom_unique on public.stock_emplacements(organization_id, lower(trim(nom)));
create unique index stock_emplacements_defaut_unique on public.stock_emplacements(organization_id) where par_defaut;

insert into public.stock_emplacements (organization_id, nom, par_defaut)
select id, 'Principal', true from public.organizations;

create function public.tg_stock_emplacement_initial()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.stock_emplacements(organization_id, nom, par_defaut) values (new.id, 'Principal', true);
  return new;
end;
$$;
revoke execute on function public.tg_stock_emplacement_initial() from public, anon, authenticated, service_role;
create trigger organizations_stock_emplacement after insert on public.organizations
  for each row execute function public.tg_stock_emplacement_initial();

create table public.stock_quantites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  article_id uuid not null,
  emplacement_id uuid not null,
  quantite numeric(18,3) not null default 0 check (quantite >= 0 and quantite < 'Infinity'::numeric),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, article_id, emplacement_id),
  foreign key (organization_id, article_id) references public.stock_articles(organization_id,id) on delete restrict,
  foreign key (organization_id, emplacement_id) references public.stock_emplacements(organization_id,id) on delete restrict
);

create table public.stock_mouvements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  article_id uuid not null,
  emplacement_id uuid not null,
  type text not null,
  quantite numeric(18,3) not null check (abs(quantite) > 0 and abs(quantite) < 'Infinity'::numeric),
  motif text check (length(motif) <= 500),
  reception_ligne_id uuid unique references public.reception_achat_lignes(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (organization_id, article_id) references public.stock_articles(organization_id,id) on delete restrict,
  foreign key (organization_id, emplacement_id) references public.stock_emplacements(organization_id,id) on delete restrict,
  check (
    (type = 'reception' and reception_ligne_id is not null and quantite > 0)
    or (type = 'sortie' and reception_ligne_id is null and quantite < 0)
    or (type = 'ajustement' and reception_ligne_id is null and nullif(trim(motif), '') is not null)
  )
);

create index stock_quantites_emplacement_idx on public.stock_quantites(organization_id, emplacement_id);
create index stock_mouvements_article_idx on public.stock_mouvements(organization_id, article_id, created_at);
create index stock_mouvements_emplacement_idx on public.stock_mouvements(organization_id, emplacement_id);

do $$
declare tbl text;
begin
  foreach tbl in array array['stock_articles', 'stock_emplacements', 'stock_quantites', 'stock_mouvements'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from anon, authenticated', tbl);
    execute format('grant select on public.%I to authenticated', tbl);
    execute format($p$create policy stock_lire on public.%I for select to authenticated
      using (public.has_permission(organization_id, 'achats.read')
        or public.has_permission(organization_id, 'achats.write'))$p$, tbl);
    execute format('create trigger stock_meta before insert or update on public.%I
      for each row execute function public.tg_meta()', tbl);
    if tbl <> 'stock_quantites' then
      execute format('create trigger audit after insert or update or delete on public.%I
        for each row execute function public.tg_audit()', tbl);
    end if;
  end loop;
end;
$$;

grant insert (organization_id, code, nom, unite) on public.stock_articles to authenticated;
grant insert (organization_id, nom) on public.stock_emplacements to authenticated;
create policy stock_catalogue_ajouter on public.stock_articles for insert to authenticated
  with check (public.has_permission(organization_id, 'achats.write'));
create policy stock_emplacement_ajouter on public.stock_emplacements for insert to authenticated
  with check (public.has_permission(organization_id, 'achats.write'));

create function public.stock_choisir_emplacement_defaut(p_org uuid, p_emplacement uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_org, array['gerant']::public.app_role[])
     or not public.has_permission(p_org, 'achats.write') then
    raise exception 'Choix de l’emplacement par défaut réservé au gérant' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from public.organizations where id = p_org for no key update;
  if not exists (select 1 from public.stock_emplacements where id = p_emplacement and organization_id = p_org) then
    raise exception 'Emplacement introuvable pour cette organisation' using errcode = 'check_violation';
  end if;
  update public.stock_emplacements set par_defaut = false
    where organization_id = p_org and par_defaut and id <> p_emplacement;
  update public.stock_emplacements set par_defaut = true
    where organization_id = p_org and id = p_emplacement and not par_defaut;
end;
$$;
revoke execute on function public.stock_choisir_emplacement_defaut(uuid, uuid) from public, anon, service_role;
grant execute on function public.stock_choisir_emplacement_defaut(uuid, uuid) to authenticated;

create function public.tg_stock_mettre_a_jour_quantites()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.stock_quantites(organization_id, article_id, emplacement_id)
  values (new.organization_id,new.article_id,new.emplacement_id)
  on conflict (organization_id,article_id,emplacement_id) do nothing;
  update public.stock_quantites set quantite = quantite + new.quantite
   where organization_id = new.organization_id and article_id = new.article_id and emplacement_id = new.emplacement_id
     and quantite + new.quantite >= 0;
  if not found then
    raise exception 'Quantité insuffisante à cet emplacement' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.tg_stock_mettre_a_jour_quantites() from public, anon, authenticated, service_role;
create trigger stock_mettre_a_jour_quantites after insert on public.stock_mouvements
  for each row execute function public.tg_stock_mettre_a_jour_quantites();

create function public.stock_mouvement(
  p_org uuid, p_operation uuid, p_article uuid, p_emplacement uuid, p_type text, p_quantite numeric, p_motif text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existant public.stock_mouvements;
  delta numeric := round(p_quantite, 3);
  motif_normalise text := nullif(trim(p_motif), '');
begin
  if not public.has_permission(p_org, 'achats.write') then
    raise exception 'Mouvement réservé aux utilisateurs autorisés à gérer les achats' using errcode = 'insufficient_privilege';
  end if;
  if p_operation is null or not coalesce(
    (p_type = 'sortie' and delta < 0) or (p_type = 'ajustement' and delta <> 0 and motif_normalise is not null), false
  ) or abs(delta) >= 'Infinity'::numeric then
    raise exception 'Indiquez une quantité valide et motivez tout ajustement' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.stock_articles where organization_id = p_org and id = p_article)
     or not exists (select 1 from public.stock_emplacements where organization_id = p_org and id = p_emplacement) then
    raise exception 'Choisissez un article et un emplacement de cette organisation' using errcode = 'check_violation';
  end if;

  insert into public.stock_mouvements(id, organization_id, article_id, emplacement_id, type, quantite, motif)
  values (p_operation,p_org,p_article,p_emplacement,p_type,delta,motif_normalise)
  on conflict (id) do nothing;
  if not found then
    select * into existant from public.stock_mouvements where id = p_operation and organization_id = p_org;
    if not found or (existant.article_id, existant.emplacement_id, existant.type, existant.quantite, existant.motif)
      is distinct from (p_article,p_emplacement,p_type,delta,motif_normalise) then
      raise exception 'Ce mouvement est déjà enregistré avec un autre contenu' using errcode = 'check_violation';
    end if;
  end if;
  return p_operation;
end;
$$;
revoke execute on function public.stock_mouvement(uuid, uuid, uuid, uuid, text, numeric, text) from public, anon, service_role;
grant execute on function public.stock_mouvement(uuid, uuid, uuid, uuid, text, numeric, text) to authenticated;

alter table public.bon_commande_lignes add column article_id uuid,
  add constraint bon_commande_lignes_article_fk foreign key (organization_id, article_id)
    references public.stock_articles(organization_id,id) on delete restrict;
create index bon_commande_lignes_article_idx on public.bon_commande_lignes(organization_id, article_id);
alter table public.receptions_achat add column emplacement_id uuid,
  add constraint receptions_achat_emplacement_fk foreign key (organization_id, emplacement_id)
    references public.stock_emplacements(organization_id,id) on delete restrict;
create index receptions_achat_emplacement_idx on public.receptions_achat(organization_id, emplacement_id);

create function public.tg_stock_entree_reception()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.stock_mouvements(organization_id, article_id, emplacement_id, type, quantite, reception_ligne_id)
  select new.organization_id,l.article_id,r.emplacement_id,'reception',new.quantite,new.id
  from public.bon_commande_lignes l
  join public.receptions_achat r on r.id = new.reception_id and r.organization_id = new.organization_id
  where l.id = new.ligne_id and l.organization_id = new.organization_id and l.article_id is not null;
  return new;
end;
$$;
revoke execute on function public.tg_stock_entree_reception() from public, anon, authenticated, service_role;
create trigger stock_entree_reception after insert on public.reception_achat_lignes
  for each row execute function public.tg_stock_entree_reception();

create or replace function public.remplacer_bon_commande(p_org uuid, p_bon uuid, p_motif text)
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

  insert into public.bon_commande_lignes(organization_id, bon_id, ordre, description, quantite, prix_unitaire, article_id)
  select p_org, remplacement, l.ordre, l.description, l.quantite - coalesce(r.recu, 0), l.prix_unitaire, l.article_id
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
    or (select jsonb_agg(jsonb_build_array(l.description, l.quantite, l.article_id) order by l.ordre)
        from public.bon_commande_lignes l where l.bon_id = p_bon)
      is distinct from (
        select jsonb_agg(jsonb_build_array(trim(x.valeur ->> 'description'),
          round((x.valeur ->> 'quantite')::numeric, 3), nullif(x.valeur ->> 'article_id', '')::uuid) order by x.ordre)
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
           round((x.valeur ->> 'prix_unitaire')::numeric, 2) as prix_unitaire,
           nullif(x.valeur ->> 'article_id', '')::uuid as article_id
    from jsonb_array_elements(p_lignes) with ordinality as x(valeur, ordre)
  loop
    if ligne.article_id is not null and not exists
      (select 1 from public.stock_articles where organization_id = p_org and id = ligne.article_id) then
      raise exception 'Choisissez un article de cette organisation' using errcode = 'check_violation';
    end if;
    insert into public.bon_commande_lignes(organization_id, bon_id, ordre, description, quantite, prix_unitaire, article_id)
    values (p_org, v_id, ligne.ordre, ligne.description, ligne.quantite, ligne.prix_unitaire, ligne.article_id);
    v_ht := v_ht + round(ligne.quantite * ligne.prix_unitaire, 2);
  end loop;

  update public.bons_commande set fournisseur_id = p_fournisseur, department_id = p_departement,
    dossier_id = p_dossier, objet = trim(p_objet), devise = p_devise, taux_cdf = v_taux, total_ht = v_ht,
    total_ttc = v_ht + public.calcul_taxes(v_ht, v_taxes)
  where id = v_id;
  return v_id;
end;
$$;

drop function public.receptionner_achat(uuid, uuid, uuid, date, text, text, jsonb);

create function public.receptionner_achat(
  p_org uuid, p_bon uuid, p_operation uuid, p_date date, p_reference text, p_observations text, p_lignes jsonb,
  p_emplacement uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  bon public.bons_commande;
  ancienne public.receptions_achat;
  ligne record;
  demande jsonb;
  enregistree jsonb;
  restant numeric;
  emplacement uuid;
begin
  select * into bon from public.bons_commande b where b.id = p_bon and b.organization_id = p_org for update;
  if not found or not public.achat_autorise(p_org, bon.department_id, 'achats.write') then
    raise exception 'Réception réservée aux acheteurs habilités pour cette commande' using errcode = 'insufficient_privilege';
  end if;
  if p_operation is null or p_date is null or jsonb_typeof(p_lignes) is distinct from 'array' then
    raise exception 'Indiquez une date et les quantités reçues' using errcode = 'check_violation';
  end if;

  select jsonb_object_agg(ligne_id, round(quantite, 3)) into demande
    from jsonb_to_recordset(p_lignes) as l(ligne_id uuid, quantite numeric);
  if demande is null or (select count(*) from jsonb_object_keys(demande)) <> jsonb_array_length(p_lignes) then
    raise exception 'Indiquez une seule quantité par ligne réceptionnée' using errcode = 'check_violation';
  end if;
  select * into ancienne from public.receptions_achat where id = p_operation and bon_id = p_bon and organization_id = p_org;
  if found then
    select jsonb_object_agg(ligne_id, quantite) into enregistree from public.reception_achat_lignes where reception_id = p_operation;
    if (p_emplacement is not null and ancienne.emplacement_id is distinct from p_emplacement)
       or ancienne.date_reception is distinct from p_date or ancienne.reference is distinct from nullif(trim(p_reference), '')
       or ancienne.observations is distinct from nullif(trim(p_observations), '') or enregistree is distinct from demande then
      raise exception 'Cette réception a déjà été enregistrée avec un autre contenu. Rechargez le bon.' using errcode = 'check_violation';
    end if;
    return ancienne.id;
  end if;
  if bon.statut not in ('emis', 'recu_partiel') then
    raise exception 'Réception possible seulement sur un bon émis avec des quantités restantes' using errcode = 'check_violation';
  end if;

  select e.id into emplacement from public.stock_emplacements e where e.organization_id = p_org
    and case when p_emplacement is null then e.par_defaut else e.id = p_emplacement end;
  if not found then
    raise exception 'Emplacement de réception invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  insert into public.receptions_achat(id, organization_id, bon_id, date_reception, reference, observations, emplacement_id)
  values (p_operation, p_org, p_bon, p_date, nullif(trim(p_reference), ''), nullif(trim(p_observations), ''), emplacement);
  for ligne in
    select x.key::uuid as id, x.value::numeric as quantite from jsonb_each_text(demande) x
    left join public.bon_commande_lignes l on l.id = x.key::uuid and l.bon_id = p_bon
    order by l.article_id, x.key
  loop
    select l.quantite - coalesce((
      select sum(r.quantite) from public.reception_achat_lignes r where r.bon_id = p_bon and r.ligne_id = l.id
    ), 0) into restant from public.bon_commande_lignes l where l.bon_id = p_bon and l.id = ligne.id;
    if restant is null or ligne.quantite is null or ligne.quantite <= 0 or ligne.quantite > restant then
      raise exception 'La quantité doit être positive, correspondre à une ligne du bon et ne pas dépasser le reste à recevoir'
        using errcode = 'check_violation';
    end if;
    insert into public.reception_achat_lignes(organization_id, bon_id, reception_id, ligne_id, quantite)
    values (p_org, p_bon, p_operation, ligne.id, ligne.quantite);
  end loop;

  update public.bons_commande set statut = case when exists (
    select 1 from public.bon_commande_lignes l where l.bon_id = p_bon
      and l.quantite > coalesce((select sum(r.quantite) from public.reception_achat_lignes r
        where r.bon_id = p_bon and r.ligne_id = l.id), 0)
  ) then 'recu_partiel' else 'recu' end where id = p_bon;
  return p_operation;
end;
$$;

revoke execute on function public.receptionner_achat(uuid, uuid, uuid, date, text, text, jsonb, uuid)
  from public, anon, service_role;
grant execute on function public.receptionner_achat(uuid, uuid, uuid, date, text, text, jsonb, uuid) to authenticated;
