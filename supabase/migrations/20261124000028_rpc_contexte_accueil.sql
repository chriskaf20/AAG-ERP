-- Performance : contexte utilisateur et données de l'accueil en un seul appel chacun
-- (security invoker : la RLS s'applique comme pour des requêtes directes).

create function public.contexte_utilisateur(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', ur.role, 'department_id', ur.department_id, 'organization_id', ur.organization_id,
        'organizations', jsonb_build_object('id', o.id, 'nom', o.nom, 'sigle', o.sigle)))
      from public.user_roles ur
      join public.organizations o on o.id = ur.organization_id
      where ur.user_id = auth.uid()), '[]'::jsonb),
    'profil', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'organisation', (select to_jsonb(o) from public.organizations o where o.id = p_org),
    'permissions', to_jsonb(public.mes_permissions(p_org)),
    'departements', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'code', d.code, 'nom', d.nom) order by d.code)
      from public.departments d where d.organization_id = p_org), '[]'::jsonb)
  );
$$;

create function public.donnees_accueil(p_org uuid)
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
    'indicateurs', case when public.has_permission(p_org, 'reports.read') then public.rapport_indicateurs(p_org) end
  );
$$;

revoke execute on function public.contexte_utilisateur(uuid) from public, anon;
revoke execute on function public.donnees_accueil(uuid) from public, anon;
grant execute on function public.contexte_utilisateur(uuid) to authenticated;
grant execute on function public.donnees_accueil(uuid) to authenticated;
