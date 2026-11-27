create function public.initialiser_permissions_achats(p_org uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.role_permissions (organization_id, role, permission)
  select p_org, r.role::public.app_role, p.permission::public.app_permission
    from (values ('gerant'), ('directeur_operations'), ('acheteur')) r(role)
    cross join (values ('achats.read'), ('achats.write'), ('fournisseurs.manage')) p(permission)
  union all
  select p_org, 'gerant'::public.app_role, 'achats.validate'::public.app_permission
  union all
  select p_org, 'daf'::public.app_role, 'achats.read'::public.app_permission
  on conflict (organization_id, role, permission) do nothing;
$$;
revoke execute on function public.initialiser_permissions_achats(uuid) from public, anon, authenticated, service_role;

select public.initialiser_permissions_achats(id) from public.organizations;

create or replace function public.tg_organizations_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.initialiser_permissions(new.id);
  perform public.initialiser_permissions_phase3(new.id);
  perform public.initialiser_permissions_achats(new.id);
  return null;
end;
$$;

create table public.fournisseurs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nom text not null check (length(trim(nom)) between 1 and 200),
  rccm text,
  nif text,
  categorie text,
  contact text,
  email text,
  telephone text,
  evaluation smallint check (evaluation between 1 and 5),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index fournisseurs_org_nom on public.fournisseurs (organization_id, lower(trim(nom)));
create index fournisseurs_created_by_idx on public.fournisseurs (created_by);

create trigger fournisseurs_meta before insert or update on public.fournisseurs
  for each row execute function public.tg_meta();
create trigger audit after insert or update or delete on public.fournisseurs
  for each row execute function public.tg_audit();

alter table public.fournisseurs enable row level security;
revoke all on public.fournisseurs from anon, authenticated;
grant select, insert on public.fournisseurs to authenticated;
grant update (nom, rccm, nif, categorie, contact, email, telephone, evaluation, actif) on public.fournisseurs to authenticated;

create policy fournisseurs_select on public.fournisseurs for select to authenticated
  using (public.has_permission(organization_id, 'achats.read')
      or public.has_permission(organization_id, 'fournisseurs.manage'));

create policy fournisseurs_insert on public.fournisseurs for insert to authenticated
  with check (public.has_permission(organization_id, 'fournisseurs.manage'));

create policy fournisseurs_update on public.fournisseurs for update to authenticated
  using (public.has_permission(organization_id, 'fournisseurs.manage'))
  with check (public.has_permission(organization_id, 'fournisseurs.manage'));
