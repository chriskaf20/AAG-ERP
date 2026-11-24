-- Interface et règles par permissions : matrice rôle → permissions en base (source unique
-- pour la RLS, les fonctions et l'interface), portée par rôle (organisation / département /
-- dossiers propres / dossiers affectés), soumission des devis, marges, rapports.
-- Données de la matrice générées depuis src/lib/permissions.ts.

create type public.app_permission as enum (
  'dossiers.read_all',
  'dossiers.read_dept',
  'dossiers.read_own',
  'dossiers.read_assigned',
  'dossiers.create',
  'dossiers.verify',
  'dossiers.decide',
  'clients.read',
  'clients.write',
  'devis.read',
  'devis.write',
  'devis.validate',
  'devis.send',
  'factures.read',
  'factures.write',
  'paiements.write',
  'normalisation.write',
  'marges.read',
  'services.manage',
  'admin.users',
  'admin.settings',
  'audit.read',
  'reports.read'
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.app_role not null,
  permission public.app_permission not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, role, permission)
);

create index role_permissions_created_by_fk_idx on public.role_permissions (created_by);

create trigger role_permissions_meta before insert or update on public.role_permissions
  for each row execute function public.tg_meta();
create trigger audit after insert or update or delete on public.role_permissions
  for each row execute function public.tg_audit();

alter table public.role_permissions enable row level security;
create policy role_permissions_select on public.role_permissions
  for select to authenticated using (public.is_internal(organization_id));

-- Matrice par défaut d'une organisation
create function public.initialiser_permissions(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.role_permissions (organization_id, role, permission)
  select p_org, x.role::public.app_role, x.perm::public.app_permission
  from (values
      ('admin_systeme', 'admin.users'),
      ('admin_systeme', 'admin.settings'),
      ('admin_systeme', 'audit.read'),
      ('gerant', 'dossiers.read_all'),
      ('gerant', 'dossiers.create'),
      ('gerant', 'dossiers.verify'),
      ('gerant', 'dossiers.decide'),
      ('gerant', 'clients.read'),
      ('gerant', 'clients.write'),
      ('gerant', 'devis.read'),
      ('gerant', 'devis.write'),
      ('gerant', 'devis.validate'),
      ('gerant', 'devis.send'),
      ('gerant', 'factures.read'),
      ('gerant', 'factures.write'),
      ('gerant', 'paiements.write'),
      ('gerant', 'normalisation.write'),
      ('gerant', 'marges.read'),
      ('gerant', 'services.manage'),
      ('gerant', 'admin.users'),
      ('gerant', 'admin.settings'),
      ('gerant', 'audit.read'),
      ('gerant', 'reports.read'),
      ('associe', 'marges.read'),
      ('associe', 'reports.read'),
      ('directeur_commercial', 'dossiers.read_all'),
      ('directeur_commercial', 'dossiers.create'),
      ('directeur_commercial', 'dossiers.verify'),
      ('directeur_commercial', 'clients.read'),
      ('directeur_commercial', 'clients.write'),
      ('directeur_commercial', 'devis.read'),
      ('directeur_commercial', 'devis.write'),
      ('directeur_commercial', 'factures.read'),
      ('directeur_commercial', 'marges.read'),
      ('directeur_commercial', 'services.manage'),
      ('directeur_commercial', 'reports.read'),
      ('directeur_operations', 'dossiers.read_all'),
      ('directeur_operations', 'dossiers.create'),
      ('directeur_operations', 'dossiers.verify'),
      ('directeur_operations', 'clients.read'),
      ('directeur_operations', 'clients.write'),
      ('directeur_operations', 'devis.read'),
      ('directeur_operations', 'devis.write'),
      ('directeur_operations', 'marges.read'),
      ('directeur_operations', 'reports.read'),
      ('daf', 'dossiers.read_all'),
      ('daf', 'clients.read'),
      ('daf', 'devis.read'),
      ('daf', 'factures.read'),
      ('daf', 'factures.write'),
      ('daf', 'paiements.write'),
      ('daf', 'normalisation.write'),
      ('daf', 'marges.read'),
      ('daf', 'audit.read'),
      ('daf', 'reports.read'),
      ('responsable_departement', 'dossiers.read_dept'),
      ('responsable_departement', 'dossiers.create'),
      ('responsable_departement', 'dossiers.verify'),
      ('responsable_departement', 'clients.read'),
      ('responsable_departement', 'clients.write'),
      ('responsable_departement', 'devis.read'),
      ('responsable_departement', 'devis.write'),
      ('responsable_departement', 'devis.send'),
      ('responsable_departement', 'factures.read'),
      ('responsable_departement', 'marges.read'),
      ('responsable_dossier', 'dossiers.read_own'),
      ('responsable_dossier', 'dossiers.create'),
      ('responsable_dossier', 'dossiers.verify'),
      ('responsable_dossier', 'clients.read'),
      ('responsable_dossier', 'clients.write'),
      ('responsable_dossier', 'devis.read'),
      ('responsable_dossier', 'devis.write'),
      ('responsable_dossier', 'factures.read'),
      ('responsable_dossier', 'marges.read'),
      ('acheteur', 'dossiers.read_dept'),
      ('acheteur', 'clients.read'),
      ('responsable_rh', 'dossiers.read_dept'),
      ('responsable_rh', 'clients.read'),
      ('agent_terrain', 'dossiers.read_assigned')
  ) as x(role, perm)
  on conflict (organization_id, role, permission) do nothing;
$$;
revoke execute on function public.initialiser_permissions(uuid) from public, anon, authenticated;

select public.initialiser_permissions(id) from public.organizations;

create function public.tg_organizations_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.initialiser_permissions(new.id);
  return null;
end; $$;

create trigger organizations_permissions after insert on public.organizations
  for each row execute function public.tg_organizations_permissions();

-- ---------------------------------------------------------------------------
-- Fonctions de droits
-- ---------------------------------------------------------------------------
-- Un rôle donné possède-t-il une permission dans l'organisation ?
create function public.role_a(p_org uuid, p_role public.app_role, p_perm public.app_permission)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.role_permissions
                  where organization_id = p_org and role = p_role and permission = p_perm);
$$;

-- Union des permissions de l'utilisateur dans l'organisation
create function public.has_permission(p_org uuid, p_perm public.app_permission)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.organization_id = ur.organization_id and rp.role = ur.role
    where ur.user_id = auth.uid() and ur.organization_id = p_org and rp.permission = p_perm
  );
$$;

create function public.mes_permissions(p_org uuid)
returns public.app_permission[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct rp.permission order by rp.permission), '{}')
  from public.user_roles ur
  join public.role_permissions rp on rp.organization_id = ur.organization_id and rp.role = ur.role
  where ur.user_id = auth.uid() and ur.organization_id = p_org;
$$;

-- Permission p_perm portée par un rôle dont le périmètre couvre (département, responsable) ;
-- p_perm null = simple visibilité.
create function public.peut_sur(p_org uuid, p_dept uuid, p_responsable uuid, p_perm public.app_permission)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.organization_id = p_org
      and (p_perm is null or public.role_a(p_org, ur.role, p_perm))
      and (
        public.role_a(p_org, ur.role, 'dossiers.read_all')
        or (ur.department_id = p_dept and public.role_a(p_org, ur.role, 'dossiers.read_dept'))
        or (p_responsable = auth.uid() and public.role_a(p_org, ur.role, 'dossiers.read_own'))
      )
  );
$$;

-- Permission sur un dossier précis (périmètre du rôle qui la porte, affectations incluses)
create function public.dossier_perm(p_dossier uuid, p_perm public.app_permission default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.dossiers d
    join public.user_roles ur on ur.organization_id = d.organization_id and ur.user_id = auth.uid()
    where d.id = p_dossier
      and (p_perm is null or public.role_a(d.organization_id, ur.role, p_perm))
      and (
        public.role_a(d.organization_id, ur.role, 'dossiers.read_all')
        or (ur.department_id = d.department_id and public.role_a(d.organization_id, ur.role, 'dossiers.read_dept'))
        or (d.responsable_id = auth.uid() and public.role_a(d.organization_id, ur.role, 'dossiers.read_own'))
        or (public.role_a(d.organization_id, ur.role, 'dossiers.read_assigned')
            and exists (select 1 from public.dossier_affectations a where a.dossier_id = d.id and a.user_id = auth.uid()))
      )
  );
$$;

-- Droits effectifs sur un dossier (pour l'interface)
create function public.droits_dossier(p_dossier uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'voir', public.dossier_perm(p_dossier),
    'verify', public.dossier_perm(p_dossier, 'dossiers.verify'),
    'decide', public.dossier_perm(p_dossier, 'dossiers.decide'),
    'devis_read', public.dossier_perm(p_dossier, 'devis.read'),
    'devis_write', public.dossier_perm(p_dossier, 'devis.write'),
    'devis_validate', public.dossier_perm(p_dossier, 'devis.validate'),
    'devis_send', public.dossier_perm(p_dossier, 'devis.send'),
    'factures_read', public.dossier_perm(p_dossier, 'factures.read'),
    'factures_write', public.dossier_perm(p_dossier, 'factures.write'),
    'paiements_write', public.dossier_perm(p_dossier, 'paiements.write'),
    'normalisation_write', public.dossier_perm(p_dossier, 'normalisation.write'),
    'marges_read', public.dossier_perm(p_dossier, 'marges.read'),
    'clients_write', public.dossier_perm(p_dossier, 'clients.write')
  );
$$;

-- Réécriture des fonctions d'aide existantes sur la matrice
create or replace function public.is_direction(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission(p_org, 'dossiers.read_all');
$$;

create or replace function public.is_finance(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission(p_org, 'factures.write');
$$;

create or replace function public.can_see_dossier(p_dossier uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.dossier_perm(p_dossier);
$$;

create or replace function public.can_edit_dossier(p_dossier uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.dossier_perm(p_dossier, 'dossiers.verify');
$$;

create or replace function public.can_see_finance(p_dossier uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.dossier_perm(p_dossier, 'devis.read') or public.dossier_perm(p_dossier, 'factures.read');
$$;

create or replace function public.can_write_clients(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission(p_org, 'clients.write');
$$;

create or replace function public.can_see_client(p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client
      and (public.has_permission(c.organization_id, 'clients.read')
           or exists (select 1 from public.dossiers d where d.client_id = c.id and public.dossier_perm(d.id)))
  );
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'role_a(uuid, public.app_role, public.app_permission)', 'has_permission(uuid, public.app_permission)',
    'mes_permissions(uuid)', 'peut_sur(uuid, uuid, uuid, public.app_permission)',
    'dossier_perm(uuid, public.app_permission)', 'droits_dossier(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Politiques RLS sur les permissions
-- ---------------------------------------------------------------------------
drop policy dossiers_select on public.dossiers;
drop policy dossiers_insert on public.dossiers;
drop policy dossiers_update on public.dossiers;
drop policy dossiers_delete on public.dossiers;
create policy dossiers_select on public.dossiers for select to authenticated
  using (public.dossier_perm(id));
create policy dossiers_insert on public.dossiers for insert to authenticated
  with check (public.peut_sur(organization_id, department_id, responsable_id, 'dossiers.create'));
create policy dossiers_update on public.dossiers for update to authenticated
  using (public.dossier_perm(id, 'dossiers.verify'))
  with check (public.peut_sur(organization_id, department_id, responsable_id, 'dossiers.verify'));
create policy dossiers_delete on public.dossiers for delete to authenticated
  using (public.has_permission(organization_id, 'dossiers.decide') and statut = 'nouveau');

drop policy audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.has_permission(organization_id, 'audit.read'));

drop policy clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated
  using (public.has_permission(organization_id, 'dossiers.decide'));

drop policy departments_insert on public.departments;
drop policy departments_update on public.departments;
drop policy departments_delete on public.departments;
create policy departments_insert on public.departments for insert to authenticated
  with check (public.has_permission(organization_id, 'admin.settings'));
create policy departments_update on public.departments for update to authenticated
  using (public.has_permission(organization_id, 'admin.settings'))
  with check (public.has_permission(organization_id, 'admin.settings'));
create policy departments_delete on public.departments for delete to authenticated
  using (public.has_permission(organization_id, 'admin.settings'));

drop policy documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated
  using (public.has_permission(organization_id, 'dossiers.decide'));

drop policy organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_permission(id, 'admin.settings'))
  with check (public.has_permission(id, 'admin.settings'));

drop policy profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or exists (select 1 from public.user_roles ur
               where ur.user_id = profiles.id and public.has_permission(ur.organization_id, 'admin.users'))
  )
  with check (organization_id is null or organization_id in (select public.user_org_ids()));

drop policy services_insert on public.services;
drop policy services_update on public.services;
drop policy services_delete on public.services;
create policy services_insert on public.services for insert to authenticated
  with check (public.has_permission(organization_id, 'services.manage'));
create policy services_update on public.services for update to authenticated
  using (public.has_permission(organization_id, 'services.manage'))
  with check (public.has_permission(organization_id, 'services.manage'));
create policy services_delete on public.services for delete to authenticated
  using (public.has_permission(organization_id, 'services.manage'));

drop policy user_roles_insert on public.user_roles;
drop policy user_roles_update on public.user_roles;
drop policy user_roles_delete on public.user_roles;
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (public.has_permission(organization_id, 'admin.users')
              and (role <> 'admin_systeme' or public.has_role(organization_id, array['admin_systeme']::public.app_role[])));
create policy user_roles_update on public.user_roles for update to authenticated
  using (public.has_permission(organization_id, 'admin.users')
         and (role <> 'admin_systeme' or public.has_role(organization_id, array['admin_systeme']::public.app_role[])))
  with check (public.has_permission(organization_id, 'admin.users')
              and (role <> 'admin_systeme' or public.has_role(organization_id, array['admin_systeme']::public.app_role[])));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (public.has_permission(organization_id, 'admin.users')
         and (role <> 'admin_systeme' or public.has_role(organization_id, array['admin_systeme']::public.app_role[])));

drop policy "dossiers_suppression" on storage.objects;
drop policy "clients_suppression" on storage.objects;
create policy "dossiers_suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'dossiers' and public.storage_dossier_acces(name, false)
         and public.has_permission(((storage.foldername(name))[1])::uuid, 'dossiers.decide'));
create policy "clients_suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'clients' and public.storage_client_acces(name, false)
         and public.has_permission(((storage.foldername(name))[1])::uuid, 'dossiers.decide'));

-- Commercial (devis, lignes, PV, contrats, signatures, liens)
drop policy devis_select on public.devis;
drop policy devis_insert on public.devis;
drop policy devis_update on public.devis;
drop policy devis_delete on public.devis;
create policy devis_select on public.devis for select to authenticated using (public.dossier_perm(dossier_id, 'devis.read'));
create policy devis_insert on public.devis for insert to authenticated with check (public.dossier_perm(dossier_id, 'devis.write'));
create policy devis_update on public.devis for update to authenticated
  using (public.dossier_perm(dossier_id, 'devis.write')) with check (public.dossier_perm(dossier_id, 'devis.write'));
create policy devis_delete on public.devis for delete to authenticated using (public.dossier_perm(dossier_id, 'devis.write'));

drop policy devis_lignes_select on public.devis_lignes;
drop policy devis_lignes_insert on public.devis_lignes;
drop policy devis_lignes_update on public.devis_lignes;
drop policy devis_lignes_delete on public.devis_lignes;
create policy devis_lignes_select on public.devis_lignes for select to authenticated
  using (public.dossier_perm(public.devis_dossier(devis_id), 'devis.read'));
create policy devis_lignes_insert on public.devis_lignes for insert to authenticated
  with check (public.dossier_perm(public.devis_dossier(devis_id), 'devis.write'));
create policy devis_lignes_update on public.devis_lignes for update to authenticated
  using (public.dossier_perm(public.devis_dossier(devis_id), 'devis.write'))
  with check (public.dossier_perm(public.devis_dossier(devis_id), 'devis.write'));
create policy devis_lignes_delete on public.devis_lignes for delete to authenticated
  using (public.dossier_perm(public.devis_dossier(devis_id), 'devis.write'));

drop policy pv_lancement_select on public.pv_lancement;
drop policy pv_lancement_insert on public.pv_lancement;
drop policy pv_lancement_update on public.pv_lancement;
drop policy pv_lancement_delete on public.pv_lancement;
create policy pv_lancement_select on public.pv_lancement for select to authenticated using (public.dossier_perm(dossier_id, 'devis.read'));
create policy pv_lancement_insert on public.pv_lancement for insert to authenticated with check (public.dossier_perm(dossier_id, 'devis.write'));
create policy pv_lancement_update on public.pv_lancement for update to authenticated
  using (public.dossier_perm(dossier_id, 'devis.write')) with check (public.dossier_perm(dossier_id, 'devis.write'));
create policy pv_lancement_delete on public.pv_lancement for delete to authenticated using (public.dossier_perm(dossier_id, 'devis.write'));

drop policy contrats_select on public.contrats;
drop policy contrats_insert on public.contrats;
drop policy contrats_update on public.contrats;
drop policy contrats_delete on public.contrats;
create policy contrats_select on public.contrats for select to authenticated using (public.dossier_perm(dossier_id, 'devis.read'));
create policy contrats_insert on public.contrats for insert to authenticated with check (public.dossier_perm(dossier_id, 'devis.write'));
create policy contrats_update on public.contrats for update to authenticated
  using (public.dossier_perm(dossier_id, 'devis.write')) with check (public.dossier_perm(dossier_id, 'devis.write'));
create policy contrats_delete on public.contrats for delete to authenticated using (public.dossier_perm(dossier_id, 'devis.write'));

drop policy avenants_select on public.avenants;
drop policy avenants_insert on public.avenants;
drop policy avenants_update on public.avenants;
drop policy avenants_delete on public.avenants;
create policy avenants_select on public.avenants for select to authenticated
  using (public.dossier_perm(public.contrat_dossier(contrat_id), 'devis.read'));
create policy avenants_insert on public.avenants for insert to authenticated
  with check (public.dossier_perm(public.contrat_dossier(contrat_id), 'devis.write'));
create policy avenants_update on public.avenants for update to authenticated
  using (public.dossier_perm(public.contrat_dossier(contrat_id), 'devis.write'))
  with check (public.dossier_perm(public.contrat_dossier(contrat_id), 'devis.write'));
create policy avenants_delete on public.avenants for delete to authenticated
  using (public.dossier_perm(public.contrat_dossier(contrat_id), 'devis.write'));

drop policy signatures_select on public.signatures;
create policy signatures_select on public.signatures for select to authenticated using (public.dossier_perm(dossier_id, 'devis.read'));
drop policy liens_signature_select on public.liens_signature;
create policy liens_signature_select on public.liens_signature for select to authenticated using (public.dossier_perm(dossier_id, 'devis.write'));

-- Finance
drop policy factures_select on public.factures;
drop policy factures_insert on public.factures;
drop policy factures_update on public.factures;
drop policy factures_delete on public.factures;
create policy factures_select on public.factures for select to authenticated using (public.dossier_perm(dossier_id, 'factures.read'));
create policy factures_insert on public.factures for insert to authenticated
  with check (public.is_finance(organization_id) and public.dossier_perm(dossier_id));
create policy factures_update on public.factures for update to authenticated
  using (public.is_finance(organization_id) and public.dossier_perm(dossier_id))
  with check (public.is_finance(organization_id) and public.dossier_perm(dossier_id));
create policy factures_delete on public.factures for delete to authenticated
  using (public.is_finance(organization_id) and public.dossier_perm(dossier_id));

drop policy facture_lignes_select on public.facture_lignes;
drop policy facture_lignes_insert on public.facture_lignes;
drop policy facture_lignes_update on public.facture_lignes;
drop policy facture_lignes_delete on public.facture_lignes;
create policy facture_lignes_select on public.facture_lignes for select to authenticated
  using (public.dossier_perm(public.facture_dossier(facture_id), 'factures.read'));
create policy facture_lignes_insert on public.facture_lignes for insert to authenticated
  with check (public.is_finance(organization_id));
create policy facture_lignes_update on public.facture_lignes for update to authenticated
  using (public.is_finance(organization_id)) with check (public.is_finance(organization_id));
create policy facture_lignes_delete on public.facture_lignes for delete to authenticated
  using (public.is_finance(organization_id));

drop policy avoirs_select on public.avoirs;
create policy avoirs_select on public.avoirs for select to authenticated using (public.dossier_perm(dossier_id, 'factures.read'));
drop policy paiements_select on public.paiements;
drop policy paiements_insert on public.paiements;
create policy paiements_select on public.paiements for select to authenticated using (public.dossier_perm(dossier_id, 'factures.read'));
create policy paiements_insert on public.paiements for insert to authenticated
  with check (public.has_permission(organization_id, 'paiements.write'));
drop policy def_transmissions_select on public.def_transmissions;
create policy def_transmissions_select on public.def_transmissions for select to authenticated
  using (public.has_permission(organization_id, 'normalisation.write'));
drop policy relances_select on public.relances;
create policy relances_select on public.relances for select to authenticated
  using (public.dossier_perm(dossier_id, 'factures.read') or public.dossier_perm(dossier_id, 'devis.read'));

-- ---------------------------------------------------------------------------
-- Marges : coût estimé par ligne de devis
-- ---------------------------------------------------------------------------
alter table public.devis_lignes add column cout_unitaire numeric(14, 2) check (cout_unitaire is null or cout_unitaire >= 0);
alter table public.devis
  add column total_cout numeric(14, 2) not null default 0,
  add column marge numeric(14, 2) not null default 0,
  add column soumis_le timestamptz,
  add column soumis_par uuid references public.profiles (id) on delete set null;
create index devis_soumis_par_fk_idx on public.devis (soumis_par);

create or replace function public.devis_totaux(d public.devis)
returns public.devis
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seuil numeric;
begin
  select coalesce(sum(montant_brut), 0), coalesce(sum(montant_ht), 0),
         coalesce(sum(round(quantite * coalesce(cout_unitaire, 0), 2)), 0)
    into d.total_brut, d.total_ht, d.total_cout
  from public.devis_lignes where devis_id = d.id;

  d.total_remise := d.total_brut - d.total_ht;
  d.marge := d.total_ht - d.total_cout;
  d.total_taxes := public.calcul_taxes(d.total_ht, d.taxes);
  d.total_ttc := d.total_ht + d.total_taxes;
  d.total_ttc_usd := case when d.devise = 'CDF' then round(d.total_ttc / d.taux_cdf, 2) else d.total_ttc end;

  select (parametres ->> 'seuil_validation_usd')::numeric into v_seuil
  from public.organizations where id = d.organization_id;
  d.depasse_seuil := d.total_ttc_usd > coalesce(v_seuil, 0);
  d.date_validite := d.date_devis + d.validite_jours;
  return d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications et soumission des devis au responsable de département
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  titre text not null,
  message text,
  lien text,
  lu_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, lu_le, created_at desc);
create index notifications_org_fk_idx on public.notifications (organization_id);
create index notifications_created_by_fk_idx on public.notifications (created_by);
create trigger notifications_meta before insert or update on public.notifications
  for each row execute function public.tg_meta();
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.soumettre_devis(p_devis uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
  ds public.dossiers;
  v_nb integer;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.dossier_perm(d.dossier_id, 'devis.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if d.statut not in ('brouillon', 'valide') then
    raise exception 'Seul un devis en préparation peut être soumis' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.devis_lignes where devis_id = d.id) then
    raise exception 'Devis sans ligne' using errcode = 'check_violation';
  end if;
  select * into ds from public.dossiers where id = d.dossier_id;

  perform set_config('atlas.finance_systeme', 'on', true);
  update public.devis set soumis_le = clock_timestamp(), soumis_par = auth.uid() where id = d.id;
  perform set_config('atlas.finance_systeme', 'off', true);

  insert into public.notifications (organization_id, user_id, titre, message, lien)
  select distinct d.organization_id, ur.user_id,
         'Devis ' || d.numero || ' v' || d.version || ' à envoyer',
         'Soumis pour le dossier ' || ds.numero || (case when d.depasse_seuil and d.statut <> 'valide'
           then ' — validation du gérant requise avant l''envoi' else '' end),
         '/dossiers/' || ds.id || '?onglet=devis'
  from public.user_roles ur
  where ur.organization_id = d.organization_id and ur.role = 'responsable_departement'
    and ur.department_id = ds.department_id and ur.user_id <> auth.uid();
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;
revoke execute on function public.soumettre_devis(uuid) from public, anon;
grant execute on function public.soumettre_devis(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rapports (indicateurs agrégés, permission reports.read)
-- ---------------------------------------------------------------------------
create function public.rapport_indicateurs(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_debut date := date_trunc('year', current_date)::date;
begin
  if not public.has_permission(p_org, 'reports.read') then
    raise exception 'Rapports non autorisés' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'annee', extract(year from current_date),
    'dossiers_par_statut', (select coalesce(jsonb_object_agg(statut, n), '{}') from (
        select statut, count(*) n from public.dossiers where organization_id = p_org group by statut) s),
    'devis_signes', (select count(*) from public.devis where organization_id = p_org and statut = 'signe'),
    'ca_signe_ht_usd', (select coalesce(sum(case when devise = 'CDF' then total_ht / taux_cdf else total_ht end), 0)
                          from public.devis where organization_id = p_org and statut = 'signe' and signe_le >= v_debut),
    'ca_facture_ht_usd', (select coalesce(sum(case when devise = 'CDF' then total_ht / taux_cdf else total_ht end), 0)
                            from public.factures where organization_id = p_org
                              and statut not in ('brouillon', 'annulee') and date_emission >= v_debut),
    'encaisse_usd', (select coalesce(sum(case when p.devise = 'CDF' then p.montant / f.taux_cdf else p.montant end), 0)
                       from public.paiements p join public.factures f on f.id = p.facture_id
                      where p.organization_id = p_org and p.date_paiement >= v_debut),
    'impayes_usd', (select coalesce(sum(case when devise = 'CDF' then solde_du / taux_cdf else solde_du end), 0)
                      from public.factures where organization_id = p_org
                        and statut in ('emise', 'normalisee', 'partiellement_payee', 'en_retard')),
    'marge_signee_usd', case when public.has_permission(p_org, 'marges.read') then
        (select coalesce(sum(case when devise = 'CDF' then marge / taux_cdf else marge end), 0)
           from public.devis where organization_id = p_org and statut = 'signe') end
  );
end;
$$;
revoke execute on function public.rapport_indicateurs(uuid) from public, anon;
grant execute on function public.rapport_indicateurs(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions métier : contrôles sur les permissions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_dossier_status(p_dossier_id uuid, p_nouveau_statut dossier_statut, p_motif text DEFAULT NULL::text)
 RETURNS dossiers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  d public.dossiers;
  v public.verifications;
  v_ancien public.dossier_statut;
  v_motif text := nullif(trim(p_motif), '');
  v_gerant boolean;
  v_pilote boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;

  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found or not public.can_see_dossier(p_dossier_id) then
    raise exception 'Dossier introuvable' using errcode = 'no_data_found';
  end if;
  v_ancien := d.statut;

  if d.statut = p_nouveau_statut then
    raise exception 'Le dossier est déjà au statut %', p_nouveau_statut using errcode = 'check_violation';
  end if;

  v_gerant := public.has_permission(d.organization_id, 'dossiers.decide');
  v_pilote := public.can_edit_dossier(p_dossier_id);

  if d.statut in ('nouveau', 'complement_requis') and p_nouveau_statut = 'en_verification' then
    if not v_pilote then
      raise exception 'Seul le pilote du dossier peut lancer la vérification'
        using errcode = 'insufficient_privilege';
    end if;

  elsif d.statut = 'en_verification'
        and p_nouveau_statut in ('accepte', 'complement_requis', 'refuse') then
    if not v_gerant then
      raise exception 'Décision réservée au gérant' using errcode = 'insufficient_privilege';
    end if;
    select * into v from public.verifications
    where dossier_id = d.id and valide_le is not null
      and valide_le > coalesce(d.statut_change_le, '-infinity'::timestamptz)
    order by valide_le desc
    limit 1;
    if not found then
      raise exception 'Décision impossible : la fiche de vérification F-02 doit être validée par le gérant'
        using errcode = 'check_violation';
    end if;
    if v.decision::text <> p_nouveau_statut::text then
      raise exception 'La décision de la vérification validée (%) ne correspond pas au statut demandé (%)',
        v.decision, p_nouveau_statut using errcode = 'check_violation';
    end if;
    if p_nouveau_statut = 'refuse' then
      v_motif := coalesce(v_motif, nullif(trim(v.motif), ''));
    elsif p_nouveau_statut = 'complement_requis' then
      v_motif := coalesce(v_motif, nullif(trim(v.pieces_demandees), ''));
    end if;
    if p_nouveau_statut in ('refuse', 'complement_requis') and v_motif is null then
      raise exception 'Motif obligatoire' using errcode = 'check_violation';
    end if;

  elsif p_nouveau_statut = 'classe_sans_suite'
        and d.statut in ('nouveau', 'en_verification', 'complement_requis') then
    if not v_gerant then
      raise exception 'Classement sans suite réservé au gérant' using errcode = 'insufficient_privilege';
    end if;
    if v_motif is null then
      raise exception 'Motif obligatoire' using errcode = 'check_violation';
    end if;

  elsif d.statut = 'accepte' and p_nouveau_statut = 'devis_envoye' then
    if not v_pilote then
      raise exception 'Seul le pilote du dossier peut changer ce statut' using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.devis
                    where dossier_id = d.id and statut in ('envoye', 'signe')
                      and (not depasse_seuil or valide_le is not null)) then
      raise exception 'Aucun devis envoyé (et validé par le gérant s''il dépasse le seuil)'
        using errcode = 'check_violation';
    end if;

  elsif d.statut = 'devis_envoye' and p_nouveau_statut = 'en_lancement' then
    if not v_pilote then
      raise exception 'Seul le pilote du dossier peut changer ce statut' using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.devis where dossier_id = d.id and statut = 'signe') then
      raise exception 'Lancement impossible : devis non signé' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.factures
                    where dossier_id = d.id and type = 'acompte' and statut = 'payee') then
      raise exception 'Lancement impossible : acompte non encaissé' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.pv_lancement where dossier_id = d.id and signe_le is not null) then
      raise exception 'Lancement impossible : PV de lancement F-04 non signé par les deux parties'
        using errcode = 'check_violation';
    end if;

  elsif d.statut = 'receptionne_a_facturer' and p_nouveau_statut = 'cloture' then
    if not v_pilote then
      raise exception 'Seul le pilote du dossier peut clôturer' using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.factures where dossier_id = d.id and statut not in ('brouillon', 'annulee')) then
      raise exception 'Clôture impossible : aucune facture émise' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.factures
                where dossier_id = d.id and statut not in ('brouillon', 'annulee') and normalisee_le is null) then
      raise exception 'Clôture impossible : toutes les factures doivent être normalisées (e-DEF)'
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.factures
                where dossier_id = d.id and statut not in ('brouillon', 'annulee') and solde_du > 0) then
      raise exception 'Clôture impossible : factures non soldées' using errcode = 'check_violation';
    end if;

  else
    raise exception 'Transition % → % non autorisée', d.statut, p_nouveau_statut
      using errcode = 'check_violation';
  end if;

  perform set_config('atlas.changement_statut', 'on', true);
  update public.dossiers
     set statut = p_nouveau_statut,
         statut_motif = v_motif,
         statut_change_le = clock_timestamp()
   where id = d.id
  returning * into d;
  perform set_config('atlas.changement_statut', 'off', true);

  insert into public.dossier_status_history
    (organization_id, dossier_id, ancien_statut, nouveau_statut, motif, created_by)
  values (d.organization_id, d.id, v_ancien, p_nouveau_statut, v_motif, v_uid);

  insert into public.audit_log
    (organization_id, table_name, record_id, action, old_data, new_data, motif, created_by)
  values (
    d.organization_id, 'dossiers', d.id, 'STATUT',
    jsonb_build_object('statut', v_ancien),
    jsonb_build_object('statut', p_nouveau_statut),
    v_motif, v_uid
  );

  return d;
end;
$function$;

CREATE OR REPLACE FUNCTION public.valider_verification(p_verification_id uuid)
 RETURNS dossiers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v public.verifications;
  v_erreurs text[];
  v_motif text;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;

  select * into v from public.verifications where id = p_verification_id for update;
  if not found or not public.can_see_dossier(v.dossier_id) then
    raise exception 'Vérification introuvable' using errcode = 'no_data_found';
  end if;
  if not public.has_permission(v.organization_id, 'dossiers.decide') then
    raise exception 'Validation réservée au gérant' using errcode = 'insufficient_privilege';
  end if;
  if v.valide_le is not null then
    raise exception 'Vérification déjà validée' using errcode = 'check_violation';
  end if;

  v_erreurs := public.verification_erreurs(v);
  if cardinality(v_erreurs) > 0 then
    raise exception 'Vérification incomplète : %', array_to_string(v_erreurs, ' ; ')
      using errcode = 'check_violation';
  end if;

  perform set_config('atlas.validation_verification', 'on', true);
  update public.verifications
     set valide_par = v_uid, valide_le = clock_timestamp()
   where id = v.id
  returning * into v;
  perform set_config('atlas.validation_verification', 'off', true);

  insert into public.audit_log
    (organization_id, table_name, record_id, action, new_data, created_by)
  values (
    v.organization_id, 'verifications', v.id, 'VALIDATION',
    jsonb_build_object('decision', v.decision, 'valide_par', v_uid), v_uid
  );

  v_motif := case v.decision
    when 'refuse' then v.motif
    when 'complement_requis' then v.pieces_demandees
  end;

  return public.change_dossier_status(v.dossier_id, v.decision::text::public.dossier_statut, v_motif);
end;
$function$;

CREATE OR REPLACE FUNCTION public.valider_devis(p_devis uuid)
 RETURNS devis
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.devis;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.can_see_finance(d.dossier_id) then
    raise exception 'Devis introuvable' using errcode = 'no_data_found';
  end if;
  if not public.has_permission(d.organization_id, 'devis.validate') then
    raise exception 'Validation réservée au gérant' using errcode = 'insufficient_privilege';
  end if;
  if d.statut <> 'brouillon' then
    raise exception 'Seul un devis brouillon peut être validé' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.devis_lignes where devis_id = d.id) then
    raise exception 'Devis sans ligne' using errcode = 'check_violation';
  end if;
  perform set_config('atlas.finance_systeme', 'on', true);
  update public.devis set statut = 'valide', valide_par = auth.uid(), valide_le = clock_timestamp()
   where id = d.id returning * into d;
  perform set_config('atlas.finance_systeme', 'off', true);
  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (d.organization_id, 'devis', d.id, 'VALIDATION',
          jsonb_build_object('numero', d.numero, 'version', d.version, 'total_ttc_usd', d.total_ttc_usd), auth.uid());
  return d;
end;
$function$;

CREATE OR REPLACE FUNCTION public.envoyer_devis(p_devis uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.devis;
  v_token text;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.can_see_finance(d.dossier_id) then
    raise exception 'Devis introuvable' using errcode = 'no_data_found';
  end if;
  if not public.dossier_perm(d.dossier_id, 'devis.send') then
    raise exception 'Envoi réservé au responsable du département du dossier ou au gérant' using errcode = 'insufficient_privilege';
  end if;
  if d.statut not in ('brouillon', 'valide') then
    raise exception 'Devis % : déjà envoyé ou clos', d.statut using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.devis_lignes where devis_id = d.id) or d.total_ttc <= 0 then
    raise exception 'Devis vide' using errcode = 'check_violation';
  end if;
  if d.depasse_seuil and d.statut <> 'valide' then
    raise exception 'Devis au-dessus du seuil de validation : validation du gérant requise avant l''envoi'
      using errcode = 'check_violation';
  end if;
  if d.date_validite < current_date then
    raise exception 'Devis expiré : modifiez la date ou créez une nouvelle version' using errcode = 'check_violation';
  end if;

  perform set_config('atlas.finance_systeme', 'on', true);
  update public.devis set statut = 'envoye', envoye_par = auth.uid(), envoye_le = clock_timestamp()
   where id = d.id returning * into d;
  perform set_config('atlas.finance_systeme', 'off', true);

  v_token := public.creer_lien_signature('devis', d.id, d.dossier_id, d.organization_id,
                                         (d.date_validite + 1)::timestamptz);
  insert into public.audit_log (organization_id, table_name, record_id, action, old_data, new_data, created_by)
  values (d.organization_id, 'devis', d.id, 'STATUT', jsonb_build_object('statut', 'brouillon'),
          jsonb_build_object('statut', 'envoye'), auth.uid());
  return jsonb_build_object('devis_id', d.id, 'numero', d.numero, 'version', d.version, 'token', v_token);
end;
$function$;

CREATE OR REPLACE FUNCTION public.regenerer_lien_devis(p_devis uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.devis;
begin
  select * into d from public.devis where id = p_devis;
  if not found or not public.dossier_perm(d.dossier_id, 'devis.send') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if d.statut <> 'envoye' then
    raise exception 'Seul un devis envoyé peut recevoir un lien de signature' using errcode = 'check_violation';
  end if;
  return public.creer_lien_signature('devis', d.id, d.dossier_id, d.organization_id,
                                     (d.date_validite + 1)::timestamptz);
end;
$function$;

CREATE OR REPLACE FUNCTION public.nouvelle_version_devis(p_devis uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.devis;
  v_id uuid;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.dossier_perm(d.dossier_id, 'devis.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if d.statut in ('brouillon', 'valide', 'remplace') then
    raise exception 'Devis % : modifiez-le directement', d.statut using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.devis where organization_id = d.organization_id and numero = d.numero
             and statut in ('brouillon', 'valide')) then
    raise exception 'Une version en cours de rédaction existe déjà' using errcode = 'check_violation';
  end if;

  insert into public.devis (organization_id, dossier_id, version_precedente_id, objet, devise, taux_cdf,
                            taxes, acompte_pct, validite_jours, conditions_paiement)
  values (d.organization_id, d.dossier_id, d.id, d.objet, d.devise, d.taux_cdf,
          d.taxes, d.acompte_pct, d.validite_jours, d.conditions_paiement)
  returning id into v_id;

  insert into public.devis_lignes (organization_id, devis_id, ordre, service_id, description, unite,
                                   quantite, prix_unitaire, remise_pct, cout_unitaire)
  select organization_id, v_id, ordre, service_id, description, unite, quantite, prix_unitaire, remise_pct, cout_unitaire
  from public.devis_lignes where devis_id = d.id;

  if d.statut in ('envoye', 'expire', 'refuse') then
    perform set_config('atlas.finance_systeme', 'on', true);
    update public.devis set statut = 'remplace' where id = d.id;
    perform set_config('atlas.finance_systeme', 'off', true);
  end if;
  update public.liens_signature set revoque_le = now()
   where objet_type = 'devis' and objet_id = d.id and utilise_le is null and revoque_le is null;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refuser_devis(p_devis uuid, p_motif text)
 RETURNS devis
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.devis;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.dossier_perm(d.dossier_id, 'devis.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if d.statut <> 'envoye' then
    raise exception 'Seul un devis envoyé peut être refusé' using errcode = 'check_violation';
  end if;
  if nullif(trim(p_motif), '') is null then
    raise exception 'Motif obligatoire' using errcode = 'check_violation';
  end if;
  perform set_config('atlas.finance_systeme', 'on', true);
  update public.devis set statut = 'refuse', refuse_le = clock_timestamp(), motif_refus = trim(p_motif)
   where id = d.id returning * into d;
  perform set_config('atlas.finance_systeme', 'off', true);
  update public.liens_signature set revoque_le = now()
   where objet_type = 'devis' and objet_id = d.id and utilise_le is null and revoque_le is null;
  return d;
end;
$function$;

CREATE OR REPLACE FUNCTION public.signer_pv(p_pv uuid, p_partie text, p_nom text, p_image text)
 RETURNS pv_lancement
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.pv_lancement;
  v_sig uuid;
begin
  select * into p from public.pv_lancement where id = p_pv for update;
  if not found or not public.dossier_perm(p.dossier_id, 'devis.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if p_partie not in ('atlas', 'client') then
    raise exception 'Partie invalide' using errcode = 'check_violation';
  end if;
  if not public.pv_points_confirmes(p) then
    raise exception 'Tous les points du PV doivent être confirmés avant signature' using errcode = 'check_violation';
  end if;
  if (p_partie = 'atlas' and p.signature_atlas_id is not null)
     or (p_partie = 'client' and p.signature_client_id is not null) then
    raise exception 'Déjà signé par cette partie' using errcode = 'check_violation';
  end if;

  insert into public.signatures (organization_id, dossier_id, objet_type, objet_id, partie,
                                 nom_signataire, image_png, user_id)
  values (p.organization_id, p.dossier_id, 'pv_lancement', p.id, p_partie, trim(p_nom), p_image, auth.uid())
  returning id into v_sig;

  perform set_config('atlas.finance_systeme', 'on', true);
  if p_partie = 'atlas' then
    update public.pv_lancement set signature_atlas_id = v_sig,
           signe_le = case when signature_client_id is not null then clock_timestamp() end
     where id = p.id returning * into p;
  else
    update public.pv_lancement set signature_client_id = v_sig,
           signe_le = case when signature_atlas_id is not null then clock_timestamp() end
     where id = p.id returning * into p;
    update public.liens_signature set revoque_le = now()
     where objet_type = 'pv_lancement' and objet_id = p.id and utilise_le is null and revoque_le is null;
  end if;
  perform set_config('atlas.finance_systeme', 'off', true);
  return p;
end;
$function$;

CREATE OR REPLACE FUNCTION public.creer_lien_pv(p_pv uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.pv_lancement;
begin
  select * into p from public.pv_lancement where id = p_pv;
  if not found or not public.dossier_perm(p.dossier_id, 'devis.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if not public.pv_points_confirmes(p) then
    raise exception 'Tous les points du PV doivent être confirmés' using errcode = 'check_violation';
  end if;
  if p.signature_client_id is not null then
    raise exception 'PV déjà signé par le client' using errcode = 'check_violation';
  end if;
  return public.creer_lien_signature('pv_lancement', p.id, p.dossier_id, p.organization_id, now() + interval '15 days');
end;
$function$;

CREATE OR REPLACE FUNCTION public.creer_facture_depuis_devis(p_devis uuid, p_type facture_type)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.devis;
  v_id uuid;
  f record;
  v_ordre integer := 1;
begin
  select * into d from public.devis where id = p_devis;
  if not found or not (public.is_finance(d.organization_id) and public.can_see_dossier(d.dossier_id)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if d.statut <> 'signe' then
    raise exception 'La facturation exige un devis signé' using errcode = 'check_violation';
  end if;
  if p_type = 'mensuelle' then
    raise exception 'Les factures mensuelles se créent manuellement' using errcode = 'check_violation';
  end if;
  if p_type = 'acompte' and coalesce(d.acompte_pct, 0) <= 0 then
    raise exception 'Aucun acompte prévu au devis' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.factures where devis_id = d.id and type = p_type and statut <> 'annulee') then
    raise exception 'Une facture % existe déjà pour ce devis', p_type using errcode = 'check_violation';
  end if;

  insert into public.factures (organization_id, dossier_id, devis_id, type, objet, devise, taux_cdf, taxes)
  values (d.organization_id, d.dossier_id, d.id, p_type,
          case p_type when 'acompte' then 'Acompte — ' else 'Solde — ' end || coalesce(d.objet, d.numero),
          d.devise, d.taux_cdf, d.taxes)
  returning id into v_id;

  if p_type = 'acompte' then
    insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
    values (d.organization_id, v_id, 1,
            'Acompte de ' || trim(to_char(d.acompte_pct, 'FM990.##')) || ' % sur devis ' || d.numero || ' v' || d.version,
            1, round(d.total_ht * d.acompte_pct / 100, 2));
  else
    insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
    values (d.organization_id, v_id, 1, 'Montant total du devis ' || d.numero || ' v' || d.version, 1, d.total_ht);
    for f in select numero, total_ht from public.factures
              where dossier_id = d.dossier_id and type = 'acompte' and statut not in ('brouillon', 'annulee')
              order by numero loop
      v_ordre := v_ordre + 1;
      insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
      values (d.organization_id, v_id, v_ordre, 'Déduction acompte facturé ' || f.numero, 1, -f.total_ht);
    end loop;
  end if;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.marquer_facture_remise(p_facture uuid)
 RETURNS factures
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  f public.factures;
begin
  select * into f from public.factures where id = p_facture for update;
  if not found or not (public.is_finance(f.organization_id) and public.can_see_dossier(f.dossier_id)) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if f.statut in ('brouillon', 'annulee') then
    raise exception 'Facture % : remise impossible', f.statut using errcode = 'check_violation';
  end if;
  if f.remise_client_le is not null then
    raise exception 'Facture déjà remise au client' using errcode = 'check_violation';
  end if;
  if f.type = 'solde' and f.normalisee_le is null then
    raise exception 'Facture de solde : normalisation e-DEF requise avant la remise au client'
      using errcode = 'check_violation';
  end if;
  perform set_config('atlas.finance_systeme', 'on', true);
  update public.factures set remise_client_le = clock_timestamp(), remise_client_par = auth.uid()
   where id = f.id returning * into f;
  perform set_config('atlas.finance_systeme', 'off', true);
  return f;
end;
$function$;

CREATE OR REPLACE FUNCTION public.normaliser_facture(p_facture uuid, p_numero_normalise text, p_code_def text, p_qr_code text DEFAULT NULL::text)
 RETURNS factures
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  f public.factures;
begin
  select * into f from public.factures where id = p_facture for update;
  if not found or not public.has_permission(f.organization_id, 'normalisation.write') then
    raise exception 'Normalisation réservée au DAF, au gérant ou à l''administrateur'
      using errcode = 'insufficient_privilege';
  end if;
  if f.statut = 'brouillon' then
    raise exception 'Émettez la facture avant de la normaliser' using errcode = 'check_violation';
  end if;
  if f.normalisee_le is not null then
    raise exception 'Facture déjà normalisée' using errcode = 'check_violation';
  end if;
  if nullif(trim(p_numero_normalise), '') is null or nullif(trim(p_code_def), '') is null then
    raise exception 'Numéro de facture normalisée et code DEF obligatoires' using errcode = 'check_violation';
  end if;

  perform set_config('atlas.finance_systeme', 'on', true);
  update public.factures
     set numero_facture_normalisee = trim(p_numero_normalise),
         code_authentification_def = trim(p_code_def),
         qr_code = nullif(trim(p_qr_code), ''),
         normalisee_le = clock_timestamp(),
         normalisee_par = auth.uid()
   where id = f.id;
  perform set_config('atlas.finance_systeme', 'off', true);

  insert into public.def_transmissions (organization_id, facture_id, mode, statut, reponse)
  values (f.organization_id, f.id, 'manuel', 'acceptee',
          jsonb_build_object('numero', trim(p_numero_normalise), 'code_def', trim(p_code_def)));
  f := public.facture_recalculer(f.id);
  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (f.organization_id, 'factures', f.id, 'VALIDATION',
          jsonb_build_object('normalisation', f.numero_facture_normalisee), auth.uid());
  return f;
end;
$function$;

