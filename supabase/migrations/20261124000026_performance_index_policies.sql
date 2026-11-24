-- Performance : index des clés étrangères (advisor unindexed_foreign_keys)
-- et suppression des politiques permissives multiples (advisor multiple_permissive_policies).

create index if not exists audit_log_created_by_fk_idx on public.audit_log (created_by);
create index if not exists avenants_created_by_fk_idx on public.avenants (created_by);
create index if not exists avenants_document_id_fk_idx on public.avenants (document_id);
create index if not exists avenants_organization_id_fk_idx on public.avenants (organization_id);
create index if not exists avoirs_created_by_fk_idx on public.avoirs (created_by);
create index if not exists avoirs_dossier_id_fk_idx on public.avoirs (dossier_id);
create index if not exists clients_created_by_fk_idx on public.clients (created_by);
create index if not exists compteurs_created_by_fk_idx on public.compteurs (created_by);
create index if not exists contacts_created_by_fk_idx on public.contacts (created_by);
create index if not exists contacts_organization_id_fk_idx on public.contacts (organization_id);
create index if not exists contrats_created_by_fk_idx on public.contrats (created_by);
create index if not exists contrats_devis_id_fk_idx on public.contrats (devis_id);
create index if not exists contrats_document_id_fk_idx on public.contrats (document_id);
create index if not exists def_transmissions_avoir_id_fk_idx on public.def_transmissions (avoir_id);
create index if not exists def_transmissions_created_by_fk_idx on public.def_transmissions (created_by);
create index if not exists def_transmissions_facture_id_fk_idx on public.def_transmissions (facture_id);
create index if not exists def_transmissions_organization_id_fk_idx on public.def_transmissions (organization_id);
create index if not exists departments_created_by_fk_idx on public.departments (created_by);
create index if not exists devis_created_by_fk_idx on public.devis (created_by);
create index if not exists devis_envoye_par_fk_idx on public.devis (envoye_par);
create index if not exists devis_signature_id_fk_idx on public.devis (signature_id);
create index if not exists devis_valide_par_fk_idx on public.devis (valide_par);
create index if not exists devis_version_precedente_id_fk_idx on public.devis (version_precedente_id);
create index if not exists devis_lignes_created_by_fk_idx on public.devis_lignes (created_by);
create index if not exists devis_lignes_organization_id_fk_idx on public.devis_lignes (organization_id);
create index if not exists devis_lignes_service_id_fk_idx on public.devis_lignes (service_id);
create index if not exists documents_created_by_fk_idx on public.documents (created_by);
create index if not exists documents_organization_id_fk_idx on public.documents (organization_id);
create index if not exists documents_signe_par_fk_idx on public.documents (signe_par);
create index if not exists documents_version_precedente_id_fk_idx on public.documents (version_precedente_id);
create index if not exists dossier_affectations_created_by_fk_idx on public.dossier_affectations (created_by);
create index if not exists dossier_affectations_organization_id_fk_idx on public.dossier_affectations (organization_id);
create index if not exists dossier_counters_created_by_fk_idx on public.dossier_counters (created_by);
create index if not exists dossier_status_history_created_by_fk_idx on public.dossier_status_history (created_by);
create index if not exists dossier_status_history_organization_id_fk_idx on public.dossier_status_history (organization_id);
create index if not exists dossiers_contact_id_fk_idx on public.dossiers (contact_id);
create index if not exists dossiers_created_by_fk_idx on public.dossiers (created_by);
create index if not exists facture_lignes_created_by_fk_idx on public.facture_lignes (created_by);
create index if not exists facture_lignes_organization_id_fk_idx on public.facture_lignes (organization_id);
create index if not exists facture_lignes_service_id_fk_idx on public.facture_lignes (service_id);
create index if not exists factures_created_by_fk_idx on public.factures (created_by);
create index if not exists factures_devis_id_fk_idx on public.factures (devis_id);
create index if not exists factures_emise_par_fk_idx on public.factures (emise_par);
create index if not exists factures_normalisee_par_fk_idx on public.factures (normalisee_par);
create index if not exists factures_remise_client_par_fk_idx on public.factures (remise_client_par);
create index if not exists liens_signature_created_by_fk_idx on public.liens_signature (created_by);
create index if not exists liens_signature_dossier_id_fk_idx on public.liens_signature (dossier_id);
create index if not exists liens_signature_organization_id_fk_idx on public.liens_signature (organization_id);
create index if not exists organizations_created_by_fk_idx on public.organizations (created_by);
create index if not exists paiements_created_by_fk_idx on public.paiements (created_by);
create index if not exists paiements_dossier_id_fk_idx on public.paiements (dossier_id);
create index if not exists profiles_created_by_fk_idx on public.profiles (created_by);
create index if not exists profiles_organization_id_fk_idx on public.profiles (organization_id);
create index if not exists pv_lancement_created_by_fk_idx on public.pv_lancement (created_by);
create index if not exists pv_lancement_devis_id_fk_idx on public.pv_lancement (devis_id);
create index if not exists pv_lancement_organization_id_fk_idx on public.pv_lancement (organization_id);
create index if not exists pv_lancement_signature_atlas_id_fk_idx on public.pv_lancement (signature_atlas_id);
create index if not exists pv_lancement_signature_client_id_fk_idx on public.pv_lancement (signature_client_id);
create index if not exists relances_created_by_fk_idx on public.relances (created_by);
create index if not exists relances_organization_id_fk_idx on public.relances (organization_id);
create index if not exists services_created_by_fk_idx on public.services (created_by);
create index if not exists services_department_id_fk_idx on public.services (department_id);
create index if not exists signatures_created_by_fk_idx on public.signatures (created_by);
create index if not exists signatures_dossier_id_fk_idx on public.signatures (dossier_id);
create index if not exists signatures_organization_id_fk_idx on public.signatures (organization_id);
create index if not exists signatures_user_id_fk_idx on public.signatures (user_id);
create index if not exists user_roles_created_by_fk_idx on public.user_roles (created_by);
create index if not exists user_roles_department_id_fk_idx on public.user_roles (department_id);
create index if not exists verifications_created_by_fk_idx on public.verifications (created_by);
create index if not exists verifications_organization_id_fk_idx on public.verifications (organization_id);
create index if not exists verifications_valide_par_fk_idx on public.verifications (valide_par);
create index if not exists verifications_verifie_par_fk_idx on public.verifications (verifie_par);

-- Les politiques « for all » doublaient la politique de lecture : écriture séparée par commande
do $$
declare
  t record;
begin
  for t in select * from (values
    ('avenants', 'avenants_write'), ('contrats', 'contrats_write'), ('departments', 'departments_write'),
    ('devis_lignes', 'devis_lignes_write'), ('facture_lignes', 'facture_lignes_write'),
    ('pv_lancement', 'pv_lancement_write'), ('services', 'services_write')
  ) as x(tbl, pol)
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s)',
      t.tbl || '_insert', t.tbl,
      (select pg_get_expr(polwithcheck, polrelid) from pg_policy where polname = t.pol and polrelid = ('public.' || t.tbl)::regclass));
    execute format(
      'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      t.tbl || '_update', t.tbl,
      (select pg_get_expr(polqual, polrelid) from pg_policy where polname = t.pol and polrelid = ('public.' || t.tbl)::regclass),
      (select pg_get_expr(polwithcheck, polrelid) from pg_policy where polname = t.pol and polrelid = ('public.' || t.tbl)::regclass));
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      t.tbl || '_delete', t.tbl,
      (select pg_get_expr(polqual, polrelid) from pg_policy where polname = t.pol and polrelid = ('public.' || t.tbl)::regclass));
    execute format('drop policy %I on public.%I', t.pol, t.tbl);
  end loop;
end $$;

-- profiles : une seule politique de mise à jour (soi-même ou admin / gérant)
drop policy profiles_update_self on public.profiles;
drop policy profiles_update_admin on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = profiles.id
        and public.has_role(ur.organization_id, array['admin_systeme', 'gerant']::public.app_role[])
    )
  )
  with check (organization_id is null or organization_id in (select public.user_org_ids()));
