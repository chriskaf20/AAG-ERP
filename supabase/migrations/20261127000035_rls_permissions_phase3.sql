-- Phase 3 — Permissions, RLS, audit, stockage des photos de terrain, accueil, tâche quotidienne.

-- ---------------------------------------------------------------------------
-- Matrice : 4 nouvelles permissions
-- ---------------------------------------------------------------------------
create function public.initialiser_permissions_phase3(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.role_permissions (organization_id, role, permission)
  select p_org, r.role::public.app_role, p.perm::public.app_permission
  from (values
    ('admin_systeme'), ('associe'), ('gerant'), ('directeur_commercial'), ('directeur_operations'), ('daf'),
    ('responsable_departement'), ('responsable_dossier'), ('acheteur'), ('responsable_rh'), ('agent_terrain')
  ) as r(role)
  cross join (values ('missions.read_assigned'), ('missions.report')) as p(perm)
  union all
  select p_org, r.role::public.app_role, p.perm::public.app_permission
  from (values ('gerant'), ('directeur_operations'), ('responsable_departement'), ('responsable_dossier')) as r(role)
  cross join (values ('execution.write'), ('reception.write')) as p(perm)
  on conflict (organization_id, role, permission) do nothing;
$$;
revoke execute on function public.initialiser_permissions_phase3(uuid) from public, anon, authenticated;

select public.initialiser_permissions_phase3(id) from public.organizations;

create or replace function public.tg_organizations_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.initialiser_permissions(new.id);
  perform public.initialiser_permissions_phase3(new.id);
  return null;
end; $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.missions enable row level security;
alter table public.mission_agents enable row level security;
alter table public.rapports_intervention enable row level security;
alter table public.rapport_photos enable row level security;
alter table public.livrables enable row level security;
alter table public.points_avancement enable row level security;
alter table public.incidents enable row level security;
alter table public.pv_reception enable row level security;
alter table public.pv_reception_lignes enable row level security;
alter table public.reserves enable row level security;
alter table public.avis_clients enable row level security;

grant select, insert, update, delete on public.missions, public.rapports_intervention, public.rapport_photos,
  public.livrables, public.pv_reception, public.pv_reception_lignes, public.reserves to authenticated;
grant select, insert, delete on public.mission_agents to authenticated;
grant select, insert, update on public.incidents, public.avis_clients to authenticated;
grant select on public.points_avancement to authenticated;
grant select on public.pv_reception, public.pv_reception_lignes, public.reserves to service_role;

-- missions
create policy missions_select on public.missions for select to authenticated
  using (public.mission_visible(id));
create policy missions_insert on public.missions for insert to authenticated
  with check (public.dossier_perm(dossier_id, 'execution.write'));
create policy missions_update on public.missions for update to authenticated
  using (public.dossier_perm(dossier_id, 'execution.write'))
  with check (public.dossier_perm(dossier_id, 'execution.write'));
create policy missions_delete on public.missions for delete to authenticated
  using (public.dossier_perm(dossier_id, 'execution.write'));

-- mission_agents
create policy mission_agents_select on public.mission_agents for select to authenticated
  using (public.mission_visible(mission_id));
create policy mission_agents_insert on public.mission_agents for insert to authenticated
  with check (public.mission_gestion(mission_id));
create policy mission_agents_delete on public.mission_agents for delete to authenticated
  using (public.mission_gestion(mission_id));

-- rapports d'intervention et photos
create policy rapports_intervention_select on public.rapports_intervention for select to authenticated
  using (public.mission_visible(mission_id));
create policy rapports_intervention_insert on public.rapports_intervention for insert to authenticated
  with check (public.mission_redaction(mission_id));
create policy rapports_intervention_update on public.rapports_intervention for update to authenticated
  using (public.mission_redaction(mission_id)) with check (public.mission_redaction(mission_id));
create policy rapports_intervention_delete on public.rapports_intervention for delete to authenticated
  using (public.mission_redaction(mission_id));

create policy rapport_photos_select on public.rapport_photos for select to authenticated
  using (public.rapport_visible(rapport_id));
create policy rapport_photos_insert on public.rapport_photos for insert to authenticated
  with check (public.rapport_redaction(rapport_id));
create policy rapport_photos_update on public.rapport_photos for update to authenticated
  using (public.rapport_redaction(rapport_id)) with check (public.rapport_redaction(rapport_id));
create policy rapport_photos_delete on public.rapport_photos for delete to authenticated
  using (public.rapport_redaction(rapport_id));

-- livrables
create policy livrables_select on public.livrables for select to authenticated
  using (public.dossier_perm(dossier_id));
create policy livrables_insert on public.livrables for insert to authenticated
  with check (public.dossier_perm(dossier_id, 'execution.write'));
create policy livrables_update on public.livrables for update to authenticated
  using (public.dossier_perm(dossier_id, 'execution.write'))
  with check (public.dossier_perm(dossier_id, 'execution.write'));
create policy livrables_delete on public.livrables for delete to authenticated
  using (public.dossier_perm(dossier_id, 'execution.write'));

-- points d'avancement : lecture seule (écriture par enregistrer_point_avancement)
create policy points_avancement_select on public.points_avancement for select to authenticated
  using (public.dossier_visible_interne(dossier_id));

-- incidents : signalés par le pilote ou par une personne affectée à une mission du dossier
create policy incidents_select on public.incidents for select to authenticated
  using (public.dossier_visible_interne(dossier_id) or public.mission_membre(mission_id));
create policy incidents_insert on public.incidents for insert to authenticated
  with check (public.dossier_perm(dossier_id, 'execution.write')
    or (public.mission_membre(mission_id) and public.dossier_mission_membre(dossier_id)));
create policy incidents_update on public.incidents for update to authenticated
  using (public.dossier_perm(dossier_id, 'execution.write'))
  with check (public.dossier_perm(dossier_id, 'execution.write'));

-- PV de réception, lignes, réserves
create policy pv_reception_select on public.pv_reception for select to authenticated
  using (public.dossier_visible_interne(dossier_id));
create policy pv_reception_insert on public.pv_reception for insert to authenticated
  with check (public.dossier_perm(dossier_id, 'reception.write'));
create policy pv_reception_update on public.pv_reception for update to authenticated
  using (public.dossier_perm(dossier_id, 'reception.write'))
  with check (public.dossier_perm(dossier_id, 'reception.write'));
create policy pv_reception_delete on public.pv_reception for delete to authenticated
  using (public.dossier_perm(dossier_id, 'reception.write'));

create policy pv_reception_lignes_select on public.pv_reception_lignes for select to authenticated
  using (public.dossier_visible_interne(public.pv_reception_dossier(pv_id)));
create policy pv_reception_lignes_insert on public.pv_reception_lignes for insert to authenticated
  with check (public.dossier_perm(public.pv_reception_dossier(pv_id), 'reception.write'));
create policy pv_reception_lignes_update on public.pv_reception_lignes for update to authenticated
  using (public.dossier_perm(public.pv_reception_dossier(pv_id), 'reception.write'))
  with check (public.dossier_perm(public.pv_reception_dossier(pv_id), 'reception.write'));
create policy pv_reception_lignes_delete on public.pv_reception_lignes for delete to authenticated
  using (public.dossier_perm(public.pv_reception_dossier(pv_id), 'reception.write'));

create policy reserves_select on public.reserves for select to authenticated
  using (public.dossier_visible_interne(dossier_id));
create policy reserves_insert on public.reserves for insert to authenticated
  with check (public.dossier_perm(public.pv_reception_dossier(pv_id), 'reception.write'));
create policy reserves_update on public.reserves for update to authenticated
  using (public.dossier_perm(dossier_id, 'reception.write'))
  with check (public.dossier_perm(dossier_id, 'reception.write'));
create policy reserves_delete on public.reserves for delete to authenticated
  using (public.dossier_perm(dossier_id, 'reception.write'));

-- avis client
create policy avis_clients_select on public.avis_clients for select to authenticated
  using (public.dossier_visible_interne(dossier_id));
create policy avis_clients_insert on public.avis_clients for insert to authenticated
  with check (public.dossier_perm(dossier_id, 'reception.write'));
create policy avis_clients_update on public.avis_clients for update to authenticated
  using (public.dossier_perm(dossier_id, 'reception.write'))
  with check (public.dossier_perm(dossier_id, 'reception.write'));

-- signatures : celles des PV de réception et des rapports suivent la visibilité du dossier
drop policy signatures_select on public.signatures;
create policy signatures_select on public.signatures for select to authenticated
  using (public.dossier_perm(dossier_id, 'devis.read')
      or (objet_type in ('pv_reception', 'rapport_intervention') and public.dossier_visible_interne(dossier_id)));

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create trigger audit after insert or update or delete on public.missions
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.mission_agents
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.rapports_intervention
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.rapport_photos
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.livrables
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.points_avancement
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.incidents
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.pv_reception
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.pv_reception_lignes
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.reserves
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.avis_clients
  for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------------
-- Stockage : photos de terrain (JPEG compressés sur le téléphone)
--   terrain : {organization_id}/{dossier_id}/{rapport_id}/{fichier}.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('terrain', 'terrain', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create function public.storage_terrain_acces(p_name text, p_ecriture boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rapports_intervention r
    where r.organization_id::text = (storage.foldername(p_name))[1]
      and r.dossier_id::text = (storage.foldername(p_name))[2]
      and r.id::text = (storage.foldername(p_name))[3]
      and case when p_ecriture
               then r.signe_le is null and r.valide_le is null and public.mission_redaction(r.mission_id)
               else public.mission_visible(r.mission_id) end
  );
$$;
revoke execute on function public.storage_terrain_acces(text, boolean) from public, anon;
grant execute on function public.storage_terrain_acces(text, boolean) to authenticated;

create policy "terrain_lecture" on storage.objects
  for select to authenticated
  using (bucket_id = 'terrain' and public.storage_terrain_acces(name, false));
create policy "terrain_depot" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'terrain' and public.storage_terrain_acces(name, true));

-- Nettoyage d'un dépôt dont l'enregistrement des métadonnées a échoué.
create policy terrain_nettoyage on storage.objects for delete to authenticated
  using (bucket_id = 'terrain' and public.storage_terrain_acces(name, true)
    and not exists (select 1 from public.rapport_photos p where p.chemin = name));

-- ---------------------------------------------------------------------------
-- Accueil : missions du jour, réserves à échéance, points d'avancement en retard
-- ---------------------------------------------------------------------------
create or replace function public.donnees_accueil(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'dossiers', case when public.has_permission(p_org, 'dossiers.read_all')
                        or public.has_permission(p_org, 'dossiers.read_dept')
                        or public.has_permission(p_org, 'dossiers.read_own') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'numero', d.numero, 'statut', d.statut, 'service', d.service,
        'date_reception', d.date_reception, 'responsable_id', d.responsable_id,
        'clients', jsonb_build_object('raison_sociale', c.raison_sociale)) order by d.created_at desc)
      from public.dossiers d left join public.clients c on c.id = d.client_id
      where d.organization_id = p_org), '[]'::jsonb) end,
    'verifs', case when public.has_permission(p_org, 'dossiers.decide') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'decision', v.decision,
        'dossiers', jsonb_build_object('id', d.id, 'numero', d.numero, 'statut', d.statut,
                                       'clients', jsonb_build_object('raison_sociale', c.raison_sociale))))
      from public.verifications v
      join public.dossiers d on d.id = v.dossier_id
      left join public.clients c on c.id = d.client_id
      where v.organization_id = p_org and v.valide_le is null and v.decision is not null
        and d.statut = 'en_verification'), '[]'::jsonb) end,
    'devis_a_valider', case when public.has_permission(p_org, 'devis.validate') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'numero', v.numero, 'version', v.version, 'total_ttc_usd', v.total_ttc_usd,
        'dossier_id', v.dossier_id,
        'dossiers', jsonb_build_object('numero', d.numero, 'clients', jsonb_build_object('raison_sociale', c.raison_sociale))))
      from public.devis v
      join public.dossiers d on d.id = v.dossier_id
      left join public.clients c on c.id = d.client_id
      where v.organization_id = p_org and v.statut = 'brouillon' and v.depasse_seuil and v.soumis_le is not null), '[]'::jsonb) end,
    'devis_a_envoyer', case when public.has_permission(p_org, 'devis.send') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'numero', v.numero, 'version', v.version, 'statut', v.statut,
        'depasse_seuil', v.depasse_seuil, 'total_ttc', v.total_ttc, 'devise', v.devise, 'dossier_id', v.dossier_id,
        'dossiers', jsonb_build_object('numero', d.numero, 'clients', jsonb_build_object('raison_sociale', c.raison_sociale))))
      from public.devis v
      join public.dossiers d on d.id = v.dossier_id
      left join public.clients c on c.id = d.client_id
      where v.organization_id = p_org and v.statut in ('brouillon', 'valide') and v.soumis_le is not null
        and public.dossier_perm(v.dossier_id, 'devis.send')), '[]'::jsonb) end,
    'factures', case when public.has_permission(p_org, 'factures.write') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'type', f.type, 'statut', f.statut, 'solde_du', f.solde_du,
        'devise', f.devise, 'taux_cdf', f.taux_cdf, 'echeance', f.echeance))
      from public.factures f where f.organization_id = p_org), '[]'::jsonb) end,
    'notifications', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select n.id, n.titre, n.message, n.lien, n.created_at from public.notifications n
        where n.user_id = auth.uid() and n.organization_id = p_org and n.lu_le is null
        order by n.created_at desc limit 5) x), '[]'::jsonb),
    'indicateurs', case when public.has_permission(p_org, 'reports.read') then public.rapport_indicateurs(p_org) end,
    'missions_jour', case when public.has_permission(p_org, 'missions.read_assigned') then coalesce((
      select jsonb_agg(x order by x ->> 'debut')
      from jsonb_array_elements(public.mes_missions(p_org)) x
      where ((x ->> 'debut')::timestamptz at time zone 'Africa/Lubumbashi')::date
              <= (now() at time zone 'Africa/Lubumbashi')::date
        and (coalesce(x ->> 'fin', x ->> 'debut')::timestamptz at time zone 'Africa/Lubumbashi')::date
              >= (now() at time zone 'Africa/Lubumbashi')::date), '[]'::jsonb) end,
    'reserves_echeance', case when public.has_permission(p_org, 'reception.write') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'description', r.description, 'date_limite', r.date_limite,
        'dossier_id', d.id, 'numero', d.numero, 'client', c.raison_sociale) order by r.date_limite)
      from public.reserves r
      join public.pv_reception p on p.id = r.pv_id
      join public.dossiers d on d.id = r.dossier_id
      left join public.clients c on c.id = d.client_id
      where r.organization_id = p_org and r.statut = 'ouverte' and p.signe_le is not null
        and r.date_limite <= current_date + 7
        and public.dossier_perm(r.dossier_id, 'reception.write')), '[]'::jsonb) end,
    'points_retard', case when public.has_permission(p_org, 'execution.write') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'numero', d.numero, 'client', c.raison_sociale, 'dernier_point', x.dernier,
        'depuis', greatest(x.dernier, d.statut_change_le::date)) order by greatest(x.dernier, d.statut_change_le::date))
      from public.dossiers d
      left join public.clients c on c.id = d.client_id
      cross join lateral (select max(pa.date_point) as dernier
                            from public.points_avancement pa where pa.dossier_id = d.id) x
      where d.organization_id = p_org and d.statut = 'en_cours'
        and greatest(x.dernier, d.statut_change_le::date) <= current_date - 7
        and public.dossier_perm(d.id, 'execution.write')), '[]'::jsonb) end
  );
$$;

-- ---------------------------------------------------------------------------
-- Tâche quotidienne : réceptions tacites (07:10 Lubumbashi = 05:10 UTC)
-- ---------------------------------------------------------------------------
select cron.schedule('receptions-tacites', '10 5 * * *', $$select public.receptions_tacites();$$);
