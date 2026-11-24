-- Phase 1 — Journal d'audit (insertion seule) et trigger générique

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'STATUT', 'VALIDATION')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  motif text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

-- Le journal est immuable, même pour les rôles applicatifs
create function public.tg_audit_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Le journal d''audit est en insertion seule' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_immuable before update or delete on public.audit_log
  for each row execute function public.tg_audit_immuable();

create function public.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_row jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed
    from jsonb_object_keys(v_new) k
    where k <> 'updated_at' and v_new -> k is distinct from v_old -> k;
    if v_changed is null then
      return new;
    end if;
  end if;

  v_row := coalesce(v_new, v_old);

  insert into public.audit_log
    (organization_id, table_name, record_id, action, old_data, new_data, changed_fields, created_by)
  values (
    (v_row ->> 'organization_id')::uuid,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    tg_op,
    v_old,
    v_new,
    v_changed,
    auth.uid()
  );

  return coalesce(new, old);
end;
$$;

-- Tables sensibles
create trigger audit after insert or update or delete on public.organizations
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.departments
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.profiles
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.user_roles
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.clients
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.contacts
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.dossiers
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.dossier_affectations
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.verifications
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.documents
  for each row execute function public.tg_audit();
