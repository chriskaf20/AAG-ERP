-- Phase 1 — Documents (pièces client et documents de dossier)
-- Un document signé n'est jamais modifié ni supprimé : on crée une nouvelle version.

create type public.document_type as enum (
  'rccm', 'id_nat', 'nif', 'piece_identite', 'accuse_reception',
  'fiche_ouverture', 'fiche_verification', 'autre'
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid references public.dossiers (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  type public.document_type not null,
  libelle text,
  bucket text not null check (bucket in ('dossiers', 'clients')),
  chemin text not null,
  nom_fichier text not null,
  mime_type text,
  taille bigint check (taille is null or taille >= 0),
  version integer not null default 1,
  version_precedente_id uuid references public.documents (id) on delete set null,
  est_signe boolean not null default false,
  signe_par uuid references public.profiles (id) on delete set null,
  signe_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (bucket, chemin),
  constraint document_rattache check (dossier_id is not null or client_id is not null),
  constraint bucket_coherent check (
    (bucket = 'dossiers' and dossier_id is not null)
    or (bucket = 'clients' and client_id is not null and dossier_id is null)
  )
);

create index documents_dossier_idx on public.documents (dossier_id);
create index documents_client_idx on public.documents (client_id);

create trigger documents_meta before insert or update on public.documents
  for each row execute function public.tg_meta();

create function public.tg_documents_guard()
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

create trigger documents_guard before insert or update or delete on public.documents
  for each row execute function public.tg_documents_guard();
