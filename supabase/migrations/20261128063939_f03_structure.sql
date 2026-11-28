-- Catégorie explicite pour le F-01. Les libellés connus des anciens dossiers sont repris.
create function atlas_prive.type_site_web(p_service text)
returns text language sql immutable set search_path = '' as $$
  with normalise as (
    select trim(regexp_replace(translate(lower(p_service), 'àâäéèêëïîôöùûüç', 'aaaeeeeiioouuuc'),
                               '[^a-z0-9]+', ' ', 'g')) as libelle
  )
  select case
    when libelle ~ '(^| )(refonte|redesign)( |$)'
      and (libelle ~ '(^| )sites? (web|internet|vitrine|marchands?|e commerce)( |$)'
        or libelle ~ '^(refonte|redesign) web$') then 'refonte'
    when libelle ~ '^sites? (web|internet|vitrine|marchands?|e commerce)$'
      or libelle ~ '(^| )(creation|conception|developpement|realisation)( |$).*\msites? (web|internet|vitrine|marchands?|e commerce)\M'
      then 'creation'
  end from normalise;
$$;

alter table public.dossiers add column type_site_web text
  check (type_site_web in ('creation', 'refonte'));

update public.dossiers set type_site_web = atlas_prive.type_site_web(service)
where atlas_prive.type_site_web(service) is not null;

create function atlas_prive.tg_dossier_type_site_web()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.type_site_web := coalesce(new.type_site_web, atlas_prive.type_site_web(new.service));
  if tg_op = 'UPDATE' and new.type_site_web is null then
    new.type_site_web := old.type_site_web;
  end if;
  return new;
end;
$$;

create trigger dossiers_type_site_web before insert or update of service, type_site_web on public.dossiers
  for each row execute function atlas_prive.tg_dossier_type_site_web();

create table public.f03_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  version integer not null check (version > 0),
  contenu jsonb not null check (jsonb_typeof(contenu) = 'object'),
  devis_reference text,
  etat text not null default 'brouillon' check (etat in ('brouillon', 'soumis', 'a_corriger', 'valide')),
  soumis_le timestamptz,
  decision_le timestamptz,
  decision_par uuid references public.profiles(id) on delete set null,
  motif text,
  accord_date date,
  accord_reference text,
  accord_enregistre_le timestamptz,
  accord_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (dossier_id, version)
);
create index f03_versions_org_idx on public.f03_versions (organization_id);

alter table public.f03_versions enable row level security;
revoke all on public.f03_versions from public, anon, authenticated, service_role;
grant select on public.f03_versions to authenticated;

create function public.peut_valider_f03(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    join public.departments dep on dep.id = r.department_id
      and dep.organization_id = r.organization_id and dep.code = 'DIG'
    where r.organization_id = p_org and r.user_id = auth.uid()
      and r.role = 'responsable_departement'
  );
$$;

create function public.peut_rediger_f03(p_org uuid, p_dossier uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.dossiers d
    where d.id = p_dossier and d.organization_id = p_org
      and d.responsable_id = auth.uid() and public.is_internal(p_org)
  );
$$;

create policy f03_versions_select on public.f03_versions for select to authenticated
  using (
    public.peut_valider_f03(organization_id)
    or public.dossier_visible_interne(dossier_id)
    or public.peut_rediger_f03(organization_id, dossier_id)
  );

create trigger audit after insert or update on public.f03_versions
  for each row execute function public.tg_audit();

-- Le responsable Digital peut ouvrir le F-03 d'un dossier web hors de son département,
-- sans modifier les droits sur la fiche dossier ni sur ses pièces.
create function public.dossiers_f03(p_org uuid, p_dossier uuid default null)
returns table (id uuid, numero text, service text, type_site_web text,
               client text, peut_rediger boolean, peut_valider boolean)
language sql stable security definer set search_path = '' as $$
  select d.id, d.numero, d.service, d.type_site_web, c.raison_sociale,
         coalesce(d.responsable_id = auth.uid() and public.is_internal(p_org), false),
         digital.autorise
  from public.dossiers d
  join public.clients c on c.id = d.client_id and c.organization_id = d.organization_id
  cross join (select public.peut_valider_f03(p_org) as autorise) digital
  where d.organization_id = p_org and d.type_site_web is not null
    and (p_dossier is null or d.id = p_dossier)
    and (digital.autorise or public.dossier_visible_interne(d.id)
      or (d.responsable_id = auth.uid() and public.is_internal(p_org)))
  order by d.date_reception desc, d.numero desc;
$$;

-- Les écritures de version et les transitions prennent le verrou du dossier dans le même ordre.
create function atlas_prive.verrouiller_dossier_f03(p_org uuid, p_dossier uuid, p_digital boolean default false)
returns public.dossiers language plpgsql set search_path = '' as $$
declare
  d public.dossiers;
begin
  select * into d from public.dossiers
  where id = p_dossier and organization_id = p_org and type_site_web is not null
    and case when p_digital then public.peut_valider_f03(p_org)
        else responsable_id = auth.uid() and public.is_internal(p_org) end
  for no key update;
  if not found then
    raise exception 'Action F-03 non autorisée pour ce dossier' using errcode = 'insufficient_privilege';
  end if;
  return d;
end;
$$;

create function atlas_prive.version_courante_f03(p_dossier uuid)
returns public.f03_versions language sql stable set search_path = '' as $$
  select v from public.f03_versions v where v.dossier_id = p_dossier order by v.version desc limit 1;
$$;

create function public.enregistrer_f03(p_org uuid, p_dossier uuid, p_version integer, p_contenu jsonb,
                                      p_soumettre boolean, p_modifie_le timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.dossiers;
  v public.f03_versions;
  v_id uuid;
  v_devis text;
  v_etat text := case when p_soumettre then 'soumis' else 'brouillon' end;
  v_date timestamptz := case when p_soumettre then clock_timestamp() end;
  v_champs text[] := array[
    'objectif', 'public_vise', 'langues', 'pages', 'exclusions', 'fonctionnalites', 'domaine',
    'hebergement', 'date_mise_en_ligne', 'remise_acces', 'contenus', 'criteres_reception',
    'formation', 'interlocuteur_client'
  ];
begin
  d := atlas_prive.verrouiller_dossier_f03(p_org, p_dossier);
  v := atlas_prive.version_courante_f03(d.id);

  if jsonb_typeof(p_contenu) is distinct from 'object' or p_version is null then
    raise exception 'Contenu F-03 invalide' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from jsonb_each(p_contenu) f
    where not (f.key = any(v_champs)) or jsonb_typeof(f.value) <> 'string'
      or length(p_contenu ->> f.key) > 4000
  ) then
    raise exception 'Champs F-03 invalides' using errcode = 'check_violation';
  end if;
  if coalesce(p_contenu ->> 'date_mise_en_ligne', '') <> ''
     and ((p_contenu ->> 'date_mise_en_ligne') !~ '^\d{4}-\d{2}-\d{2}$'
          or not pg_input_is_valid(p_contenu ->> 'date_mise_en_ligne', 'date')) then
    raise exception 'Date de mise en ligne invalide' using errcode = 'check_violation';
  end if;
  if p_soumettre and exists (
    select 1 from unnest(v_champs) c where coalesce(p_contenu ->> c, '') !~ '[^[:space:]]'
  ) then
    raise exception 'Renseignez tous les champs F-03 avant de soumettre' using errcode = 'check_violation';
  end if;

  if p_modifie_le is null and p_version = coalesce(v.version, 0) + 1
     and (v.id is null or v.etat in ('a_corriger', 'valide')) then
    select numero || ' v' || version into v_devis from public.devis
    where dossier_id = d.id and organization_id = d.organization_id and statut = 'signe'
    order by signe_le desc nulls last, version desc, id desc limit 1;

    insert into public.f03_versions (organization_id, dossier_id, version, contenu, devis_reference, etat, soumis_le)
    values (d.organization_id, d.id, p_version, p_contenu, v_devis, v_etat, v_date)
    returning id into v_id;
    return v_id;
  end if;

  if v.version = p_version and v.etat = 'brouillon' and v.updated_at = p_modifie_le then
    update public.f03_versions
    set contenu = p_contenu, etat = v_etat, soumis_le = v_date, updated_at = clock_timestamp()
    where id = v.id;
    return v.id;
  end if;

  raise exception 'Version F-03 modifiée ou fermée. Rechargez la fiche.' using errcode = 'check_violation';
end;
$$;

create function public.decider_f03(p_org uuid, p_dossier uuid, p_version integer, p_valide boolean,
                                  p_motif text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.f03_versions;
begin
  perform atlas_prive.verrouiller_dossier_f03(p_org, p_dossier, true);
  v := atlas_prive.version_courante_f03(p_dossier);
  if v.version is distinct from p_version or v.etat is distinct from 'soumis' then
    raise exception 'Cette version F-03 doit être la version courante soumise' using errcode = 'check_violation';
  end if;
  if p_valide is null or (not p_valide and (coalesce(p_motif, '') !~ '[^[:space:]]' or length(btrim(p_motif)) > 4000)) then
    raise exception 'Indiquez le motif des corrections demandées' using errcode = 'check_violation';
  end if;
  update public.f03_versions
  set etat = case when p_valide then 'valide' else 'a_corriger' end,
      motif = case when not p_valide then btrim(p_motif) end,
      decision_le = clock_timestamp(), decision_par = auth.uid(), updated_at = clock_timestamp()
  where id = v.id;
end;
$$;

create function public.consigner_accord_f03(p_org uuid, p_dossier uuid, p_version integer,
                                          p_date date, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.f03_versions;
begin
  perform atlas_prive.verrouiller_dossier_f03(p_org, p_dossier);
  v := atlas_prive.version_courante_f03(p_dossier);
  if v.id is null or v.version is distinct from p_version or v.etat not in ('soumis', 'valide')
     or v.accord_enregistre_le is not null then
    raise exception 'L’accord doit concerner la version courante soumise ou validée et rester unique'
      using errcode = 'check_violation';
  end if;
  if p_date is null or p_date > (now() at time zone 'Africa/Lubumbashi')::date
     or coalesce(p_reference, '') !~ '[^[:space:]]' or length(btrim(p_reference)) > 4000 then
    raise exception 'Indiquez la date et la référence de l’accord client' using errcode = 'check_violation';
  end if;
  update public.f03_versions
  set accord_date = p_date, accord_reference = btrim(p_reference), accord_par = auth.uid(),
      accord_enregistre_le = clock_timestamp(), updated_at = clock_timestamp()
  where id = v.id;
end;
$$;

create function atlas_prive.tg_f03_avant_en_cours()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v public.f03_versions;
begin
  if new.type_site_web is null then return new; end if;
  v := atlas_prive.version_courante_f03(new.id);
  if v.etat is distinct from 'valide' or v.accord_enregistre_le is null then
    raise exception 'Passage en cours impossible : validez la version courante du F-03 avec Digital et consignez l’accord client'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger f03_avant_en_cours before update of statut on public.dossiers
  for each row when (new.statut = 'en_cours' and old.statut is distinct from new.statut)
  execute function atlas_prive.tg_f03_avant_en_cours();

revoke execute on function atlas_prive.type_site_web(text), atlas_prive.tg_dossier_type_site_web(),
  atlas_prive.verrouiller_dossier_f03(uuid, uuid, boolean), atlas_prive.version_courante_f03(uuid),
  atlas_prive.tg_f03_avant_en_cours() from public, anon, authenticated, service_role;

revoke execute on function public.peut_valider_f03(uuid), public.peut_rediger_f03(uuid, uuid), public.dossiers_f03(uuid, uuid),
  public.enregistrer_f03(uuid, uuid, integer, jsonb, boolean, timestamptz),
  public.decider_f03(uuid, uuid, integer, boolean, text),
  public.consigner_accord_f03(uuid, uuid, integer, date, text) from public, anon, authenticated, service_role;
grant execute on function public.peut_valider_f03(uuid), public.peut_rediger_f03(uuid, uuid), public.dossiers_f03(uuid, uuid),
  public.enregistrer_f03(uuid, uuid, integer, jsonb, boolean, timestamptz),
  public.decider_f03(uuid, uuid, integer, boolean, text),
  public.consigner_accord_f03(uuid, uuid, integer, date, text) to authenticated;
