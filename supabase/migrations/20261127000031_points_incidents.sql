-- Phase 3 — Suivi d'exécution (FP-04) : points d'avancement hebdomadaires et incidents.

-- ---------------------------------------------------------------------------
-- Points d'avancement : écrit au client, consigné (définitif) ; envoi e-mail facultatif
-- ---------------------------------------------------------------------------
create table public.points_avancement (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  date_point date not null default current_date,
  texte text not null check (length(trim(texte)) >= 10),
  envoye_par uuid references public.profiles (id) on delete set null,
  email_statut text not null default 'consigne'
    check (email_statut in ('consigne', 'ignore', 'simule', 'en_attente', 'envoye', 'echec')),
  email_destinataire text,
  email_le timestamptz,
  email_erreur text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index points_avancement_dossier_idx on public.points_avancement (dossier_id, date_point desc);
create index points_avancement_org_fk_idx on public.points_avancement (organization_id);
create index points_avancement_envoye_par_fk_idx on public.points_avancement (envoye_par);
create index points_avancement_created_by_fk_idx on public.points_avancement (created_by);

create trigger points_avancement_meta before insert or update on public.points_avancement
  for each row execute function public.tg_meta();

create function public.tg_points_avancement_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_systeme boolean := coalesce(current_setting('atlas.execution_systeme', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.dossiers where id = old.dossier_id) then
      raise exception 'Point d''avancement : définitif, suppression interdite' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.dossiers where id = new.dossier_id and organization_id = new.organization_id) then
      raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    new.envoye_par := coalesce(auth.uid(), new.envoye_par);
    if not v_systeme then
      new.email_statut := 'consigne'; new.email_destinataire := null; new.email_le := null; new.email_erreur := null;
    end if;
    return new;
  end if;
  if not v_systeme
     or (to_jsonb(new) - array['email_statut', 'email_destinataire', 'email_le', 'email_erreur', 'updated_at'])
        is distinct from
        (to_jsonb(old) - array['email_statut', 'email_destinataire', 'email_le', 'email_erreur', 'updated_at']) then
    raise exception 'Point d''avancement : définitif, non modifiable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger points_avancement_guard before insert or update or delete on public.points_avancement
  for each row execute function public.tg_points_avancement_guard();

-- ---------------------------------------------------------------------------
-- Incidents
-- ---------------------------------------------------------------------------
create type public.incident_gravite as enum ('faible', 'moyenne', 'elevee');
create type public.incident_statut as enum ('ouvert', 'en_traitement', 'clos');

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  mission_id uuid references public.missions (id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  gravite public.incident_gravite not null default 'moyenne',
  action_corrective text,
  responsable_id uuid references public.profiles (id) on delete set null,
  statut public.incident_statut not null default 'ouvert',
  date_cloture timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index incidents_dossier_idx on public.incidents (dossier_id);
create index incidents_org_fk_idx on public.incidents (organization_id);
create index incidents_mission_fk_idx on public.incidents (mission_id);
create index incidents_responsable_fk_idx on public.incidents (responsable_id);
create index incidents_created_by_fk_idx on public.incidents (created_by);

create trigger incidents_meta before insert or update on public.incidents
  for each row execute function public.tg_meta();

create function public.tg_incidents_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.dossiers where id = old.dossier_id) then
      raise exception 'Incident : suppression interdite (clôturez-le)' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.dossiers where id = new.dossier_id and organization_id = new.organization_id) then
      raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    if new.mission_id is not null and not exists (
      select 1 from public.missions where id = new.mission_id and dossier_id = new.dossier_id) then
      raise exception 'La mission n''appartient pas au dossier' using errcode = 'check_violation';
    end if;
    new.statut := 'ouvert';
    new.date_cloture := null;
    return new;
  end if;
  if new.dossier_id is distinct from old.dossier_id then
    raise exception 'Dossier d''un incident immuable' using errcode = 'check_violation';
  end if;
  if old.statut = 'clos' then
    raise exception 'Incident clos : non modifiable' using errcode = 'insufficient_privilege';
  end if;
  if new.statut = 'clos' then
    if nullif(trim(new.action_corrective), '') is null then
      raise exception 'Action corrective obligatoire pour clôturer un incident' using errcode = 'check_violation';
    end if;
    new.date_cloture := clock_timestamp();
  else
    new.date_cloture := null;
  end if;
  return new;
end;
$$;

create trigger incidents_guard before insert or update or delete on public.incidents
  for each row execute function public.tg_incidents_guard();
