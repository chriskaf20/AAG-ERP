-- Phase 3 — Fonctions métier : droits sur les missions, rapports, PV de réception, réserves,
-- points d'avancement, facture de solde automatique, réception tacite, statuts phase 3.

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
-- Visibilité d'un dossier par un rôle « de gestion » (hors simple affectation)
create function public.dossier_visible_interne(p_dossier uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.dossiers d
    join public.user_roles ur on ur.organization_id = d.organization_id and ur.user_id = auth.uid()
    where d.id = p_dossier
      and (public.role_a(d.organization_id, ur.role, 'dossiers.read_all')
        or (ur.department_id = d.department_id and public.role_a(d.organization_id, ur.role, 'dossiers.read_dept'))
        or (d.responsable_id = auth.uid() and public.role_a(d.organization_id, ur.role, 'dossiers.read_own')))
  );
$$;

create function public.mission_membre(p_mission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mission_agents a
    where a.mission_id = p_mission and a.user_id = auth.uid()
      and public.has_permission(a.organization_id, 'missions.read_assigned'));
$$;

create function public.mission_visible(p_mission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.missions m
     where m.id = p_mission
       and (public.mission_membre(m.id) or public.dossier_visible_interne(m.dossier_id)));
$$;

-- Planifier / modifier une mission
create function public.mission_gestion(p_mission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.missions m
     where m.id = p_mission and public.dossier_perm(m.dossier_id, 'execution.write'));
$$;

-- Rédiger le rapport : personne affectée (permission missions.report) ou pilote de l'exécution
create function public.mission_redaction(p_mission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.missions m
     where m.id = p_mission
       and ((public.mission_membre(m.id) and public.has_permission(m.organization_id, 'missions.report'))
         or public.dossier_perm(m.dossier_id, 'execution.write')));
$$;

create function public.rapport_visible(p_rapport uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rapports_intervention r
                  where r.id = p_rapport and public.mission_visible(r.mission_id));
$$;

create function public.rapport_redaction(p_rapport uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rapports_intervention r
                  where r.id = p_rapport and public.mission_redaction(r.mission_id));
$$;

-- Affecté à une mission du dossier (signalement d'incident)
create function public.dossier_mission_membre(p_dossier uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.missions m
    join public.mission_agents a on a.mission_id = m.id
    where m.dossier_id = p_dossier and a.user_id = auth.uid()
      and m.statut <> 'annulee'
      and public.has_permission(m.organization_id, 'missions.report'));
$$;

create function public.pv_reception_dossier(p_pv uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select dossier_id from public.pv_reception where id = p_pv;
$$;

create or replace function public.droits_dossier(p_dossier uuid)
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
    'clients_write', public.dossier_perm(p_dossier, 'clients.write'),
    'execution_write', public.dossier_perm(p_dossier, 'execution.write'),
    'reception_write', public.dossier_perm(p_dossier, 'reception.write'),
    'suivi_read', public.dossier_visible_interne(p_dossier)
  );
$$;

-- ---------------------------------------------------------------------------
-- Rapports d'intervention
-- ---------------------------------------------------------------------------
-- Mission terrain : le client signe sur l'appareil de l'agent
create function public.signer_rapport(p_rapport uuid, p_nom text, p_image text)
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
  if not found or not public.mission_redaction(r.mission_id) then
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

-- Mission interne : validation par le responsable du dossier
create function public.valider_rapport(p_rapport uuid)
returns public.rapports_intervention
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rapports_intervention;
  m public.missions;
begin
  select * into r from public.rapports_intervention where id = p_rapport for update;
  if not found or not exists (
    select 1 from public.dossiers d where d.id = r.dossier_id and d.responsable_id = auth.uid()
      and public.has_permission(d.organization_id, 'missions.report')
  ) then
    raise exception 'Validation réservée au responsable du dossier' using errcode = 'insufficient_privilege';
  end if;
  select * into m from public.missions where id = r.mission_id for update;
  if m.type <> 'interne' then
    raise exception 'Mission terrain : le rapport doit être signé par le client' using errcode = 'check_violation';
  end if;
  if m.statut = 'annulee' or not exists (select 1 from public.mission_agents where mission_id = m.id) then
    raise exception 'Validation impossible : mission annulée ou sans affectation' using errcode = 'check_violation';
  end if;
  if r.valide_le is not null then
    raise exception 'Rapport déjà validé' using errcode = 'check_violation';
  end if;

  perform set_config('atlas.execution_systeme', 'on', true);
  update public.rapports_intervention
     set valide_par = auth.uid(), valide_le = clock_timestamp()
   where id = r.id returning * into r;
  update public.missions set statut = 'terminee' where id = m.id;
  perform set_config('atlas.execution_systeme', 'off', true);

  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (r.organization_id, 'rapports_intervention', r.id, 'VALIDATION',
          jsonb_build_object('valide_par', auth.uid(), 'mission', m.id), auth.uid());
  return r;
end;
$$;

-- Correction d'un rapport définitif : nouvelle version (l'ancienne reste intacte)
create function public.nouvelle_version_rapport(p_rapport uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rapports_intervention;
  v_statut public.dossier_statut;
  v_id uuid;
begin
  select * into r from public.rapports_intervention where id = p_rapport;
  if not found or not public.mission_redaction(r.mission_id) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if r.signe_le is null and r.valide_le is null then
    raise exception 'Ce rapport est encore modifiable' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.rapports_intervention
              where mission_id = r.mission_id and signe_le is null and valide_le is null) then
    raise exception 'Une nouvelle version est déjà en préparation' using errcode = 'check_violation';
  end if;
  select statut into v_statut from public.dossiers where id = r.dossier_id;
  if v_statut not in ('en_cours', 'reserves') then
    raise exception 'Dossier % : le rapport ne peut plus être repris', v_statut using errcode = 'check_violation';
  end if;

  perform set_config('atlas.execution_systeme', 'on', true);
  update public.missions set statut = 'en_cours' where id = r.mission_id;
  insert into public.rapports_intervention
    (organization_id, mission_id, dossier_id, remplace_id, travaux, observations, latitude, longitude, precision_m)
  values (r.organization_id, r.mission_id, r.dossier_id, r.id, r.travaux, r.observations,
          r.latitude, r.longitude, r.precision_m)
  returning id into v_id;
  insert into public.rapport_photos (organization_id, rapport_id, chemin, largeur, hauteur, taille, legende)
  select organization_id, v_id, chemin, largeur, hauteur, taille, legende
    from public.rapport_photos where rapport_id = r.id;
  perform set_config('atlas.execution_systeme', 'off', true);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Points d'avancement
-- ---------------------------------------------------------------------------
create function public.enregistrer_point_avancement(p_dossier uuid, p_texte text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.dossiers;
  o public.organizations;
  v_email text;
  v_client text;
  v_statut text;
  v_id uuid;
begin
  select * into d from public.dossiers where id = p_dossier;
  if not found or not public.dossier_perm(p_dossier, 'execution.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if d.statut not in ('en_lancement', 'en_cours', 'livre', 'reserves') then
    raise exception 'Le point d''avancement concerne un dossier en exécution' using errcode = 'check_violation';
  end if;
  select * into o from public.organizations where id = d.organization_id;
  select coalesce(nullif(trim(ct.email), ''), nullif(trim(c.email), '')), c.raison_sociale
    into v_email, v_client
    from public.clients c left join public.contacts ct on ct.id = d.contact_id
    where c.id = d.client_id;

  v_statut := case
    when not coalesce((o.parametres ->> 'points_avancement_email_actifs')::boolean, false) then 'consigne'
    when v_email is null or v_email ~* '\.test$' then 'ignore'
    when coalesce(o.parametres ->> 'points_avancement_email_mode', 'simulation') = 'simulation' then 'simule'
    else 'en_attente'
  end;

  perform set_config('atlas.execution_systeme', 'on', true);
  insert into public.points_avancement (organization_id, dossier_id, texte, email_statut, email_destinataire, email_le)
  values (d.organization_id, d.id, trim(p_texte), v_statut,
          case when v_statut in ('simule', 'en_attente') then v_email end,
          case when v_statut = 'simule' then clock_timestamp() end)
  returning id into v_id;
  perform set_config('atlas.execution_systeme', 'off', true);

  return jsonb_build_object('id', v_id, 'email_statut', v_statut, 'destinataire', v_email,
                            'dossier', d.numero, 'client', v_client, 'organisation', o.nom);
end;
$$;

create function public.confirmer_envoi_point(p_point uuid, p_ok boolean, p_erreur text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.points_avancement;
begin
  select * into p from public.points_avancement where id = p_point for update;
  if not found then
    raise exception 'Point d''avancement introuvable' using errcode = 'no_data_found';
  end if;
  if p.email_statut <> 'en_attente' then
    raise exception 'Aucun envoi en attente pour ce point' using errcode = 'check_violation';
  end if;
  perform set_config('atlas.execution_systeme', 'on', true);
  update public.points_avancement
     set email_statut = case when p_ok then 'envoye' else 'echec' end,
         email_le = clock_timestamp(),
         email_erreur = case when p_ok then null else left(p_erreur, 500) end
   where id = p.id;
  perform set_config('atlas.execution_systeme', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- PV de réception
-- ---------------------------------------------------------------------------
-- Lève une exception si le PV n'est pas prêt à être signé
create function public.pv_reception_verifier(p public.pv_reception)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.dossiers where id = p.dossier_id and statut = 'livre' for update;
  if not found then
    raise exception 'La signature du PV exige un dossier livré' using errcode = 'check_violation';
  end if;
  if p.signe_le is not null or p.refuse_le is not null then
    raise exception 'PV de réception déjà signé ou refusé' using errcode = 'check_violation';
  end if;
  if p.decision is null then
    raise exception 'Décision de réception à renseigner' using errcode = 'check_violation';
  end if;
  if p.decision = 'refus' then
    raise exception 'Un refus ne se signe pas : enregistrez le refus motivé' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.pv_reception_lignes where pv_id = p.id) then
    raise exception 'Le PV doit comporter au moins une ligne' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.pv_reception_lignes where pv_id = p.id and resultat is null) then
    raise exception 'Tous les points du PV doivent être renseignés' using errcode = 'check_violation';
  end if;
  if p.type = 'F06' and p.satisfaction is null then
    raise exception 'Satisfaction du client (1 à 5) à renseigner' using errcode = 'check_violation';
  end if;
  if p.decision = 'sans_reserve' then
    if exists (select 1 from public.pv_reception_lignes
                where pv_id = p.id and resultat in ('non_conforme', 'non_realise')) then
      raise exception 'Réception sans réserve impossible : un point est non conforme ou non réalisé'
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.reserves where pv_id = p.id) then
      raise exception 'Réception sans réserve : supprimez les réserves ou changez la décision'
        using errcode = 'check_violation';
    end if;
  else
    if p.date_limite_reserves is null or p.date_limite_reserves < p.date_reception then
      raise exception 'Date limite de levée des réserves à renseigner' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.reserves where pv_id = p.id) then
      raise exception 'Réception avec réserves : décrivez au moins une réserve' using errcode = 'check_violation';
    end if;
  end if;
end;
$$;

create function public.signer_pv_reception(p_pv uuid, p_partie text, p_nom text, p_image text)
returns public.pv_reception
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pv_reception;
  v_sig uuid;
begin
  select * into p from public.pv_reception where id = p_pv for update;
  if not found or not public.dossier_perm(p.dossier_id, 'reception.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if p_partie not in ('atlas', 'client') then
    raise exception 'Partie invalide' using errcode = 'check_violation';
  end if;
  perform public.pv_reception_verifier(p);
  if (p_partie = 'atlas' and p.signature_atlas_id is not null)
     or (p_partie = 'client' and p.signature_client_id is not null) then
    raise exception 'Déjà signé par cette partie' using errcode = 'check_violation';
  end if;

  insert into public.signatures (organization_id, dossier_id, objet_type, objet_id, partie,
                                 nom_signataire, image_png, user_id)
  values (p.organization_id, p.dossier_id, 'pv_reception', p.id, p_partie, trim(p_nom), p_image, auth.uid())
  returning id into v_sig;

  perform set_config('atlas.execution_systeme', 'on', true);
  if p_partie = 'atlas' then
    update public.pv_reception set signature_atlas_id = v_sig,
           signe_le = case when signature_client_id is not null then clock_timestamp() end
     where id = p.id returning * into p;
  else
    update public.pv_reception set signature_client_id = v_sig,
           signe_le = case when signature_atlas_id is not null then clock_timestamp() end
     where id = p.id returning * into p;
    update public.liens_signature set revoque_le = now()
     where objet_type = 'pv_reception' and objet_id = p.id and utilise_le is null and revoque_le is null;
  end if;
  perform set_config('atlas.execution_systeme', 'off', true);

  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (p.organization_id, 'pv_reception', p.id, 'VALIDATION',
          jsonb_build_object('partie', p_partie, 'signature', v_sig, 'nom', trim(p_nom),
                             'decision', p.decision, 'signe', p.signe_le is not null), auth.uid());
  return p;
end;
$$;

create function public.creer_lien_pv_reception(p_pv uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pv_reception;
begin
  select * into p from public.pv_reception where id = p_pv for update;
  if not found or not public.dossier_perm(p.dossier_id, 'reception.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  perform public.pv_reception_verifier(p);
  if p.signature_client_id is not null then
    raise exception 'PV déjà signé par le client' using errcode = 'check_violation';
  end if;
  if p.signature_atlas_id is null then
    raise exception 'Le PV doit être signé par Atlas avant de créer le lien client' using errcode = 'check_violation';
  end if;
  return public.creer_lien_signature('pv_reception', p.id, p.dossier_id, p.organization_id, now() + interval '15 days');
end;
$$;

create or replace function public.lien_signature_info(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.liens_signature;
  v_raison text;
begin
  select * into l from public.liens_signature
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('valide', false, 'raison', 'Lien invalide');
  end if;
  v_raison := case
    when l.utilise_le is not null then 'Ce document a déjà été signé'
    when l.revoque_le is not null then 'Ce lien a été remplacé par un lien plus récent'
    when l.expire_le < now() then 'Ce lien a expiré'
  end;
  if v_raison is null and l.objet_type = 'devis' and not exists (
    select 1 from public.devis where id = l.objet_id and statut = 'envoye') then
    v_raison := 'Ce devis n''est plus disponible à la signature';
  end if;
  if v_raison is null and l.objet_type = 'pv_reception' and not exists (
    select 1 from public.pv_reception p join public.dossiers d on d.id = p.dossier_id
     where p.id = l.objet_id and p.signature_client_id is null and p.signe_le is null
       and p.refuse_le is null and d.statut = 'livre') then
    v_raison := 'Ce procès-verbal n''est plus disponible à la signature';
  end if;
  return jsonb_build_object(
    'valide', v_raison is null, 'raison', v_raison,
    'objet_type', l.objet_type, 'objet_id', l.objet_id,
    'dossier_id', l.dossier_id, 'organization_id', l.organization_id
  );
end;
$$;

create or replace function public.signer_par_lien(
  p_token text,
  p_nom text,
  p_image text,
  p_ip inet,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.liens_signature;
  v_sig uuid;
  v_info jsonb := public.lien_signature_info(p_token);
  v_pv public.pv_lancement;
  v_pvr public.pv_reception;
begin
  if not (v_info ->> 'valide')::boolean then
    raise exception '%', v_info ->> 'raison' using errcode = 'check_violation';
  end if;
  if v_info ->> 'objet_type' = 'pv_reception' then
    select * into v_pvr from public.pv_reception where id = (v_info ->> 'objet_id')::uuid for update;
    perform public.pv_reception_verifier(v_pvr);
  end if;
  select * into l from public.liens_signature
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if l.revoque_le is not null or l.expire_le < now() then
    raise exception 'Lien de signature indisponible' using errcode = 'check_violation';
  end if;
  if l.utilise_le is not null then
    raise exception 'Ce document a déjà été signé' using errcode = 'check_violation';
  end if;

  insert into public.signatures (organization_id, dossier_id, objet_type, objet_id, partie,
                                 nom_signataire, image_png, ip, user_agent, lien_id)
  values (l.organization_id, l.dossier_id, l.objet_type, l.objet_id, 'client',
          trim(p_nom), p_image, p_ip, left(p_user_agent, 500), l.id)
  returning id into v_sig;

  if l.objet_type = 'devis' then
    perform set_config('atlas.finance_systeme', 'on', true);
    update public.devis set statut = 'signe', signe_le = clock_timestamp(), signature_id = v_sig
     where id = l.objet_id;
    perform set_config('atlas.finance_systeme', 'off', true);
  elsif l.objet_type = 'pv_lancement' then
    select * into v_pv from public.pv_lancement where id = l.objet_id for update;
    if v_pv.signature_client_id is not null then
      raise exception 'PV déjà signé par le client' using errcode = 'check_violation';
    end if;
    perform set_config('atlas.finance_systeme', 'on', true);
    update public.pv_lancement
       set signature_client_id = v_sig,
           signe_le = case when signature_atlas_id is not null then clock_timestamp() end
     where id = l.objet_id;
    perform set_config('atlas.finance_systeme', 'off', true);
  elsif l.objet_type = 'pv_reception' then
    if v_pvr.signature_client_id is not null then
      raise exception 'PV déjà signé par le client' using errcode = 'check_violation';
    end if;
    perform set_config('atlas.execution_systeme', 'on', true);
    update public.pv_reception
       set signature_client_id = v_sig,
           signe_le = case when signature_atlas_id is not null then clock_timestamp() end
     where id = l.objet_id;
    perform set_config('atlas.execution_systeme', 'off', true);
  else
    raise exception 'Type de document non signable par lien' using errcode = 'check_violation';
  end if;

  update public.liens_signature set utilise_le = now() where id = l.id;
  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (l.organization_id, l.objet_type::text, l.objet_id, 'VALIDATION',
          jsonb_build_object('signature_client', v_sig, 'nom', trim(p_nom), 'ip', p_ip::text), null);
  return jsonb_build_object('objet_type', l.objet_type, 'objet_id', l.objet_id,
                            'dossier_id', l.dossier_id, 'signature_id', v_sig);
end;
$$;

create function public.lever_reserve(p_reserve uuid, p_commentaire text default null)
returns public.reserves
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reserves;
begin
  select * into r from public.reserves where id = p_reserve for update;
  if not found or not public.dossier_perm(r.dossier_id, 'reception.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.pv_reception where id = r.pv_id and signe_le is not null) then
    raise exception 'Le PV de réception n''est pas signé' using errcode = 'check_violation';
  end if;
  if r.statut = 'levee' then
    raise exception 'Réserve déjà levée' using errcode = 'check_violation';
  end if;
  perform set_config('atlas.execution_systeme', 'on', true);
  update public.reserves
     set statut = 'levee', levee_le = clock_timestamp(), levee_par = auth.uid(),
         commentaire_levee = nullif(trim(p_commentaire), '')
   where id = r.id returning * into r;
  perform set_config('atlas.execution_systeme', 'off', true);
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Facture de solde
--   solde = (TTC du devis signé + avenants signés) − (factures émises non annulées − avoirs)
-- ---------------------------------------------------------------------------
create function public.generer_facture_solde(p_dossier uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
  f public.factures;
  r record;
  v_total numeric;
  v_deja numeric;
  v_solde numeric;
  v_k numeric;
  v_correction_ht numeric;
  v_id uuid;
  v_ordre integer := 1;
begin
  perform 1 from public.dossiers where id = p_dossier for update;
  select * into d from public.devis
   where dossier_id = p_dossier and statut = 'signe'
   order by signe_le desc nulls last limit 1;
  if not found then return null; end if;
  if exists (select 1 from public.factures
              where dossier_id = p_dossier and type = 'solde' and statut not in ('brouillon', 'annulee')) then
    return null;
  end if;
  select id into v_id from public.factures
   where dossier_id = p_dossier and type = 'solde' and statut = 'brouillon'
   order by created_at, id limit 1 for update;

  v_total := d.total_ttc + coalesce((
    select sum(a.montant_delta) from public.avenants a
    join public.contrats c on c.id = a.contrat_id
    where c.dossier_id = p_dossier and a.statut = 'signe'), 0);
  v_deja := coalesce((
    select sum(total_ttc - montant_avoirs) from public.factures
     where dossier_id = p_dossier and statut not in ('brouillon', 'annulee')), 0);
  v_solde := round(v_total - v_deja, 2);
  if v_solde <= 0 then
    delete from public.factures where id = v_id;
    return null;
  end if;

  select 1 + coalesce(sum((t ->> 'taux')::numeric), 0) / 100 into v_k
    from jsonb_array_elements(d.taxes) t;

  perform set_config('atlas.finance_systeme', 'on', true);
  if v_id is null then
    insert into public.factures (organization_id, dossier_id, devis_id, type, objet, devise, taux_cdf, taxes)
    values (d.organization_id, d.dossier_id, d.id, 'solde', 'Solde — ' || coalesce(d.objet, d.numero),
            d.devise, d.taux_cdf, d.taxes)
    returning id into v_id;
  else
    delete from public.facture_lignes where facture_id = v_id;
    update public.factures set devis_id = d.id, devise = d.devise, taux_cdf = d.taux_cdf, taxes = d.taxes, arrondi = 0
     where id = v_id;
  end if;

  insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
  values (d.organization_id, v_id, 1, 'Montant total du devis ' || d.numero || ' v' || d.version, 1, d.total_ht);

  for r in select a.numero, a.objet, a.montant_delta from public.avenants a
            join public.contrats c on c.id = a.contrat_id
            where c.dossier_id = p_dossier and a.statut = 'signe' and a.montant_delta <> 0
            order by a.signe_le, a.numero loop
    v_ordre := v_ordre + 1;
    insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
    values (d.organization_id, v_id, v_ordre, 'Avenant ' || r.numero || ' — ' || r.objet, 1,
            round(r.montant_delta / v_k, 2));
  end loop;

  for r in select numero, total_ttc, montant_avoirs from public.factures
            where dossier_id = p_dossier and statut not in ('brouillon', 'annulee')
              and total_ttc - montant_avoirs <> 0
            order by numero loop
    v_ordre := v_ordre + 1;
    insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
    values (d.organization_id, v_id, v_ordre,
            'Déduction facture ' || r.numero || case when r.montant_avoirs > 0 then ' (nette d''avoirs)' else '' end,
            1,
            -round((r.total_ttc - r.montant_avoirs) / v_k, 2));
  end loop;

  -- Arrondi : le TTC de la facture doit être exactement le solde calculé
  select * into f from public.factures where id = v_id;
  if abs(v_solde - f.total_ttc) > 0.05 then
    v_correction_ht := round((v_solde - f.total_ttc) / v_k, 2);
    insert into public.facture_lignes (organization_id, facture_id, ordre, description, prix_unitaire)
    values (d.organization_id, v_id, v_ordre + 1, 'Ajustement d''arrondi des lignes', v_correction_ht);
    select * into f from public.factures where id = v_id;
  end if;
  if f.total_ttc <> v_solde then
    update public.factures set arrondi = v_solde - f.total_ttc where id = v_id;
  end if;
  perform set_config('atlas.finance_systeme', 'off', true);
  return v_id;
end;
$$;

create or replace function public.creer_facture_depuis_devis(p_devis uuid, p_type public.facture_type)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
  v_id uuid;
begin
  select * into d from public.devis where id = p_devis;
  if not found or not (public.can_edit_dossier(d.dossier_id) or public.is_finance(d.organization_id)) then
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
  if exists (select 1 from public.factures where type = p_type and statut <> 'annulee'
      and ((p_type = 'solde' and dossier_id = d.dossier_id) or (p_type <> 'solde' and devis_id = d.id))) then
    raise exception 'Une facture % existe déjà pour ce devis', p_type using errcode = 'check_violation';
  end if;

  if p_type = 'solde' then
    v_id := public.generer_facture_solde(d.dossier_id);
    if v_id is null then
      raise exception 'Aucun solde à facturer sur ce dossier' using errcode = 'check_violation';
    end if;
    return v_id;
  end if;

  insert into public.factures (organization_id, dossier_id, devis_id, type, objet, devise, taux_cdf, taxes)
  values (d.organization_id, d.dossier_id, d.id, p_type, 'Acompte — ' || coalesce(d.objet, d.numero),
          d.devise, d.taux_cdf, d.taxes)
  returning id into v_id;
  insert into public.facture_lignes (organization_id, facture_id, ordre, description, quantite, prix_unitaire)
  values (d.organization_id, v_id, 1,
          'Acompte de ' || trim(to_char(d.acompte_pct, 'FM990.##')) || ' % sur devis ' || d.numero || ' v' || d.version,
          1, round(d.total_ht * d.acompte_pct / 100, 2));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Statuts : application (historique, audit, garantie, facture de solde)
-- ---------------------------------------------------------------------------
create function public.dossier_appliquer_statut(
  p_dossier uuid,
  p_statut public.dossier_statut,
  p_motif text,
  p_uid uuid,
  p_tacite boolean default false
)
returns public.dossiers
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.dossiers;
  v_ancien public.dossier_statut;
  v_garantie integer;
  v_reception boolean := p_statut = 'receptionne_a_facturer';
begin
  select * into d from public.dossiers where id = p_dossier for update;
  v_ancien := d.statut;
  select coalesce((parametres ->> 'garantie_jours')::integer, 0) into v_garantie
    from public.organizations where id = d.organization_id;

  perform set_config('atlas.changement_statut', 'on', true);
  update public.dossiers
     set statut = p_statut,
         statut_motif = p_motif,
         statut_change_le = clock_timestamp(),
         receptionne_le = case when v_reception then clock_timestamp() else receptionne_le end,
         reception_tacite = case when v_reception then p_tacite else reception_tacite end,
         garantie_fin = case when v_reception then current_date + v_garantie else garantie_fin end
   where id = d.id
  returning * into d;
  perform set_config('atlas.changement_statut', 'off', true);

  insert into public.dossier_status_history
    (organization_id, dossier_id, ancien_statut, nouveau_statut, motif, created_by)
  values (d.organization_id, d.id, v_ancien, p_statut, p_motif, p_uid);

  insert into public.audit_log
    (organization_id, table_name, record_id, action, old_data, new_data, motif, created_by)
  values (d.organization_id, 'dossiers', d.id, 'STATUT',
          jsonb_build_object('statut', v_ancien),
          jsonb_build_object('statut', p_statut, 'reception_tacite', v_reception and p_tacite),
          p_motif, p_uid);

  if v_reception then
    perform public.generer_facture_solde(d.id);
  end if;
  return d;
end;
$$;

-- Refus motivé du client : PV clos, retour du dossier en cours
create function public.refuser_reception(p_pv uuid, p_motif text)
returns public.dossiers
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pv_reception;
  d public.dossiers;
  v_motif text := nullif(trim(p_motif), '');
begin
  select * into p from public.pv_reception where id = p_pv for update;
  if not found or not public.dossier_perm(p.dossier_id, 'reception.write') then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if p.signe_le is not null or p.refuse_le is not null then
    raise exception 'PV de réception déjà signé ou refusé' using errcode = 'check_violation';
  end if;
  if v_motif is null then
    raise exception 'Motif du refus obligatoire' using errcode = 'check_violation';
  end if;
  select * into d from public.dossiers where id = p.dossier_id for update;
  if d.statut <> 'livre' then
    raise exception 'Le refus de réception concerne un dossier livré' using errcode = 'check_violation';
  end if;

  perform set_config('atlas.execution_systeme', 'on', true);
  update public.pv_reception
     set decision = 'refus', motif_refus = v_motif, refuse_le = clock_timestamp()
   where id = p.id;
  perform set_config('atlas.execution_systeme', 'off', true);
  update public.liens_signature set revoque_le = now()
   where objet_type = 'pv_reception' and objet_id = p.id and utilise_le is null and revoque_le is null;

  return public.dossier_appliquer_statut(d.id, 'en_cours', 'Réception refusée : ' || v_motif, auth.uid());
end;
$$;

-- Réception tacite (tâche quotidienne) : clause au contrat signé, dossier livré depuis le délai
-- paramétré, aucune réponse du client (ni signature ni refus) depuis la livraison.
create function public.receptions_tacites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_nb integer := 0;
begin
  for r in
    select ds.id, coalesce((o.parametres ->> 'reception_tacite_jours')::integer, 7) as jours
    from public.dossiers ds
    join public.organizations o on o.id = ds.organization_id
    where ds.statut = 'livre'
      and ds.statut_change_le <= now() - make_interval(days => coalesce((o.parametres ->> 'reception_tacite_jours')::integer, 7))
      and exists (select 1 from public.contrats c
                   where c.dossier_id = ds.id and c.statut = 'signe' and c.reception_tacite)
      and not exists (select 1 from public.pv_reception p
                       where p.dossier_id = ds.id
                         and ((p.signe_le is null and p.refuse_le is null and p.signature_client_id is not null)
                           or p.signe_le > ds.statut_change_le
                           or p.refuse_le > ds.statut_change_le))
    for update of ds skip locked
  loop
    perform public.dossier_appliquer_statut(
      r.id, 'receptionne_a_facturer',
      'Réception tacite : sans réponse du client ' || r.jours || ' jours après la livraison (clause du contrat)',
      null, true);
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;

-- ---------------------------------------------------------------------------
-- change_dossier_status : phase 3
-- ---------------------------------------------------------------------------
create or replace function public.change_dossier_status(
  p_dossier_id uuid,
  p_nouveau_statut public.dossier_statut,
  p_motif text default null
)
returns public.dossiers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  d public.dossiers;
  v public.verifications;
  v_motif text := nullif(trim(p_motif), '');
  v_gerant boolean;
  v_pilote boolean;
  v_exec boolean;
  v_recep boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;

  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found or not public.can_see_dossier(p_dossier_id) then
    raise exception 'Dossier introuvable' using errcode = 'no_data_found';
  end if;

  if d.statut = p_nouveau_statut then
    raise exception 'Le dossier est déjà au statut %', p_nouveau_statut using errcode = 'check_violation';
  end if;

  v_gerant := public.has_role(d.organization_id, array['gerant']::public.app_role[]);
  v_pilote := public.can_edit_dossier(p_dossier_id);
  v_exec := public.dossier_perm(p_dossier_id, 'execution.write');
  v_recep := public.dossier_perm(p_dossier_id, 'reception.write');

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

  elsif d.statut = 'en_lancement' and p_nouveau_statut = 'en_cours' then
    if not v_exec then
      raise exception 'Démarrage réservé au pilote de l''exécution du dossier' using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.missions m
                    where m.dossier_id = d.id and m.statut = 'planifiee'
                      and exists (select 1 from public.mission_agents a where a.mission_id = m.id)) then
      raise exception 'Démarrage impossible : planifiez au moins une mission avec une personne affectée'
        using errcode = 'check_violation';
    end if;

  elsif d.statut = 'en_cours' and p_nouveau_statut = 'livre' then
    if not v_exec then
      raise exception 'Livraison réservée au pilote de l''exécution du dossier' using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.missions where dossier_id = d.id and statut <> 'annulee') then
      raise exception 'Livraison impossible : aucune mission réalisée' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.missions m
                where m.dossier_id = d.id and m.statut <> 'annulee' and m.type = 'terrain'
                  and (m.statut <> 'terminee' or not exists (
                        select 1 from public.rapports_intervention r
                         where r.mission_id = m.id and r.signe_le is not null))) then
      raise exception 'Livraison impossible : chaque mission terrain exige un rapport d''intervention signé par le client'
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.missions m
                where m.dossier_id = d.id and m.statut <> 'annulee' and m.type = 'interne'
                  and (m.statut <> 'terminee' or not exists (
                        select 1 from public.rapports_intervention r
                         where r.mission_id = m.id and r.valide_le is not null))) then
      raise exception 'Livraison impossible : chaque mission interne exige un rapport validé par le responsable du dossier'
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.livrables where dossier_id = d.id and remis_le is null) then
      raise exception 'Livraison impossible : des livrables ne sont pas remis' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.incidents
                where dossier_id = d.id and gravite = 'elevee' and statut <> 'clos') then
      raise exception 'Livraison impossible : un incident de gravité élevée est encore ouvert'
        using errcode = 'check_violation';
    end if;

  elsif d.statut = 'livre' and p_nouveau_statut = 'reserves' then
    if not v_recep then
      raise exception 'Réception réservée au responsable du dossier, à son responsable de département, au directeur des opérations ou au gérant'
        using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.pv_reception p
                    where p.dossier_id = d.id and p.signe_le > d.statut_change_le
                      and p.decision = 'avec_reserves'
                      and exists (select 1 from public.reserves r where r.pv_id = p.id and r.statut = 'ouverte')) then
      raise exception 'Réserves : PV de réception « avec réserves » signé par les deux parties requis'
        using errcode = 'check_violation';
    end if;

  elsif d.statut = 'livre' and p_nouveau_statut = 'receptionne_a_facturer' then
    if not v_recep then
      raise exception 'Réception réservée au responsable du dossier, à son responsable de département, au directeur des opérations ou au gérant'
        using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.pv_reception p
                    where p.dossier_id = d.id and p.signe_le > d.statut_change_le
                      and (p.decision = 'sans_reserve'
                        or (p.decision = 'avec_reserves' and not exists (
                              select 1 from public.reserves r where r.pv_id = p.id and r.statut = 'ouverte')))) then
      raise exception 'Réception impossible : PV de réception signé par les deux parties et sans réserve ouverte requis'
        using errcode = 'check_violation';
    end if;

  elsif d.statut = 'reserves' and p_nouveau_statut = 'receptionne_a_facturer' then
    if not v_recep then
      raise exception 'Réception réservée au responsable du dossier, à son responsable de département, au directeur des opérations ou au gérant'
        using errcode = 'insufficient_privilege';
    end if;
    if exists (select 1 from public.reserves r
                join public.pv_reception p on p.id = r.pv_id
                where r.dossier_id = d.id and p.signe_le is not null and r.statut = 'ouverte') then
      raise exception 'Réception impossible : toutes les réserves doivent être levées' using errcode = 'check_violation';
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
    if exists (select 1 from public.factures where dossier_id = d.id and statut = 'brouillon') then
      raise exception 'Clôture impossible : une facture est encore en brouillon (émettez-la ou supprimez-la)'
        using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.avis_clients where dossier_id = d.id) then
      raise exception 'Clôture impossible : l''avis du client (note de 1 à 5) doit être saisi'
        using errcode = 'check_violation';
    end if;

  else
    raise exception 'Transition % → % non autorisée', d.statut, p_nouveau_statut
      using errcode = 'check_violation';
  end if;

  return public.dossier_appliquer_statut(d.id, p_nouveau_statut, v_motif, v_uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Missions de l'utilisateur et fiche mission (les personnes affectées ne voient pas
-- forcément tout le dossier : données utiles renvoyées ici)
-- ---------------------------------------------------------------------------
create function public.mes_missions(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'type', m.type, 'titre', m.titre, 'lieu', m.lieu, 'debut', m.debut, 'fin', m.fin,
    'statut', m.statut, 'dossier_id', d.id, 'dossier', d.numero, 'client', c.raison_sociale) order by m.debut), '[]'::jsonb)
  from public.missions m
  join public.mission_agents a on a.mission_id = m.id and a.user_id = auth.uid()
  join public.dossiers d on d.id = m.dossier_id
  left join public.clients c on c.id = d.client_id
  where m.organization_id = p_org and m.statut <> 'annulee'
    and public.has_permission(p_org, 'missions.read_assigned');
$$;

create function public.mission_detail(p_mission uuid)
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
    'peut_gerer', public.mission_gestion(m.id),
    'peut_valider', coalesce(d.responsable_id = auth.uid() and public.has_permission(d.organization_id, 'missions.report'), false)
  )
  from public.missions m
  join public.dossiers d on d.id = m.dossier_id
  left join public.clients c on c.id = d.client_id
  where m.id = p_mission and public.mission_visible(m.id);
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'dossier_visible_interne(uuid)', 'mission_membre(uuid)', 'mission_visible(uuid)', 'mission_gestion(uuid)',
    'mission_redaction(uuid)', 'rapport_visible(uuid)', 'rapport_redaction(uuid)',
    'dossier_mission_membre(uuid)', 'pv_reception_dossier(uuid)',
    'signer_rapport(uuid, text, text)', 'valider_rapport(uuid)', 'nouvelle_version_rapport(uuid)',
    'enregistrer_point_avancement(uuid, text)',
    'signer_pv_reception(uuid, text, text, text)', 'creer_lien_pv_reception(uuid)',
    'lever_reserve(uuid, text)', 'refuser_reception(uuid, text)',
    'mes_missions(uuid)', 'mission_detail(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'pv_reception_verifier(public.pv_reception)', 'generer_facture_solde(uuid)',
    'confirmer_envoi_point(uuid, boolean, text)',
    'dossier_appliquer_statut(uuid, public.dossier_statut, text, uuid, boolean)', 'receptions_tacites()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.receptions_tacites() to service_role;
grant execute on function public.confirmer_envoi_point(uuid, boolean, text) to service_role;
