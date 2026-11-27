create or replace function public.tg_incidents_guard()
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
  if new.responsable_id is not null and (tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id)
    and not exists (
      select 1 from public.user_roles
      where organization_id = new.organization_id and user_id = new.responsable_id and role <> 'client'
    ) then
    raise exception 'Le responsable de l''incident doit être un membre interne de cette organisation'
      using errcode = 'check_violation';
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
