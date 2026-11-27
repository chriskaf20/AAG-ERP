alter table public.reserves
  add column gravite public.incident_gravite not null default 'moyenne',
  add column justificatif_chemin text unique,
  add column justificatif_nom text,
  add constraint reserves_justificatif_coherent check (
    (justificatif_chemin is null and justificatif_nom is null)
    or (justificatif_chemin is not null and justificatif_nom is not null and statut='levee'
      and length(trim(justificatif_nom)) between 1 and 255)
  );

create function public.reserve_justificatif_depot(p_chemin text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.reserves r
    join public.dossiers d on d.id=r.dossier_id and d.organization_id=r.organization_id
    join public.pv_reception p on p.id=r.pv_id
    where r.statut='ouverte' and p.signe_le is not null and d.statut in ('livre','reserves')
      and storage.foldername(p_chemin)=array[r.organization_id::text,d.numero,'reserves',r.id::text]
      and split_part(p_chemin,'/',5) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](pdf|jpg|png|webp)$'
      and public.dossier_perm(r.dossier_id,'reception.write')
  );
$$;
revoke execute on function public.reserve_justificatif_depot(text) from public, anon, service_role;
grant execute on function public.reserve_justificatif_depot(text) to authenticated;

create policy reserves_justificatif_depot on storage.objects for insert to authenticated
  with check (bucket_id='dossiers' and (storage.foldername(name))[3]='reserves'
    and public.reserve_justificatif_depot(name));
create policy reserves_justificatif_depot_limite on storage.objects as restrictive for insert to authenticated
  with check (bucket_id<>'dossiers' or coalesce((storage.foldername(name))[3],'')<>'reserves'
    or public.reserve_justificatif_depot(name));
create policy reserves_justificatif_immuable on storage.objects as restrictive for delete to authenticated
  using (bucket_id<>'dossiers' or coalesce((storage.foldername(name))[3],'')<>'reserves');

drop function public.lever_reserve(uuid,text);
create function public.lever_reserve(
  p_reserve uuid, p_commentaire text default null, p_justificatif text default null, p_nom text default null
)
returns public.reserves language plpgsql security definer set search_path='' as $$
declare
  r public.reserves;
begin
  select * into r from public.reserves where id=p_reserve for update;
  if not found or not public.dossier_perm(r.dossier_id,'reception.write') then
    raise exception 'Action non autorisée' using errcode='insufficient_privilege';
  end if;
  if r.statut='levee' then
    if r.justificatif_chemin=p_justificatif and r.justificatif_nom=trim(p_nom)
       and r.commentaire_levee is not distinct from nullif(trim(p_commentaire),'') then
      return r;
    end if;
    raise exception 'Réserve déjà levée' using errcode='check_violation';
  end if;
  if not exists(select 1 from public.pv_reception where id=r.pv_id and signe_le is not null) then
    raise exception 'Le PV de réception n''est pas signé' using errcode='check_violation';
  end if;
  if p_nom is null or length(trim(p_nom)) not between 1 and 255
     or (storage.foldername(p_justificatif))[4] is distinct from r.id::text
     or not public.reserve_justificatif_depot(p_justificatif)
     or not exists(select 1 from storage.objects where bucket_id='dossiers' and name=p_justificatif) then
    raise exception 'Ajoutez un justificatif déposé pour cette réserve' using errcode='check_violation';
  end if;

  perform set_config('atlas.execution_systeme','on',true);
  update public.reserves set statut='levee',levee_le=clock_timestamp(),levee_par=auth.uid(),
    commentaire_levee=nullif(trim(p_commentaire),''),justificatif_chemin=p_justificatif,justificatif_nom=trim(p_nom)
  where id=r.id returning * into r;
  perform set_config('atlas.execution_systeme','off',true);
  return r;
end;
$$;
revoke execute on function public.lever_reserve(uuid,text,text,text) from public, anon, service_role;
grant execute on function public.lever_reserve(uuid,text,text,text) to authenticated;
