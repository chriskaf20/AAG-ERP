alter type public.document_type add value if not exists 'f03_cahier_charges';
alter table public.documents add constraint document_f03_dossier check (type::text <> 'f03_cahier_charges' or bucket='dossiers');

alter table public.clients add constraint clients_org_id_unique unique (organization_id, id);
alter table public.documents add constraint documents_org_id_unique unique (organization_id, id);

create table public.portail_comptes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  foreign key (organization_id, client_id) references public.clients(organization_id,id) on delete cascade
);
create index portail_comptes_client_idx on public.portail_comptes(organization_id,client_id);

create table public.portail_partages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  document_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (document_id),
  foreign key (organization_id, client_id) references public.clients(organization_id,id) on delete cascade,
  foreign key (organization_id, document_id) references public.documents(organization_id,id) on delete cascade
);
create index portail_partages_client_idx on public.portail_partages(organization_id,client_id);

alter table public.portail_comptes enable row level security;
alter table public.portail_partages enable row level security;
revoke all on public.portail_comptes, public.portail_partages from anon, authenticated;
grant select on public.portail_partages to authenticated;
create policy portail_partages_gerant on public.portail_partages for select to authenticated
  using (public.has_role(organization_id, array['gerant']::public.app_role[]));
create trigger portail_comptes_meta before insert on public.portail_comptes for each row execute function public.tg_meta();
create trigger portail_partages_meta before insert on public.portail_partages for each row execute function public.tg_meta();
create trigger audit after insert or delete on public.portail_comptes for each row execute function public.tg_audit();
create trigger audit after insert or delete on public.portail_partages for each row execute function public.tg_audit();

create schema if not exists atlas_prive;
revoke all on schema atlas_prive from public, anon, authenticated;
create function atlas_prive.portail_client(p_org uuid)
returns uuid language sql stable set search_path = '' as $$
  select pc.client_id from public.portail_comptes pc
  where pc.organization_id=p_org and pc.user_id=(select auth.uid())
    and public.has_role(p_org, array['client']::public.app_role[]);
$$;

-- Le dossier fait foi pour une pièce de dossier. Le chemin doit aussi correspondre au titulaire.
create view atlas_prive.portail_pieces as
  select p.id,p.organization_id,p.dossier_id,p.bucket,p.chemin,p.nom_fichier,p.libelle,p.type,p.version,
    case when p.bucket='dossiers' then d.client_id else p.client_id end as titulaire
  from public.documents p
  left join public.dossiers d on d.id=p.dossier_id and d.organization_id=p.organization_id
  where (storage.foldername(p.chemin))[1]=p.organization_id::text
    and (storage.foldername(p.chemin))[2]=case when p.bucket='dossiers' then d.numero else p.client_id::text end;

create function public.portail_dossiers(p_org uuid, p_dossier uuid default null)
returns table(id uuid, numero text, service text, statut public.dossier_statut, date_reception date)
language sql stable security definer set search_path = '' as $$
  select d.id,d.numero,d.service,d.statut,d.date_reception from public.dossiers d
  where d.organization_id=p_org and d.client_id=(select atlas_prive.portail_client(p_org))
    and (p_dossier is null or d.id=p_dossier)
  order by d.date_reception desc,d.id;
$$;

create function public.portail_documents(p_org uuid, p_dossier uuid default null)
returns table(id uuid, nom_fichier text, libelle text, type public.document_type, version integer, partage_le timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id,d.nom_fichier,d.libelle,d.type,d.version,p.created_at
  from public.portail_partages p join atlas_prive.portail_pieces d on d.id=p.document_id
    and d.organization_id=p.organization_id and d.titulaire=p.client_id
  where p.organization_id=p_org and p.client_id=(select atlas_prive.portail_client(p_org))
    and d.dossier_id is not distinct from p_dossier
  order by p.created_at desc,d.id;
$$;

create function public.portail_document_fichier(p_org uuid,p_document uuid)
returns table(bucket text, chemin text, nom_fichier text)
language sql stable security definer set search_path = '' as $$
  select d.bucket,d.chemin,d.nom_fichier from public.portail_partages p
  join atlas_prive.portail_pieces d on d.id=p.document_id
    and d.organization_id=p.organization_id and d.titulaire=p.client_id
  where p.organization_id=p_org and p.client_id=(select atlas_prive.portail_client(p_org))
    and d.id=p_document;
$$;

create function public.portail_fichier_autorise(p_bucket text,p_chemin text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from atlas_prive.portail_pieces d
    join public.portail_partages p on d.id=p.document_id and d.organization_id=p.organization_id and d.titulaire=p.client_id
    where d.bucket=p_bucket and d.chemin=p_chemin and p.client_id=atlas_prive.portail_client(p.organization_id)
  );
$$;

create policy portail_fichiers_partages on storage.objects for select to authenticated using (
  bucket_id in ('dossiers','clients')
  and storage.allow_only_operation('object.get_authenticated')
  and public.portail_fichier_autorise(bucket_id,name)
);

create function public.portail_comptes_gerant(p_org uuid)
returns table(user_id uuid,client_id uuid,nom text,email text)
language sql stable security definer set search_path = '' as $$
  select r.user_id,c.client_id,p.nom_complet,u.email::text
  from public.user_roles r join auth.users u on u.id=r.user_id
  left join public.profiles p on p.id=r.user_id
  left join public.portail_comptes c on c.organization_id=r.organization_id and c.user_id=r.user_id
  where r.organization_id=p_org and r.role='client'
    and public.has_role(p_org,array['gerant']::public.app_role[])
  order by p.nom_complet,u.email;
$$;

create function public.portail_lier_compte(p_org uuid,p_client uuid,p_user uuid,p_actif boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_org,array['gerant']::public.app_role[]) then
    raise exception 'Gestion des accès du portail réservée au gérant' using errcode='insufficient_privilege';
  end if;
  if not exists(select 1 from public.clients where organization_id=p_org and id=p_client) then
    raise exception 'Client introuvable pour cette organisation' using errcode='check_violation';
  end if;
  if p_actif then
    if not exists(select 1 from public.user_roles where organization_id=p_org and user_id=p_user and role='client') then
      raise exception 'Ce compte doit avoir le rôle Client dans cette organisation' using errcode='check_violation';
    end if;
    insert into public.portail_comptes(organization_id,client_id,user_id) values (p_org,p_client,p_user)
    on conflict (organization_id,user_id) do nothing;
    if not found and not exists(select 1 from public.portail_comptes where organization_id=p_org and client_id=p_client and user_id=p_user) then
      raise exception 'Ce compte est déjà rattaché à un autre client' using errcode='check_violation';
    end if;
  else
    delete from public.portail_comptes where organization_id=p_org and client_id=p_client and user_id=p_user;
  end if;
end;
$$;

create function public.portail_partager_document(p_org uuid,p_document uuid,p_actif boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cible uuid;
  dossier uuid;
begin
  if not public.has_role(p_org,array['gerant']::public.app_role[]) then
    raise exception 'Partage de documents réservé au gérant' using errcode='insufficient_privilege';
  end if;
  perform 1 from public.documents where id=p_document and organization_id=p_org for update;
  if not found then
    raise exception 'Document introuvable pour cette organisation' using errcode='check_violation';
  end if;
  if p_actif then
    select dossier_id into dossier from atlas_prive.portail_pieces where id=p_document and organization_id=p_org;
    if dossier is not null then
      perform 1 from public.dossiers where id=dossier for share;
    end if;
    select titulaire into cible from atlas_prive.portail_pieces where id=p_document and organization_id=p_org;
    if cible is null then
      raise exception 'Le document doit appartenir au client ou à son dossier' using errcode='check_violation';
    end if;
    insert into public.portail_partages(organization_id,document_id,client_id) values (p_org,p_document,cible)
    on conflict (document_id) do nothing;
  else
    delete from public.portail_partages where organization_id=p_org and document_id=p_document;
  end if;
end;
$$;

-- Changer le titulaire d’un dossier ou le rattachement d’une pièce révoque ses anciens partages.
create function atlas_prive.tg_portail_revoquer_rattachement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='dossiers' then
    delete from public.portail_partages p using public.documents d
    where d.dossier_id=new.id and d.organization_id=new.organization_id and p.document_id=d.id;
  else
    delete from public.portail_partages where document_id=new.id;
  end if;
  return new;
end;
$$;
create trigger portail_revoquer_dossier after update of client_id on public.dossiers
  for each row when (old.client_id is distinct from new.client_id)
  execute function atlas_prive.tg_portail_revoquer_rattachement();
create trigger portail_revoquer_document after update of client_id,dossier_id,organization_id on public.documents
  for each row when ((old.client_id,old.dossier_id,old.organization_id) is distinct from
                     (new.client_id,new.dossier_id,new.organization_id))
  execute function atlas_prive.tg_portail_revoquer_rattachement();

do $$
declare f text;
begin
  foreach f in array array[
    'portail_dossiers(uuid, uuid)', 'portail_documents(uuid, uuid)', 'portail_document_fichier(uuid, uuid)',
    'portail_fichier_autorise(text, text)', 'portail_comptes_gerant(uuid)',
    'portail_lier_compte(uuid, uuid, uuid, boolean)', 'portail_partager_document(uuid, uuid, boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, service_role', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
