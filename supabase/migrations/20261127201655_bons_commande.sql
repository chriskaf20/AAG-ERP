create table public.bons_commande (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  fournisseur_id uuid not null,
  department_id uuid not null references public.departments (id) on delete restrict,
  dossier_id uuid references public.dossiers (id) on delete restrict,
  objet text not null check (length(trim(objet)) between 1 and 300),
  numero text,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'a_valider', 'valide', 'emis', 'annule')),
  devise public.devise not null,
  taux_cdf numeric(14,4) not null check (taux_cdf > 0),
  taxes jsonb not null,
  total_ht numeric(16,2) not null check (total_ht >= 0),
  total_ttc numeric(16,2) not null check (total_ttc >= 0),
  valide_par uuid references auth.users (id) on delete set null,
  valide_le timestamptz,
  emis_le timestamptz,
  motif_annulation text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, numero),
  foreign key (organization_id, fournisseur_id) references public.fournisseurs (organization_id, id) on delete restrict
);

create table public.bon_commande_lignes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bon_id uuid not null,
  ordre integer not null,
  description text not null check (length(trim(description)) between 1 and 500),
  quantite numeric(14,3) not null check (quantite > 0),
  prix_unitaire numeric(14,2) not null check (prix_unitaire >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (bon_id, ordre),
  unique (organization_id, bon_id, id),
  foreign key (organization_id, bon_id) references public.bons_commande (organization_id, id) on delete cascade
);

create index bons_commande_org_statut_idx on public.bons_commande (organization_id, statut);
create index bons_commande_fournisseur_idx on public.bons_commande (organization_id, fournisseur_id);
create index bons_commande_dept_idx on public.bons_commande (department_id);
create index bons_commande_dossier_idx on public.bons_commande (dossier_id);
create index bons_commande_valide_par_idx on public.bons_commande (valide_par);
create index bons_commande_created_by_idx on public.bons_commande (created_by);
create index bon_commande_lignes_created_by_idx on public.bon_commande_lignes (created_by);

create trigger bons_commande_meta before insert or update on public.bons_commande
  for each row execute function public.tg_meta();
create trigger bon_commande_lignes_meta before insert or update on public.bon_commande_lignes
  for each row execute function public.tg_meta();
create trigger audit after insert or update or delete on public.bons_commande
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.bon_commande_lignes
  for each row execute function public.tg_audit();

create function public.achat_autorise(p_org uuid, p_departement uuid, p_perm public.app_permission)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    where r.organization_id = p_org and r.user_id = auth.uid()
      and public.role_a(p_org, r.role, p_perm)
      and (r.role in ('gerant', 'directeur_operations', 'daf')
        or (r.role = 'acheteur' and r.department_id = p_departement))
  );
$$;
revoke execute on function public.achat_autorise(uuid, uuid, public.app_permission) from public, anon, service_role;
grant execute on function public.achat_autorise(uuid, uuid, public.app_permission) to authenticated;

alter table public.bons_commande enable row level security;
alter table public.bon_commande_lignes enable row level security;
revoke all on public.bons_commande, public.bon_commande_lignes from anon, authenticated;
grant select on public.bons_commande, public.bon_commande_lignes to authenticated;

create policy bons_commande_select on public.bons_commande for select to authenticated
  using (public.achat_autorise(organization_id, department_id, 'achats.read'));
create policy bon_commande_lignes_select on public.bon_commande_lignes for select to authenticated
  using (exists (select 1 from public.bons_commande b where b.id = bon_id and b.organization_id = bon_commande_lignes.organization_id));

create function public.enregistrer_bon_commande(
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

create function public.transition_bon_commande(p_org uuid, p_bon uuid, p_action text, p_motif text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  bon public.bons_commande;
  seuil numeric;
  depasse boolean;
begin
  select * into bon from public.bons_commande b where b.id = p_bon and b.organization_id = p_org for update;
  if not found or not public.achat_autorise(p_org, bon.department_id, 'achats.read') then
    raise exception 'Bon de commande introuvable' using errcode = 'insufficient_privilege';
  end if;

  if p_action = 'valider' then
    if not (public.has_role(p_org, array['gerant']::public.app_role[])
      and public.achat_autorise(p_org, bon.department_id, 'achats.validate')) then
      raise exception 'Validation réservée au gérant' using errcode = 'insufficient_privilege';
    end if;
  elsif not public.achat_autorise(p_org, bon.department_id, 'achats.write') then
    raise exception 'Action réservée aux acheteurs habilités' using errcode = 'insufficient_privilege';
  end if;

  select coalesce((parametres ->> 'seuil_validation_usd')::numeric, 5000) into seuil
    from public.organizations where id = p_org;
  depasse := (case when bon.devise = 'CDF' then bon.total_ttc / bon.taux_cdf else bon.total_ttc end) > seuil;

  if p_action = 'soumettre' and bon.statut = 'brouillon' then
    if bon.total_ttc <= 0 then
      raise exception 'Le montant du bon de commande doit être positif' using errcode = 'check_violation';
    end if;
    update public.bons_commande set statut = case when depasse then 'a_valider' else 'valide' end where id = p_bon;
  elsif p_action = 'valider' and bon.statut = 'a_valider' then
    update public.bons_commande set statut = 'valide', valide_par = auth.uid(), valide_le = clock_timestamp() where id = p_bon;
  elsif p_action = 'emettre' and bon.statut in ('valide', 'a_valider') then
    if depasse and bon.valide_le is null then
      raise exception 'Le gérant doit valider le bon avant son émission' using errcode = 'check_violation';
    end if;
    if bon.statut <> 'valide' then
      raise exception 'Validez le bon avant son émission' using errcode = 'check_violation';
    end if;
    update public.bons_commande set statut = 'emis', emis_le = clock_timestamp(),
      numero = public.prochain_numero(p_org, 'BC', (now() at time zone 'Africa/Lubumbashi')::date)
    where id = p_bon;
  elsif p_action = 'reprendre' and bon.statut in ('a_valider', 'valide') then
    update public.bons_commande set statut = 'brouillon', valide_par = null, valide_le = null where id = p_bon;
  elsif p_action = 'annuler' and bon.statut in ('brouillon', 'a_valider', 'valide') then
    if nullif(trim(p_motif), '') is null then
      raise exception 'Motif d’annulation obligatoire' using errcode = 'check_violation';
    end if;
    update public.bons_commande set statut = 'annule', motif_annulation = trim(p_motif) where id = p_bon;
  else
    raise exception 'Action indisponible pour ce bon de commande' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.enregistrer_bon_commande(uuid, uuid, uuid, uuid, text, public.devise, jsonb, uuid)
  from public, anon, service_role;
revoke execute on function public.transition_bon_commande(uuid, uuid, text, text) from public, anon, service_role;
grant execute on function public.enregistrer_bon_commande(uuid, uuid, uuid, uuid, text, public.devise, jsonb, uuid) to authenticated;
grant execute on function public.transition_bon_commande(uuid, uuid, text, text) to authenticated;

-- Le compteur conserve les trois chiffres historiques, y compris au-delà de 999.
create or replace function public.prochain_numero(p_org uuid, p_type text, p_date date default current_date)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_annee integer := extract(year from p_date)::integer;
  v_num integer;
begin
  insert into public.compteurs as c (organization_id, type, annee, dernier)
  values (p_org, p_type, v_annee, 1)
  on conflict (organization_id, type, annee) do update set dernier = c.dernier + 1
  returning dernier into v_num;
  return p_type || '-' || v_annee || '-' || lpad(v_num::text, greatest(3, length(v_num::text)), '0');
end;
$$;
