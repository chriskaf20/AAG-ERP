-- Phase 3 — Missions (terrain / interne), agents affectés, rapports d'intervention
-- (photos, signature client ou validation interne), livrables.

create type public.mission_type as enum ('terrain', 'interne');
create type public.mission_statut as enum ('planifiee', 'en_cours', 'terminee', 'annulee');

-- ---------------------------------------------------------------------------
-- Missions
-- ---------------------------------------------------------------------------
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  type public.mission_type not null,
  titre text not null check (length(trim(titre)) > 0),
  consignes text,
  lieu text,
  debut timestamptz not null,
  fin timestamptz,
  statut public.mission_statut not null default 'planifiee',
  motif_annulation text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (fin is null or fin >= debut)
);

create index missions_dossier_idx on public.missions (dossier_id);
create index missions_org_debut_idx on public.missions (organization_id, debut);
create index missions_created_by_fk_idx on public.missions (created_by);

create trigger missions_meta before insert or update on public.missions
  for each row execute function public.tg_meta();

create table public.mission_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (mission_id, user_id)
);

create index mission_agents_user_idx on public.mission_agents (user_id);
create index mission_agents_org_fk_idx on public.mission_agents (organization_id);
create index mission_agents_created_by_fk_idx on public.mission_agents (created_by);

create trigger mission_agents_meta before insert or update on public.mission_agents
  for each row execute function public.tg_meta();

create function public.tg_missions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_systeme boolean := coalesce(current_setting('atlas.execution_systeme', true), '') = 'on';
  v_statut public.dossier_statut;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.dossiers where id = old.dossier_id) then
      return old;  -- suppression en cascade du dossier
    end if;
    if old.statut <> 'planifiee' or exists (select 1 from public.rapports_intervention where mission_id = old.id) then
      raise exception 'Mission commencée : suppression interdite (annulez-la avec un motif)'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    select statut into v_statut from public.dossiers
     where id = new.dossier_id and organization_id = new.organization_id;
    if not found then
      raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    if v_statut not in ('en_lancement', 'en_cours', 'reserves') then
      raise exception 'Une mission se planifie sur un dossier en lancement, en cours ou avec réserves'
        using errcode = 'check_violation';
    end if;
    new.statut := 'planifiee';
    new.motif_annulation := null;
    return new;
  end if;

  if new.dossier_id is distinct from old.dossier_id or new.type is distinct from old.type then
    raise exception 'Dossier et type d''une mission immuables' using errcode = 'check_violation';
  end if;
  if v_systeme then return new; end if;

  if old.statut in ('terminee', 'annulee') then
    raise exception 'Mission % : non modifiable', old.statut using errcode = 'insufficient_privilege';
  end if;
  if new.statut = 'terminee' then
    raise exception 'Une mission se termine par son rapport (signé par le client ou validé)'
      using errcode = 'check_violation';
  end if;
  if new.statut = 'planifiee' and old.statut = 'en_cours' then
    raise exception 'Mission déjà commencée' using errcode = 'check_violation';
  end if;
  if new.statut = 'annulee' and nullif(trim(new.motif_annulation), '') is null then
    raise exception 'Motif d''annulation obligatoire' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger missions_guard before insert or update or delete on public.missions
  for each row execute function public.tg_missions_guard();

-- Affectation : agent de terrain pour une mission terrain, tout membre interne pour une
-- mission interne.
create function public.tg_mission_agents_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.missions;
begin
  select * into m from public.missions where id = coalesce(new.mission_id, old.mission_id);
  if tg_op = 'DELETE' then
    if m.statut = 'terminee' then
      raise exception 'Mission terminée : affectations non modifiables' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'Affectation non modifiable (retirez puis ajoutez)' using errcode = 'check_violation';
  end if;
  if m.id is null or m.organization_id <> new.organization_id then
    raise exception 'Mission invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  if m.statut not in ('planifiee', 'en_cours') then
    raise exception 'Mission % : affectation impossible', m.statut using errcode = 'check_violation';
  end if;
  if m.type = 'terrain' and not exists (
    select 1 from public.user_roles
     where user_id = new.user_id and organization_id = m.organization_id and role = 'agent_terrain') then
    raise exception 'Mission terrain : seule une personne ayant le rôle agent de terrain peut être affectée'
      using errcode = 'check_violation';
  end if;
  if m.type = 'interne' and not exists (
    select 1 from public.user_roles ur
     where ur.user_id = new.user_id and ur.organization_id = m.organization_id
       and ur.role <> 'client') then
    raise exception 'Mission interne : la personne doit être un membre interne de l''organisation'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger mission_agents_guard before insert or update or delete on public.mission_agents
  for each row execute function public.tg_mission_agents_guard();

-- ---------------------------------------------------------------------------
-- Rapports d'intervention (versionnés ; définitifs une fois signés ou validés)
-- ---------------------------------------------------------------------------
create table public.rapports_intervention (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  version integer not null default 1,
  remplace_id uuid references public.rapports_intervention (id) on delete set null,
  travaux text not null check (length(trim(travaux)) > 0),
  observations text,
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  precision_m numeric(8, 1),
  redige_par uuid references public.profiles (id) on delete set null,
  -- mission terrain : signature du client
  signature_client_id uuid references public.signatures (id) on delete restrict,
  signe_le timestamptz,
  -- mission interne : validation par le responsable du dossier
  valide_par uuid references public.profiles (id) on delete set null,
  valide_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (mission_id, version)
);

create index rapports_intervention_dossier_idx on public.rapports_intervention (dossier_id);
create index rapports_intervention_org_fk_idx on public.rapports_intervention (organization_id);
create index rapports_intervention_remplace_fk_idx on public.rapports_intervention (remplace_id);
create index rapports_intervention_redige_fk_idx on public.rapports_intervention (redige_par);
create index rapports_intervention_sig_fk_idx on public.rapports_intervention (signature_client_id);
create index rapports_intervention_valide_fk_idx on public.rapports_intervention (valide_par);
create index rapports_intervention_created_by_fk_idx on public.rapports_intervention (created_by);
-- Un seul rapport en préparation par mission
create unique index rapports_intervention_un_brouillon on public.rapports_intervention (mission_id)
  where signe_le is null and valide_le is null;

create trigger rapports_intervention_meta before insert or update on public.rapports_intervention
  for each row execute function public.tg_meta();

create function public.tg_rapports_intervention_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_systeme boolean := coalesce(current_setting('atlas.execution_systeme', true), '') = 'on';
  m public.missions;
begin
  if tg_op = 'DELETE' then
    if (old.signe_le is not null or old.valide_le is not null)
       and exists (select 1 from public.dossiers where id = old.dossier_id) then
      raise exception 'Rapport signé ou validé : suppression interdite' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    select * into m from public.missions where id = new.mission_id;
    if m.id is null or m.organization_id <> new.organization_id then
      raise exception 'Mission invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    if m.statut = 'annulee' then
      raise exception 'Mission annulée : rapport impossible' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.dossiers where id = m.dossier_id and statut in ('en_cours', 'reserves')) then
      raise exception 'Le dossier doit être en cours ou avec réserves pour rédiger le rapport' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.mission_agents where mission_id = m.id) then
      raise exception 'Affectez au moins une personne avant de rédiger le rapport' using errcode = 'check_violation';
    end if;
    if not v_systeme and exists (select 1 from public.rapports_intervention where mission_id = m.id) then
      raise exception 'Un rapport existe déjà pour cette mission (établissez une nouvelle version)'
        using errcode = 'check_violation';
    end if;
    new.dossier_id := m.dossier_id;
    new.version := coalesce((select max(version) from public.rapports_intervention where mission_id = m.id), 0) + 1;
    new.redige_par := coalesce(auth.uid(), new.redige_par);
    new.signature_client_id := null; new.signe_le := null;
    new.valide_par := null; new.valide_le := null;
    if m.statut = 'planifiee' then
      perform set_config('atlas.execution_systeme', 'on', true);
      update public.missions set statut = 'en_cours' where id = m.id;
      perform set_config('atlas.execution_systeme', case when v_systeme then 'on' else 'off' end, true);
    end if;
    return new;
  end if;

  if old.signe_le is not null or old.valide_le is not null then
    raise exception 'Rapport signé ou validé : non modifiable (établissez une nouvelle version)'
      using errcode = 'insufficient_privilege';
  end if;
  if new.mission_id is distinct from old.mission_id or new.dossier_id is distinct from old.dossier_id
     or new.version is distinct from old.version or new.remplace_id is distinct from old.remplace_id then
    raise exception 'Mission et version d''un rapport immuables' using errcode = 'check_violation';
  end if;
  if not v_systeme and (new.signature_client_id is distinct from old.signature_client_id
       or new.signe_le is distinct from old.signe_le
       or new.valide_par is distinct from old.valide_par
       or new.valide_le is distinct from old.valide_le) then
    raise exception 'Signature et validation passent par les fonctions dédiées'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger rapports_intervention_guard before insert or update or delete on public.rapports_intervention
  for each row execute function public.tg_rapports_intervention_guard();

create table public.rapport_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rapport_id uuid not null references public.rapports_intervention (id) on delete cascade,
  chemin text not null,
  largeur integer,
  hauteur integer,
  taille integer check (taille is null or taille >= 0),
  legende text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (rapport_id, chemin)
);

create index rapport_photos_org_fk_idx on public.rapport_photos (organization_id);
create index rapport_photos_created_by_fk_idx on public.rapport_photos (created_by);

create trigger rapport_photos_meta before insert or update on public.rapport_photos
  for each row execute function public.tg_meta();

create function public.tg_rapport_photos_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rapports_intervention;
begin
  if tg_op = 'UPDATE' and (new.rapport_id is distinct from old.rapport_id or new.chemin is distinct from old.chemin) then
    raise exception 'Rapport et fichier d''une photo immuables' using errcode = 'check_violation';
  end if;
  select * into r from public.rapports_intervention where id = coalesce(new.rapport_id, old.rapport_id) for update;
  if r.id is null or not exists (select 1 from public.dossiers where id = r.dossier_id) then
    return coalesce(new, old);  -- suppression en cascade
  end if;
  if r.signe_le is not null or r.valide_le is not null then
    raise exception 'Rapport signé ou validé : photos non modifiables' using errcode = 'insufficient_privilege';
  end if;
  if tg_op <> 'DELETE' and r.organization_id <> new.organization_id then
    raise exception 'Rapport invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger rapport_photos_guard before insert or update or delete on public.rapport_photos
  for each row execute function public.tg_rapport_photos_guard();

-- ---------------------------------------------------------------------------
-- Livrables
-- ---------------------------------------------------------------------------
create table public.livrables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  libelle text not null check (length(trim(libelle)) > 0),
  description text,
  echeance date,
  remis_le timestamptz,
  remis_par uuid references public.profiles (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index livrables_dossier_idx on public.livrables (dossier_id);
create index livrables_org_fk_idx on public.livrables (organization_id);
create index livrables_remis_par_fk_idx on public.livrables (remis_par);
create index livrables_document_fk_idx on public.livrables (document_id);
create index livrables_created_by_fk_idx on public.livrables (created_by);

create trigger livrables_meta before insert or update on public.livrables
  for each row execute function public.tg_meta();

create function public.tg_livrables_guard()
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
    if tg_op = 'DELETE' then return old; end if;  -- suppression en cascade du dossier
    raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  if v_statut in ('receptionne_a_facturer', 'cloture', 'refuse', 'classe_sans_suite') then
    raise exception 'Dossier réceptionné ou fermé : livrables non modifiables' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and new.dossier_id is distinct from old.dossier_id then
    raise exception 'Dossier d''un livrable immuable' using errcode = 'check_violation';
  end if;
  if new.remis_le is not null and (tg_op = 'INSERT' or old.remis_le is null) then
    new.remis_par := coalesce(auth.uid(), new.remis_par);
  elsif new.remis_le is null then
    new.remis_par := null;
  end if;
  return new;
end;
$$;

create trigger livrables_guard before insert or update or delete on public.livrables
  for each row execute function public.tg_livrables_guard();
