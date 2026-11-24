-- Phase 1 — Row Level Security sur toutes les tables
-- Les appels aux fonctions d'aide sont enveloppés dans (select …) quand ils ne
-- dépendent pas de la ligne, pour être évalués une seule fois par requête.

alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.dossier_counters enable row level security;
alter table public.dossiers enable row level security;
alter table public.dossier_affectations enable row level security;
alter table public.dossier_status_history enable row level security;
alter table public.verifications enable row level security;
alter table public.documents enable row level security;
alter table public.audit_log enable row level security;

-- Rôles qui créent et modifient les clients
create function public.can_write_clients(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_direction(p_org) or public.has_role(p_org, array[
    'responsable_departement', 'responsable_dossier'
  ]::public.app_role[]);
$$;

-- Visibilité d'un client : tous les rôles internes sauf l'agent terrain seul ;
-- l'agent terrain ne voit que les clients de ses dossiers affectés.
create function public.can_see_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client
      and (
        public.has_role(c.organization_id, array[
          'admin_systeme', 'gerant', 'associe', 'directeur_commercial',
          'directeur_operations', 'daf', 'responsable_departement',
          'responsable_dossier', 'acheteur', 'responsable_rh'
        ]::public.app_role[])
        or exists (
          select 1 from public.dossiers d
          where d.client_id = c.id and public.can_see_dossier(d.id)
        )
      )
  );
$$;

revoke execute on function public.can_write_clients(uuid) from public, anon;
revoke execute on function public.can_see_client(uuid) from public, anon;
grant execute on function public.can_write_clients(uuid) to authenticated;
grant execute on function public.can_see_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (id in (select public.user_org_ids()));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_role(id, array['admin_systeme', 'gerant']::public.app_role[]))
  with check (public.has_role(id, array['admin_systeme', 'gerant']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
create policy departments_select on public.departments
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));

create policy departments_write on public.departments
  for all to authenticated
  using (public.has_role(organization_id, array['admin_systeme']::public.app_role[]))
  with check (public.has_role(organization_id, array['admin_systeme']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- profiles : soi-même et les membres de ses organisations
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = profiles.id
        and ur.organization_id in (select public.user_org_ids())
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (organization_id is null or organization_id in (select public.user_org_ids()))
  );

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = profiles.id
      and public.has_role(ur.organization_id, array['admin_systeme', 'gerant']::public.app_role[])
  ))
  with check (organization_id is null or organization_id in (select public.user_org_ids()));

-- ---------------------------------------------------------------------------
-- user_roles : lecture par les membres internes ; écriture admin / gérant.
-- Seul un admin_systeme peut attribuer ou retirer le rôle admin_systeme.
-- ---------------------------------------------------------------------------
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_internal(organization_id));

create policy user_roles_insert on public.user_roles
  for insert to authenticated
  with check (
    public.has_role(organization_id, array['admin_systeme', 'gerant']::public.app_role[])
    and (role <> 'admin_systeme'
         or public.has_role(organization_id, array['admin_systeme']::public.app_role[]))
  );

create policy user_roles_update on public.user_roles
  for update to authenticated
  using (
    public.has_role(organization_id, array['admin_systeme', 'gerant']::public.app_role[])
    and (role <> 'admin_systeme'
         or public.has_role(organization_id, array['admin_systeme']::public.app_role[]))
  )
  with check (
    public.has_role(organization_id, array['admin_systeme', 'gerant']::public.app_role[])
    and (role <> 'admin_systeme'
         or public.has_role(organization_id, array['admin_systeme']::public.app_role[]))
  );

create policy user_roles_delete on public.user_roles
  for delete to authenticated
  using (
    public.has_role(organization_id, array['admin_systeme', 'gerant']::public.app_role[])
    and (role <> 'admin_systeme'
         or public.has_role(organization_id, array['admin_systeme']::public.app_role[]))
  );

-- ---------------------------------------------------------------------------
-- clients / contacts
-- ---------------------------------------------------------------------------
create policy clients_select on public.clients
  for select to authenticated
  using (public.can_see_client(id));

create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.can_write_clients(organization_id));

create policy clients_update on public.clients
  for update to authenticated
  using (public.can_write_clients(organization_id))
  with check (public.can_write_clients(organization_id));

create policy clients_delete on public.clients
  for delete to authenticated
  using (public.has_role(organization_id, array['admin_systeme', 'gerant']::public.app_role[]));

create policy contacts_select on public.contacts
  for select to authenticated
  using (public.can_see_client(client_id));

create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (public.can_write_clients(organization_id));

create policy contacts_update on public.contacts
  for update to authenticated
  using (public.can_write_clients(organization_id))
  with check (public.can_write_clients(organization_id));

create policy contacts_delete on public.contacts
  for delete to authenticated
  using (public.can_write_clients(organization_id));

-- dossier_counters : aucune politique → accès uniquement via le trigger (security definer)

-- ---------------------------------------------------------------------------
-- dossiers
-- ---------------------------------------------------------------------------
create policy dossiers_select on public.dossiers
  for select to authenticated
  using (
    public.is_direction(organization_id)
    or public.has_dept_role(organization_id, department_id, array[
         'responsable_departement', 'acheteur', 'responsable_rh'
       ]::public.app_role[])
    or (responsable_id = (select auth.uid()) and public.is_internal(organization_id))
    or exists (
      select 1 from public.dossier_affectations a
      where a.dossier_id = dossiers.id and a.user_id = (select auth.uid())
    )
  );

create policy dossiers_insert on public.dossiers
  for insert to authenticated
  with check (
    public.is_direction(organization_id)
    or public.has_dept_role(organization_id, department_id,
         array['responsable_departement']::public.app_role[])
    or (public.has_role(organization_id, array['responsable_dossier']::public.app_role[])
        and responsable_id = (select auth.uid()))
  );

create policy dossiers_update on public.dossiers
  for update to authenticated
  using (
    public.is_direction(organization_id)
    or public.has_dept_role(organization_id, department_id,
         array['responsable_departement']::public.app_role[])
    or (responsable_id = (select auth.uid()) and public.is_internal(organization_id))
  )
  with check (
    public.is_direction(organization_id)
    or public.has_dept_role(organization_id, department_id,
         array['responsable_departement']::public.app_role[])
    or (responsable_id = (select auth.uid()) and public.is_internal(organization_id))
  );

create policy dossiers_delete on public.dossiers
  for delete to authenticated
  using (public.has_role(organization_id, array['admin_systeme']::public.app_role[]) and statut = 'nouveau');

-- ---------------------------------------------------------------------------
-- dossier_affectations
-- ---------------------------------------------------------------------------
create policy dossier_affectations_select on public.dossier_affectations
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_see_dossier(dossier_id));

create policy dossier_affectations_insert on public.dossier_affectations
  for insert to authenticated
  with check (
    public.can_edit_dossier(dossier_id)
    and exists (select 1 from public.dossiers d
                where d.id = dossier_id and d.organization_id = dossier_affectations.organization_id)
    and exists (select 1 from public.user_roles ur
                where ur.user_id = dossier_affectations.user_id
                  and ur.organization_id = dossier_affectations.organization_id)
  );

create policy dossier_affectations_delete on public.dossier_affectations
  for delete to authenticated
  using (public.can_edit_dossier(dossier_id));

-- ---------------------------------------------------------------------------
-- dossier_status_history : lecture seule (écriture par change_dossier_status)
-- ---------------------------------------------------------------------------
create policy dossier_status_history_select on public.dossier_status_history
  for select to authenticated
  using (public.can_see_dossier(dossier_id));

-- ---------------------------------------------------------------------------
-- verifications
-- ---------------------------------------------------------------------------
create policy verifications_select on public.verifications
  for select to authenticated
  using (public.can_see_dossier(dossier_id));

create policy verifications_insert on public.verifications
  for insert to authenticated
  with check (public.can_edit_dossier(dossier_id));

create policy verifications_update on public.verifications
  for update to authenticated
  using (public.can_edit_dossier(dossier_id))
  with check (public.can_edit_dossier(dossier_id));

create policy verifications_delete on public.verifications
  for delete to authenticated
  using (public.can_edit_dossier(dossier_id));

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create policy documents_select on public.documents
  for select to authenticated
  using (
    (dossier_id is not null and public.can_see_dossier(dossier_id))
    or (dossier_id is null and client_id is not null and public.can_see_client(client_id))
  );

create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    (dossier_id is not null and public.can_edit_dossier(dossier_id))
    or (dossier_id is null and client_id is not null and public.can_write_clients(organization_id))
  );

create policy documents_update on public.documents
  for update to authenticated
  using (
    (dossier_id is not null and public.can_edit_dossier(dossier_id))
    or (dossier_id is null and client_id is not null and public.can_write_clients(organization_id))
  )
  with check (
    (dossier_id is not null and public.can_edit_dossier(dossier_id))
    or (dossier_id is null and client_id is not null and public.can_write_clients(organization_id))
  );

create policy documents_delete on public.documents
  for delete to authenticated
  using (public.has_role(organization_id, array['admin_systeme', 'gerant']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- audit_log : lecture admin / gérant / DAF ; écriture uniquement par triggers
-- ---------------------------------------------------------------------------
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.has_role(organization_id, array['admin_systeme', 'gerant', 'daf']::public.app_role[]));

-- Aucun accès anonyme aux tables métier
revoke all on all tables in schema public from anon;
