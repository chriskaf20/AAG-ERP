-- Phase 2 — RLS, audit et droits sur les tables commerciales et financières

alter table public.services enable row level security;
alter table public.compteurs enable row level security;
alter table public.devis enable row level security;
alter table public.devis_lignes enable row level security;
alter table public.signatures enable row level security;
alter table public.liens_signature enable row level security;
alter table public.contrats enable row level security;
alter table public.avenants enable row level security;
alter table public.factures enable row level security;
alter table public.facture_lignes enable row level security;
alter table public.avoirs enable row level security;
alter table public.def_transmissions enable row level security;
alter table public.paiements enable row level security;
alter table public.pv_lancement enable row level security;
alter table public.relances enable row level security;

-- compteurs : aucune politique (accès via prochain_numero uniquement)

-- services
create policy services_select on public.services
  for select to authenticated using (public.is_internal(organization_id));
create policy services_write on public.services
  for all to authenticated
  using (public.has_role(organization_id, array['admin_systeme', 'gerant', 'directeur_commercial']::public.app_role[]))
  with check (public.has_role(organization_id, array['admin_systeme', 'gerant', 'directeur_commercial']::public.app_role[]));

-- devis
create policy devis_select on public.devis
  for select to authenticated using (public.can_see_finance(dossier_id));
create policy devis_insert on public.devis
  for insert to authenticated with check (public.can_edit_dossier(dossier_id));
create policy devis_update on public.devis
  for update to authenticated
  using (public.can_edit_dossier(dossier_id)) with check (public.can_edit_dossier(dossier_id));
create policy devis_delete on public.devis
  for delete to authenticated using (public.can_edit_dossier(dossier_id));

create function public.devis_dossier(p_devis uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select dossier_id from public.devis where id = p_devis;
$$;
create function public.facture_dossier(p_facture uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select dossier_id from public.factures where id = p_facture;
$$;
create function public.contrat_dossier(p_contrat uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select dossier_id from public.contrats where id = p_contrat;
$$;
revoke execute on function public.devis_dossier(uuid) from public, anon;
revoke execute on function public.facture_dossier(uuid) from public, anon;
revoke execute on function public.contrat_dossier(uuid) from public, anon;
grant execute on function public.devis_dossier(uuid) to authenticated;
grant execute on function public.facture_dossier(uuid) to authenticated;
grant execute on function public.contrat_dossier(uuid) to authenticated;

create policy devis_lignes_select on public.devis_lignes
  for select to authenticated using (public.can_see_finance(public.devis_dossier(devis_id)));
create policy devis_lignes_write on public.devis_lignes
  for all to authenticated
  using (public.can_edit_dossier(public.devis_dossier(devis_id)))
  with check (public.can_edit_dossier(public.devis_dossier(devis_id)));

-- signatures et liens : lecture seule (écriture par les fonctions)
create policy signatures_select on public.signatures
  for select to authenticated using (public.can_see_finance(dossier_id));
create policy liens_signature_select on public.liens_signature
  for select to authenticated using (public.can_edit_dossier(dossier_id));

-- contrats / avenants
create policy contrats_select on public.contrats
  for select to authenticated using (public.can_see_finance(dossier_id));
create policy contrats_write on public.contrats
  for all to authenticated
  using (public.can_edit_dossier(dossier_id)) with check (public.can_edit_dossier(dossier_id));
create policy avenants_select on public.avenants
  for select to authenticated using (public.can_see_finance(public.contrat_dossier(contrat_id)));
create policy avenants_write on public.avenants
  for all to authenticated
  using (public.can_edit_dossier(public.contrat_dossier(contrat_id)))
  with check (public.can_edit_dossier(public.contrat_dossier(contrat_id)));

-- factures (brouillons : pilote ou finance ; émission et suite : fonctions)
create policy factures_select on public.factures
  for select to authenticated using (public.can_see_finance(dossier_id));
create policy factures_insert on public.factures
  for insert to authenticated
  with check (public.can_edit_dossier(dossier_id) or public.is_finance(organization_id));
create policy factures_update on public.factures
  for update to authenticated
  using (public.can_edit_dossier(dossier_id) or public.is_finance(organization_id))
  with check (public.can_edit_dossier(dossier_id) or public.is_finance(organization_id));
create policy factures_delete on public.factures
  for delete to authenticated
  using (public.can_edit_dossier(dossier_id) or public.is_finance(organization_id));

create policy facture_lignes_select on public.facture_lignes
  for select to authenticated using (public.can_see_finance(public.facture_dossier(facture_id)));
create policy facture_lignes_write on public.facture_lignes
  for all to authenticated
  using (public.can_edit_dossier(public.facture_dossier(facture_id)) or public.is_finance(organization_id))
  with check (public.can_edit_dossier(public.facture_dossier(facture_id)) or public.is_finance(organization_id));

-- avoirs : lecture ; création par emettre_avoir()
create policy avoirs_select on public.avoirs
  for select to authenticated using (public.can_see_finance(dossier_id));

-- transmissions DEF : finance uniquement
create policy def_transmissions_select on public.def_transmissions
  for select to authenticated using (public.is_finance(organization_id));

-- paiements : saisie par la finance (contrôles dans le trigger)
create policy paiements_select on public.paiements
  for select to authenticated using (public.can_see_finance(dossier_id));
create policy paiements_insert on public.paiements
  for insert to authenticated with check (public.is_finance(organization_id));

-- PV de lancement : document opérationnel du dossier
create policy pv_lancement_select on public.pv_lancement
  for select to authenticated using (public.can_see_finance(dossier_id));
create policy pv_lancement_write on public.pv_lancement
  for all to authenticated
  using (public.can_edit_dossier(dossier_id)) with check (public.can_edit_dossier(dossier_id));

-- relances
create policy relances_select on public.relances
  for select to authenticated using (public.can_see_finance(dossier_id));

-- Audit
create trigger audit after insert or update or delete on public.services
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.devis
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.devis_lignes
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.contrats
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.avenants
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.factures
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.facture_lignes
  for each row execute function public.tg_audit();
create trigger audit after insert or update on public.avoirs
  for each row execute function public.tg_audit();
create trigger audit after insert on public.paiements
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.pv_lancement
  for each row execute function public.tg_audit();

revoke all on all tables in schema public from anon;
