-- Récupérer les PDF déposés par l’ancienne application après la migration d’archivage.
create function atlas_prive.archive_devis_historique(p_devis uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select doc.id
  from public.devis d
  join public.dossiers ds on ds.id = d.dossier_id and ds.organization_id = d.organization_id
  join public.documents doc on doc.dossier_id = d.dossier_id and doc.organization_id = d.organization_id
  join storage.objects o on o.bucket_id = doc.bucket and o.name = doc.chemin
  where d.id = p_devis and d.statut = 'signe' and d.signature_id is not null
    and doc.devis_archive_id is null
    and doc.type = 'devis' and doc.est_signe and doc.bucket = 'dossiers'
    and doc.created_by is null and doc.mime_type = 'application/pdf' and doc.taille > 0
    and doc.nom_fichier = (d.numero || '-v' || d.version || '-signe.pdf')
    and doc.libelle = ('Devis ' || d.numero || ' v' || d.version || ' signé')
    and storage.foldername(doc.chemin) = array[d.organization_id::text, ds.numero, 'devis']
    and split_part(doc.chemin, '/', 4) ~ '^[0-9]{13}-'
    and substr(split_part(doc.chemin, '/', 4), 15) = doc.nom_fichier
  order by doc.created_at, doc.id
  limit 1;
$$;
revoke execute on function atlas_prive.archive_devis_historique(uuid) from public, anon, authenticated, service_role;

create or replace function atlas_prive.tg_devis_archive_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.devis_archive_id is null then return new; end if;
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Archivage du devis réservé au serveur' using errcode = 'insufficient_privilege';
  end if;
  if current_user = 'postgres' and tg_op = 'UPDATE' then
    if new.id = atlas_prive.archive_devis_historique(new.devis_archive_id) then
      return new;
    end if;
  end if;
  if not exists (
    select 1 from public.devis d join public.dossiers ds on ds.id = d.dossier_id
    join storage.objects o on o.bucket_id = 'dossiers' and o.name = new.chemin
    where d.id = new.devis_archive_id and d.statut = 'signe' and d.signature_id is not null
      and d.organization_id = new.organization_id and d.dossier_id = new.dossier_id
      and new.type = 'devis' and new.est_signe and new.bucket = 'dossiers'
      and new.chemin = (d.organization_id::text || '/' || ds.numero || '/archives-devis/' || d.id::text || '.pdf')
  ) then
    raise exception 'Le fichier archivé ne correspond pas au devis signé' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.tg_documents_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.est_signe then
      raise exception 'Document signé : suppression interdite' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.est_signe then
      -- Le seul changement autorisé est le rattachement, contrôlé par devis_archive_guard.
      if old.devis_archive_id is null and new.devis_archive_id is not null
         and (to_jsonb(new) - 'devis_archive_id') = (to_jsonb(old) - 'devis_archive_id') then
        return new;
      end if;
      raise exception 'Document signé : créez une nouvelle version' using errcode = 'insufficient_privilege';
    end if;
    if new.chemin is distinct from old.chemin or new.bucket is distinct from old.bucket
       or new.version is distinct from old.version then
      raise exception 'Le fichier d''un document ne peut pas être remplacé : créez une nouvelle version'
        using errcode = 'check_violation';
    end if;
    if new.est_signe then
      new.signe_par := coalesce(auth.uid(), new.signe_par);
      new.signe_le := now();
    end if;
    return new;
  end if;

  -- INSERT : cohérence organisation et numéro de version automatique
  if new.dossier_id is not null and not exists (
    select 1 from public.dossiers where id = new.dossier_id and organization_id = new.organization_id) then
    raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  if new.client_id is not null and not exists (
    select 1 from public.clients where id = new.client_id and organization_id = new.organization_id) then
    raise exception 'Client invalide pour cette organisation' using errcode = 'check_violation';
  end if;

  if new.version_precedente_id is not null then
    select p.version + 1 into new.version from public.documents p
    where p.id = new.version_precedente_id
      and p.organization_id = new.organization_id
      and p.type = new.type
      and p.dossier_id is not distinct from new.dossier_id
      and p.client_id is not distinct from new.client_id;
    if new.version is null then
      raise exception 'Version précédente invalide' using errcode = 'check_violation';
    end if;
  else
    new.version := 1;
  end if;

  if new.est_signe then
    new.signe_par := coalesce(auth.uid(), new.signe_par);
    new.signe_le := coalesce(new.signe_le, now());
  end if;
  return new;
end;
$$;

create function public.rattacher_archive_devis_existante(p_devis uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive uuid;
  v_historique uuid;
begin
  -- Sérialise les reprises sur le même devis sans bloquer les vérifications de clés étrangères.
  perform 1 from public.devis
  where id = p_devis and statut = 'signe' and signature_id is not null
  for no key update;
  if not found then return null; end if;

  select id into v_archive from public.documents where devis_archive_id = p_devis;
  if v_archive is not null then return v_archive; end if;

  v_historique := atlas_prive.archive_devis_historique(p_devis);
  if v_historique is null then return null; end if;

  begin
    update public.documents
       set devis_archive_id = p_devis
     where id = v_historique and devis_archive_id is null
    returning id into v_archive;
  exception when unique_violation then
    -- Une consignation concurrente peut avoir utilisé la même version avant le rattachement.
    select id into v_archive from public.documents where devis_archive_id = p_devis;
    if v_archive is null then raise; end if;
  end;
  return v_archive;
end;
$$;

revoke execute on function public.rattacher_archive_devis_existante(uuid) from public, anon, authenticated;
grant execute on function public.rattacher_archive_devis_existante(uuid) to service_role;
