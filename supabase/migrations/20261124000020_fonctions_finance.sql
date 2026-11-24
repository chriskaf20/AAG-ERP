-- Phase 2 — Fonctions métier : devis, signature, PV, factures, avoirs, relances,
-- et extension de change_dossier_status.

-- ---------------------------------------------------------------------------
-- Devis
-- ---------------------------------------------------------------------------
create function public.valider_devis(p_devis uuid)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.can_see_finance(d.dossier_id) then
    raise exception 'Devis introuvable' using errcode = 'no_data_found';
  end if;
  if not public.has_role(d.organization_id, array['gerant']::public.app_role[]) then
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
$$;

-- Envoi : bloqué si le devis dépasse le seuil sans validation du gérant.
-- Renvoie le jeton du lien de signature (en clair, une seule fois).
create function public.envoyer_devis(p_devis uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
  v_token text;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.can_see_finance(d.dossier_id) then
    raise exception 'Devis introuvable' using errcode = 'no_data_found';
  end if;
  if not public.can_edit_dossier(d.dossier_id) then
    raise exception 'Envoi réservé au pilote du dossier' using errcode = 'insufficient_privilege';
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
$$;

-- Nouveau lien (ex. lien perdu) : révoque les liens actifs
create function public.regenerer_lien_devis(p_devis uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
begin
  select * into d from public.devis where id = p_devis;
  if not found or not public.can_edit_dossier(d.dossier_id) then
    raise exception 'Action non autorisée' using errcode = 'insufficient_privilege';
  end if;
  if d.statut <> 'envoye' then
    raise exception 'Seul un devis envoyé peut recevoir un lien de signature' using errcode = 'check_violation';
  end if;
  return public.creer_lien_signature('devis', d.id, d.dossier_id, d.organization_id,
                                     (d.date_validite + 1)::timestamptz);
end;
$$;

create function public.nouvelle_version_devis(p_devis uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
  v_id uuid;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.can_edit_dossier(d.dossier_id) then
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
                                   quantite, prix_unitaire, remise_pct)
  select organization_id, v_id, ordre, service_id, description, unite, quantite, prix_unitaire, remise_pct
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
$$;

create function public.refuser_devis(p_devis uuid, p_motif text)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
begin
  select * into d from public.devis where id = p_devis for update;
  if not found or not public.can_edit_dossier(d.dossier_id) then
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
$$;

-- ---------------------------------------------------------------------------
-- Signature par lien (appelée uniquement côté serveur, rôle service_role)
-- ---------------------------------------------------------------------------
create function public.lien_signature_info(p_token text)
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
  return jsonb_build_object(
    'valide', v_raison is null, 'raison', v_raison,
    'objet_type', l.objet_type, 'objet_id', l.objet_id,
    'dossier_id', l.dossier_id, 'organization_id', l.organization_id
  );
end;
$$;

create function public.signer_par_lien(
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
begin
  if not (v_info ->> 'valide')::boolean then
    raise exception '%', v_info ->> 'raison' using errcode = 'check_violation';
  end if;
  select * into l from public.liens_signature
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if l.utilise_le is not null then
    raise exception 'Ce document a déjà été signé' using errcode = 'check_violation';
  end if;

  insert into public.signatures (organization_id, dossier_id, objet_type, objet_id, partie,
                                 nom_signataire, image_png, ip, user_agent, lien_id)
  values (l.organization_id, l.dossier_id, l.objet_type, l.objet_id, 'client',
          trim(p_nom), p_image, p_ip, left(p_user_agent, 500), l.id)
  returning id into v_sig;

  perform set_config('atlas.finance_systeme', 'on', true);
  if l.objet_type = 'devis' then
    update public.devis set statut = 'signe', signe_le = clock_timestamp(), signature_id = v_sig
     where id = l.objet_id;
  else
    select * into v_pv from public.pv_lancement where id = l.objet_id for update;
    if v_pv.signature_client_id is not null then
      raise exception 'PV déjà signé par le client' using errcode = 'check_violation';
    end if;
    update public.pv_lancement
       set signature_client_id = v_sig,
           signe_le = case when signature_atlas_id is not null then clock_timestamp() end
     where id = l.objet_id;
  end if;
  perform set_config('atlas.finance_systeme', 'off', true);

  update public.liens_signature set utilise_le = now() where id = l.id;
  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (l.organization_id, l.objet_type::text, l.objet_id, 'VALIDATION',
          jsonb_build_object('signature_client', v_sig, 'nom', trim(p_nom), 'ip', p_ip::text), null);
  return jsonb_build_object('objet_type', l.objet_type, 'objet_id', l.objet_id,
                            'dossier_id', l.dossier_id, 'signature_id', v_sig);
end;
$$;

-- ---------------------------------------------------------------------------
-- PV de lancement F-04
-- ---------------------------------------------------------------------------
create function public.pv_points_confirmes(p public.pv_lancement)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p.perimetre_confirme and p.planning_confirme and p.interlocuteurs_confirmes
     and p.livrables_confirmes and p.acces_site_confirme and p.acompte_confirme;
$$;

create function public.signer_pv(p_pv uuid, p_partie text, p_nom text, p_image text)
returns public.pv_lancement
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pv_lancement;
  v_sig uuid;
begin
  select * into p from public.pv_lancement where id = p_pv for update;
  if not found or not public.can_edit_dossier(p.dossier_id) then
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
$$;

create function public.creer_lien_pv(p_pv uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pv_lancement;
begin
  select * into p from public.pv_lancement where id = p_pv;
  if not found or not public.can_edit_dossier(p.dossier_id) then
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
$$;

-- ---------------------------------------------------------------------------
-- Factures
-- ---------------------------------------------------------------------------
create function public.creer_facture_depuis_devis(p_devis uuid, p_type public.facture_type)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devis;
  v_id uuid;
  f record;
  v_ordre integer := 1;
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
$$;

-- Émission : numéro FAC attribué ici (aucun trou de séquence)
create function public.emettre_facture(p_facture uuid)
returns public.factures
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.factures;
begin
  select * into f from public.factures where id = p_facture for update;
  if not found or not public.can_see_finance(f.dossier_id) then
    raise exception 'Facture introuvable' using errcode = 'no_data_found';
  end if;
  if not public.is_finance(f.organization_id) then
    raise exception 'Émission réservée au DAF, au gérant ou à l''administrateur' using errcode = 'insufficient_privilege';
  end if;
  if f.statut <> 'brouillon' then
    raise exception 'Facture déjà émise' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.facture_lignes where facture_id = f.id) or f.total_ttc <= 0 then
    raise exception 'Facture vide ou de montant nul' using errcode = 'check_violation';
  end if;
  if f.type = 'solde' and exists (
    select 1 from public.factures
     where dossier_id = f.dossier_id and id <> f.id
       and statut not in ('brouillon', 'annulee') and normalisee_le is null) then
    raise exception 'Facture de solde : les factures précédentes du dossier doivent être normalisées (e-DEF)'
      using errcode = 'check_violation';
  end if;

  perform set_config('atlas.finance_systeme', 'on', true);
  update public.factures
     set numero = public.prochain_numero(f.organization_id, 'FAC'),
         statut = 'emise',
         date_emission = current_date,
         echeance = current_date + f.delai_paiement_jours,
         emise_par = auth.uid(),
         emise_le = clock_timestamp()
   where id = f.id;
  perform set_config('atlas.finance_systeme', 'off', true);
  f := public.facture_recalculer(f.id);
  insert into public.audit_log (organization_id, table_name, record_id, action, new_data, created_by)
  values (f.organization_id, 'factures', f.id, 'STATUT',
          jsonb_build_object('statut', f.statut, 'numero', f.numero, 'total_ttc', f.total_ttc), auth.uid());
  return f;
end;
$$;

-- Saisie de la normalisation obtenue sur e-DEF (mode manuel)
create function public.normaliser_facture(
  p_facture uuid,
  p_numero_normalise text,
  p_code_def text,
  p_qr_code text default null
)
returns public.factures
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.factures;
begin
  select * into f from public.factures where id = p_facture for update;
  if not found or not public.is_finance(f.organization_id) then
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
$$;

create function public.emettre_avoir(p_facture uuid, p_montant numeric, p_motif text)
returns public.avoirs
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.factures;
  a public.avoirs;
begin
  select * into f from public.factures where id = p_facture for update;
  if not found or not public.is_finance(f.organization_id) then
    raise exception 'Avoir réservé au DAF, au gérant ou à l''administrateur' using errcode = 'insufficient_privilege';
  end if;
  if f.statut in ('brouillon', 'annulee') then
    raise exception 'Avoir impossible sur une facture %', f.statut using errcode = 'check_violation';
  end if;
  if p_montant is null or p_montant <= 0 or p_montant > f.solde_du then
    raise exception 'Montant de l''avoir invalide (solde dû : %)', f.solde_du using errcode = 'check_violation';
  end if;
  if nullif(trim(p_motif), '') is null then
    raise exception 'Motif obligatoire' using errcode = 'check_violation';
  end if;
  insert into public.avoirs (organization_id, facture_id, dossier_id, numero, montant_ttc, motif)
  values (f.organization_id, f.id, f.dossier_id, public.prochain_numero(f.organization_id, 'AV'),
          p_montant, trim(p_motif))
  returning * into a;
  return a;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tâches quotidiennes et relances (rôle service_role / cron)
-- ---------------------------------------------------------------------------
create function public.taches_quotidiennes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires integer;
  v_retards integer := 0;
  r record;
begin
  perform set_config('atlas.finance_systeme', 'on', true);
  update public.devis set statut = 'expire'
   where statut = 'envoye' and date_validite < current_date;
  get diagnostics v_expires = row_count;
  perform set_config('atlas.finance_systeme', 'off', true);

  for r in select id from public.factures
            where statut in ('emise', 'normalisee', 'partiellement_payee') and echeance < current_date loop
    perform public.facture_recalculer(r.id);
    v_retards := v_retards + 1;
  end loop;
  return jsonb_build_object('devis_expires', v_expires, 'factures_recalculees', v_retards);
end;
$$;

create function public.relances_a_envoyer()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb := '[]'::jsonb;
  r record;
  v_token text;
begin
  -- Devis envoyés depuis 7 jours, non signés : nouveau lien de signature
  for r in
    select d.id, d.organization_id, d.dossier_id, d.numero, d.version, d.total_ttc, d.devise, d.date_validite,
           o.nom as org_nom, o.email as org_email, ds.numero as dossier_numero,
           coalesce(ct.email, c.email) as email, coalesce(ct.nom, c.raison_sociale) as destinataire_nom
      from public.devis d
      join public.organizations o on o.id = d.organization_id
      join public.dossiers ds on ds.id = d.dossier_id
      join public.clients c on c.id = ds.client_id
      left join public.contacts ct on ct.id = ds.contact_id
     where d.statut = 'envoye' and d.envoye_le <= now() - interval '7 days'
       and d.date_validite >= current_date
       and not exists (select 1 from public.relances rl
                        where rl.objet_type = 'devis' and rl.objet_id = d.id and rl.statut = 'envoyee')
  loop
    v_token := case when r.email is not null then
      public.creer_lien_signature('devis', r.id, r.dossier_id, r.organization_id, (r.date_validite + 1)::timestamptz) end;
    v_res := v_res || jsonb_build_object(
      'objet_type', 'devis', 'objet_id', r.id, 'niveau', 'j7', 'organization_id', r.organization_id,
      'dossier_id', r.dossier_id, 'dossier_numero', r.dossier_numero, 'numero', r.numero || ' v' || r.version,
      'montant', r.total_ttc, 'devise', r.devise, 'echeance', r.date_validite,
      'email', r.email, 'destinataire_nom', r.destinataire_nom,
      'org_nom', r.org_nom, 'org_email', r.org_email, 'token', v_token);
  end loop;

  -- Factures impayées : J+7, J+15, J+30 après échéance (niveau le plus élevé atteint, une fois)
  for r in
    select x.* from (
      select f.id, f.organization_id, f.dossier_id, f.numero, f.solde_du, f.devise, f.echeance,
             f.numero_facture_normalisee,
             o.nom as org_nom, o.email as org_email, ds.numero as dossier_numero,
             coalesce(ct.email, c.email) as email, coalesce(ct.nom, c.raison_sociale) as destinataire_nom,
             case when current_date >= f.echeance + 30 then 'j30'
                  when current_date >= f.echeance + 15 then 'j15'
                  when current_date >= f.echeance + 7 then 'j7' end::public.relance_niveau as niveau
        from public.factures f
        join public.organizations o on o.id = f.organization_id
        join public.dossiers ds on ds.id = f.dossier_id
        join public.clients c on c.id = ds.client_id
        left join public.contacts ct on ct.id = ds.contact_id
       where f.statut in ('emise', 'normalisee', 'partiellement_payee', 'en_retard')
         and f.solde_du > 0 and f.echeance + 7 <= current_date
    ) x
    where not exists (select 1 from public.relances rl
                       where rl.objet_type = 'facture' and rl.objet_id = x.id
                         and rl.statut = 'envoyee' and rl.niveau >= x.niveau)
  loop
    v_res := v_res || jsonb_build_object(
      'objet_type', 'facture', 'objet_id', r.id, 'niveau', r.niveau, 'organization_id', r.organization_id,
      'dossier_id', r.dossier_id, 'dossier_numero', r.dossier_numero,
      'numero', coalesce(r.numero_facture_normalisee, r.numero),
      'montant', r.solde_du, 'devise', r.devise, 'echeance', r.echeance,
      'email', r.email, 'destinataire_nom', r.destinataire_nom,
      'org_nom', r.org_nom, 'org_email', r.org_email, 'token', null);
  end loop;
  return v_res;
end;
$$;

create function public.enregistrer_relance(
  p_org uuid, p_dossier uuid, p_objet_type text, p_objet_id uuid,
  p_niveau public.relance_niveau, p_destinataire text, p_statut text, p_erreur text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.relances (organization_id, dossier_id, objet_type, objet_id, niveau, destinataire, statut, erreur)
  values (p_org, p_dossier, p_objet_type, p_objet_id, p_niveau, p_destinataire, p_statut, p_erreur)
  returning id;
$$;

-- ---------------------------------------------------------------------------
-- change_dossier_status : phase 2
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

  v_gerant := public.has_role(d.organization_id, array['gerant']::public.app_role[]);
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
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------
revoke execute on function public.valider_devis(uuid) from public, anon;
revoke execute on function public.envoyer_devis(uuid) from public, anon;
revoke execute on function public.regenerer_lien_devis(uuid) from public, anon;
revoke execute on function public.nouvelle_version_devis(uuid) from public, anon;
revoke execute on function public.refuser_devis(uuid, text) from public, anon;
revoke execute on function public.signer_pv(uuid, text, text, text) from public, anon;
revoke execute on function public.creer_lien_pv(uuid) from public, anon;
revoke execute on function public.creer_facture_depuis_devis(uuid, public.facture_type) from public, anon;
revoke execute on function public.emettre_facture(uuid) from public, anon;
revoke execute on function public.normaliser_facture(uuid, text, text, text) from public, anon;
revoke execute on function public.emettre_avoir(uuid, numeric, text) from public, anon;
grant execute on function public.valider_devis(uuid) to authenticated;
grant execute on function public.envoyer_devis(uuid) to authenticated;
grant execute on function public.regenerer_lien_devis(uuid) to authenticated;
grant execute on function public.nouvelle_version_devis(uuid) to authenticated;
grant execute on function public.refuser_devis(uuid, text) to authenticated;
grant execute on function public.signer_pv(uuid, text, text, text) to authenticated;
grant execute on function public.creer_lien_pv(uuid) to authenticated;
grant execute on function public.creer_facture_depuis_devis(uuid, public.facture_type) to authenticated;
grant execute on function public.emettre_facture(uuid) to authenticated;
grant execute on function public.normaliser_facture(uuid, text, text, text) to authenticated;
grant execute on function public.emettre_avoir(uuid, numeric, text) to authenticated;

-- Fonctions serveur uniquement (page publique de signature, Edge Function, cron)
revoke execute on function public.lien_signature_info(text) from public, anon, authenticated;
revoke execute on function public.signer_par_lien(text, text, text, inet, text) from public, anon, authenticated;
revoke execute on function public.taches_quotidiennes() from public, anon, authenticated;
revoke execute on function public.relances_a_envoyer() from public, anon, authenticated;
revoke execute on function public.enregistrer_relance(uuid, uuid, text, uuid, public.relance_niveau, text, text, text)
  from public, anon, authenticated;
grant execute on function public.lien_signature_info(text) to service_role;
grant execute on function public.signer_par_lien(text, text, text, inet, text) to service_role;
grant execute on function public.taches_quotidiennes() to service_role;
grant execute on function public.relances_a_envoyer() to service_role;
grant execute on function public.enregistrer_relance(uuid, uuid, text, uuid, public.relance_niveau, text, text, text)
  to service_role;
