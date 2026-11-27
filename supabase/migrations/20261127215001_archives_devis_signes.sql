alter table public.documents add column devis_archive_id uuid
  references public.devis(id) on delete restrict;
alter table public.documents add constraint documents_devis_archive_unique unique (devis_archive_id);

-- Rattacher un PDF historique qui existe toujours, sans modifier son contenu ni son chemin.
alter table public.documents disable trigger documents_guard;
update public.documents doc set devis_archive_id=d.id
from public.devis d
where d.statut='signe' and doc.id=(
  select x.id from public.documents x join storage.objects o on o.bucket_id=x.bucket and o.name=x.chemin
  where x.organization_id=d.organization_id and x.dossier_id=d.dossier_id
    and x.type='devis' and x.est_signe and x.bucket='dossiers'
    and x.nom_fichier=(d.numero||'-v'||d.version||'-signe.pdf')
    and x.libelle=('Devis '||d.numero||' v'||d.version||' signé')
  order by x.created_at,x.id limit 1
);
alter table public.documents enable trigger documents_guard;

create function atlas_prive.tg_devis_archive_guard()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.devis_archive_id is null then return new; end if;
  if current_user not in ('service_role','postgres') then
    raise exception 'Archivage du devis réservé au serveur' using errcode='insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.devis d join public.dossiers ds on ds.id=d.dossier_id
    join storage.objects o on o.bucket_id='dossiers' and o.name=new.chemin
    where d.id=new.devis_archive_id and d.statut='signe' and d.signature_id is not null
      and d.organization_id=new.organization_id and d.dossier_id=new.dossier_id
      and new.type='devis' and new.est_signe and new.bucket='dossiers'
      and new.chemin=(d.organization_id::text||'/'||ds.numero||'/archives-devis/'||d.id::text||'.pdf')
  ) then
    raise exception 'Le fichier archivé ne correspond pas au devis signé' using errcode='check_violation';
  end if;
  return new;
end;
$$;
create trigger devis_archive_guard before insert or update of devis_archive_id on public.documents
for each row execute function atlas_prive.tg_devis_archive_guard();

create policy dossiers_archives_depot_serveur on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'dossiers' or coalesce((storage.foldername(name))[3],'') <> 'archives-devis');
create policy dossiers_archives_immuables on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'dossiers' or (coalesce((storage.foldername(name))[3],'') <> 'archives-devis'
    and not exists(select 1 from public.documents d where d.bucket=bucket_id and d.chemin=name and d.devis_archive_id is not null)));

create function public.consigner_archive_devis(p_devis uuid,p_chemin text,p_nom text,p_taille integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare archive uuid;
begin
  insert into public.documents(organization_id,dossier_id,type,libelle,bucket,chemin,nom_fichier,mime_type,taille,est_signe,devis_archive_id)
  select organization_id,dossier_id,'devis','Devis '||numero||' v'||version||' signé','dossiers',p_chemin,p_nom,
    'application/pdf',p_taille,true,id from public.devis where id=p_devis and statut='signe'
  on conflict (devis_archive_id) do nothing returning id into archive;
  if archive is null then
    select id into archive from public.documents where devis_archive_id=p_devis;
  end if;
  if archive is null then
    raise exception 'Devis signé introuvable' using errcode='check_violation';
  end if;
  return archive;
end;
$$;
revoke execute on function public.consigner_archive_devis(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.consigner_archive_devis(uuid,text,text,integer) to service_role;
