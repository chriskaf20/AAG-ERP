-- Phase 2 — Signatures électroniques (dessinées) et liens de signature à usage unique

create type public.signature_objet as enum ('devis', 'pv_lancement');

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  objet_type public.signature_objet not null,
  objet_id uuid not null,
  partie text not null check (partie in ('client', 'atlas')),
  nom_signataire text not null check (length(trim(nom_signataire)) >= 2),
  image_png text not null check (image_png like 'data:image/png;base64,%' and length(image_png) < 700000),
  ip inet,
  user_agent text,
  user_id uuid references public.profiles (id) on delete set null,
  lien_id uuid,
  signe_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index signatures_objet_idx on public.signatures (objet_type, objet_id);

create trigger signatures_meta before insert or update on public.signatures
  for each row execute function public.tg_meta();

-- Une signature est définitive
create function public.tg_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% : enregistrement définitif, non modifiable', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger signatures_immuable before update or delete on public.signatures
  for each row execute function public.tg_immuable();

create table public.liens_signature (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  objet_type public.signature_objet not null,
  objet_id uuid not null,
  token_hash text not null unique,
  expire_le timestamptz not null,
  utilise_le timestamptz,
  revoque_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index liens_signature_objet_idx on public.liens_signature (objet_type, objet_id);

create trigger liens_signature_meta before insert or update on public.liens_signature
  for each row execute function public.tg_meta();

-- Crée un lien et renvoie le jeton en clair (une seule fois ; seul le hash est stocké)
create function public.creer_lien_signature(
  p_objet_type public.signature_objet,
  p_objet_id uuid,
  p_dossier uuid,
  p_org uuid,
  p_expire_le timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  update public.liens_signature
     set revoque_le = now()
   where objet_type = p_objet_type and objet_id = p_objet_id
     and utilise_le is null and revoque_le is null;

  insert into public.liens_signature (organization_id, dossier_id, objet_type, objet_id, token_hash, expire_le)
  values (p_org, p_dossier, p_objet_type, p_objet_id,
          encode(extensions.digest(v_token, 'sha256'), 'hex'), p_expire_le);
  return v_token;
end;
$$;

revoke execute on function public.creer_lien_signature(public.signature_objet, uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
