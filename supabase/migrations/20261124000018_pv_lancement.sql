-- Phase 2 — PV de lancement F-04 (points confirmés, signature des deux parties)

create table public.pv_lancement (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  devis_id uuid references public.devis (id) on delete set null,
  date_lancement date not null default current_date,
  lieu text,
  perimetre_confirme boolean not null default false,
  planning_confirme boolean not null default false,
  interlocuteurs_confirmes boolean not null default false,
  livrables_confirmes boolean not null default false,
  acces_site_confirme boolean not null default false,
  acompte_confirme boolean not null default false,
  observations text,
  signature_atlas_id uuid references public.signatures (id) on delete restrict,
  signature_client_id uuid references public.signatures (id) on delete restrict,
  signe_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index pv_lancement_dossier_idx on public.pv_lancement (dossier_id);

-- Un seul PV non signé à la fois par dossier
create unique index pv_lancement_un_brouillon on public.pv_lancement (dossier_id) where signe_le is null;

create trigger pv_lancement_meta before insert or update on public.pv_lancement
  for each row execute function public.tg_meta();

create function public.tg_pv_lancement_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_systeme boolean := coalesce(current_setting('atlas.finance_systeme', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.signature_atlas_id is not null or old.signature_client_id is not null then
      raise exception 'PV signé : suppression interdite' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.dossiers where id = new.dossier_id and organization_id = new.organization_id) then
      raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    if not v_systeme then
      new.signature_atlas_id := null; new.signature_client_id := null; new.signe_le := null;
    end if;
    return new;
  end if;
  if not v_systeme then
    if old.signature_atlas_id is not null or old.signature_client_id is not null then
      raise exception 'PV en cours de signature : non modifiable' using errcode = 'insufficient_privilege';
    end if;
    if new.signature_atlas_id is distinct from old.signature_atlas_id
       or new.signature_client_id is distinct from old.signature_client_id
       or new.signe_le is distinct from old.signe_le then
      raise exception 'Les signatures passent par signer_pv()' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger pv_lancement_guard before insert or update or delete on public.pv_lancement
  for each row execute function public.tg_pv_lancement_guard();
