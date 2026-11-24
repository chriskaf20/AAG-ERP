-- Phase 1 — Circuit du dossier : change_dossier_status() et valider_verification()
--
-- Transitions disponibles en phase 1 :
--   nouveau           → en_verification     (pilote du dossier)
--   complement_requis → en_verification     (pilote du dossier, pièces reçues)
--   en_verification   → accepte | complement_requis | refuse
--                       (gérant, sur vérification F-02 validée par le gérant
--                        après l'entrée en vérification, décision identique)
--   nouveau | en_verification | complement_requis → classe_sans_suite
--                       (gérant, motif obligatoire)
-- Pilote du dossier = direction, responsable du département ou responsable du dossier.

create function public.change_dossier_status(
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

-- Validation (signature) de la fiche F-02 par le gérant, puis application
-- de la décision au dossier dans la même transaction.
create function public.valider_verification(p_verification_id uuid)
returns public.dossiers
language plpgsql
security definer
set search_path = ''
as $$
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
  if not public.has_role(v.organization_id, array['gerant']::public.app_role[]) then
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
$$;

revoke execute on function public.change_dossier_status(uuid, public.dossier_statut, text) from public, anon;
revoke execute on function public.valider_verification(uuid) from public, anon;
revoke execute on function public.verification_erreurs(public.verifications) from public, anon;
grant execute on function public.change_dossier_status(uuid, public.dossier_statut, text) to authenticated;
grant execute on function public.valider_verification(uuid) to authenticated;
grant execute on function public.verification_erreurs(public.verifications) to authenticated;
