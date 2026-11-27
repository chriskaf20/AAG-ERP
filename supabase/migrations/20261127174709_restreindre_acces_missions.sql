-- Phase 3 — La lecture est limitée à l'équipe, au responsable du dossier et
-- aux deux rôles de pilotage de l'organisation propriétaire.
create or replace function public.mission_visible(p_mission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.missions m
    join public.dossiers d on d.id = m.dossier_id and d.organization_id = m.organization_id
    where m.id = p_mission
      and (
        public.mission_membre(m.id)
        or (d.responsable_id = auth.uid() and public.is_internal(m.organization_id))
        or public.has_role(m.organization_id, array['gerant', 'directeur_operations']::public.app_role[])
      )
  );
$$;

-- Les politiques des rapports et des photos ainsi que la reprise d'un rapport
-- utilisent la même règle de rédaction.
create or replace function public.mission_redaction(p_mission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.missions m
    where m.id = p_mission
      and public.mission_membre(m.id)
      and public.has_permission(m.organization_id, 'missions.report')
  );
$$;

-- La signature client conserve le circuit de validation des pilotes habilités
-- à consulter la mission. La validation interne reste réservée au responsable désigné.
create function public.mission_signature_autorisee(p_mission uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.mission_redaction(p_mission)
      or (public.mission_visible(p_mission) and public.mission_gestion(p_mission));
$$;
revoke execute on function public.mission_signature_autorisee(uuid) from public, anon, authenticated, service_role;


create or replace function public.signer_rapport(p_rapport uuid, p_nom text, p_image text)
returns public.rapports_intervention
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rapports_intervention;
  m public.missions;
  v_sig uuid;
begin
  select * into r from public.rapports_intervention where id = p_rapport for update;
  if not found or not public.mission_signature_autorisee(r.mission_id) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  select * into m from public.missions where id = r.mission_id for update;
  if m.type <> 'terrain' then
    raise exception 'Mission interne : le rapport se valide, il ne se signe pas' using errcode = 'check_violation';
  end if;
  if m.statut = 'annulee' or not exists (
    select 1 from public.mission_agents a
    join public.user_roles ur on ur.user_id = a.user_id and ur.organization_id = m.organization_id
    where a.mission_id = m.id and ur.role = 'agent_terrain'
  ) then
    raise exception 'Signature impossible : mission annulée ou aucun agent de terrain affecté' using errcode = 'check_violation';
  end if;
  if r.signe_le is not null then
    raise exception 'Rapport déjà signé' using errcode = 'check_violation';
  end if;

  insert into public.signatures (organization_id, dossier_id, objet_type, objet_id, partie,
                                 nom_signataire, image_png, user_id)
  values (r.organization_id, r.dossier_id, 'rapport_intervention', r.id, 'client', trim(p_nom), p_image, auth.uid())
  returning id into v_sig;

  perform set_config('atlas.execution_systeme', 'on', true);
  update public.rapports_intervention
     set signature_client_id = v_sig, signe_le = clock_timestamp()
   where id = r.id returning * into r;
  update public.missions set statut = 'terminee' where id = m.id;
  perform set_config('atlas.execution_systeme', 'off', true);

  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (r.organization_id, 'rapports_intervention', r.id, 'VALIDATION',
          jsonb_build_object('signature_client', v_sig, 'nom', trim(p_nom), 'mission', m.id), auth.uid());
  return r;
end;
$$;

create or replace function public.mission_detail(p_mission uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'mission', to_jsonb(m),
    'dossier', jsonb_build_object('id', d.id, 'numero', d.numero, 'statut', d.statut, 'service', d.service,
                                  'voir', public.dossier_perm(d.id)),
    'client', jsonb_build_object('raison_sociale', c.raison_sociale, 'adresse', c.adresse,
                                 'ville', c.ville, 'telephone', c.telephone),
    'agents', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'nom', p.nom_complet) order by p.nom_complet)
      from public.mission_agents a join public.profiles p on p.id = a.user_id
      where a.mission_id = m.id), '[]'::jsonb),
    'rapports', coalesce((
      select jsonb_agg(to_jsonb(r) || jsonb_build_object(
        'redacteur', (select nom_complet from public.profiles where id = r.redige_par),
        'valideur', (select nom_complet from public.profiles where id = r.valide_par),
        'signature', (select jsonb_build_object('nom', s.nom_signataire, 'image', s.image_png, 'signe_le', s.signe_le)
                        from public.signatures s where s.id = r.signature_client_id),
        'photos', coalesce((
          select jsonb_agg(jsonb_build_object('id', ph.id, 'chemin', ph.chemin, 'legende', ph.legende,
                                              'largeur', ph.largeur, 'hauteur', ph.hauteur) order by ph.created_at, ph.id)
          from public.rapport_photos ph where ph.rapport_id = r.id), '[]'::jsonb)) order by r.version desc)
      from public.rapports_intervention r where r.mission_id = m.id), '[]'::jsonb),
    'peut_rediger', public.mission_redaction(m.id),
    'peut_signer', public.mission_signature_autorisee(m.id),
    'peut_gerer', public.mission_gestion(m.id),
    'peut_valider', coalesce(d.responsable_id = auth.uid() and public.has_permission(d.organization_id, 'missions.report'), false)
  )
  from public.missions m
  join public.dossiers d on d.id = m.dossier_id
  left join public.clients c on c.id = d.client_id
  where m.id = p_mission and public.mission_visible(m.id);
$$;

-- Les signatures d'intervention suivent le rapport, y compris en lecture directe.
alter policy signatures_select on public.signatures
  using (
    case when objet_type = 'rapport_intervention' then public.rapport_visible(objet_id)
         else public.dossier_perm(dossier_id, 'devis.read')
              or (objet_type = 'pv_reception' and public.dossier_visible_interne(dossier_id))
    end
  );

-- Les entrées techniques peuvent contenir le texte du rapport et les chemins de photos.
-- Les pilotes de l'organisation conservent l'historique des missions supprimées.
alter policy audit_log_select on public.audit_log
  using (
    public.has_permission(organization_id, 'audit.read')
    and (
      public.has_role(organization_id, array['gerant', 'directeur_operations']::public.app_role[])
      or case
        when table_name = 'missions' then public.mission_visible(record_id)
        when table_name in ('mission_agents', 'rapports_intervention') then
          public.mission_visible(coalesce(new_data ->> 'mission_id', old_data ->> 'mission_id', new_data ->> 'mission')::uuid)
        when table_name = 'rapport_photos' then
          public.rapport_visible(coalesce(new_data ->> 'rapport_id', old_data ->> 'rapport_id')::uuid)
        else true
      end
    )
  );
