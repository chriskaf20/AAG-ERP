-- Seul un intitulé qui désigne la prestation entière suffit pour imposer le F-03.
create or replace function atlas_prive.type_site_web(p_service text)
returns text language sql immutable strict set search_path = '' as $$
  with mots as (
    select trim(regexp_replace(lower(translate(normalize(p_service, NFC),
      'àâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC') collate "C"),
      '[^a-z0-9]+', ' ', 'g')) as libelle
  ), actions(type_web, action) as (
    values ('creation', '(creation|conception|developpement|realisation)'),
           ('refonte', '(refonte|redesign)( complete| partielle| graphique| technique)?')
  ), objet(site) as (
    values ('(sites? (web|internet)( (vitrines?|marchands?|institutionnels?|e ?commerce))?|sites? (vitrines?|marchands?|institutionnels?|e ?commerce)|boutiques? en ligne)')
  )
  select type_web from mots, actions, objet
  where libelle ~ ('^' || action || ' (du |de |de la |des |d un |d une |d |un |une |le |la |mon |notre |votre )?(nouveau |nouvelle )?' || site || '$')
     or libelle ~ ('^' || site || ' ' || action || '$');
$$;

-- Le trigger protège une catégorie déjà renseignée. Le suspendre uniquement
-- pour cette reprise transactionnelle, en conservant les triggers d'audit et de statut.
do $$
begin
  lock table public.dossiers in exclusive mode;
  alter table public.dossiers disable trigger dossiers_type_site_web;

  -- La première migration n'enregistrait pas l'origine du type. Le premier
  -- instantané contenant la colonne distingue sa reprise d'une saisie ultérieure.
  -- En cas de provenance incertaine, conserver la valeur pour la revue humaine.
  with reprises_initiales as (
    select a.record_id, a.new_data ->> 'type_site_web' as type_initial,
           a.new_data ->> 'service' as service_initial
    from public.audit_log a
    where a.table_name = 'dossiers' and a.action = 'UPDATE' and a.created_by is null
      and a.changed_fields = array['type_site_web']
      and a.old_data ->> 'type_site_web' is null
      and exists (
        select 1 from public.audit_log avant where avant.table_name = 'dossiers'
          and avant.record_id = a.record_id and avant.id < a.id and avant.action = 'INSERT'
          and not (avant.new_data ? 'type_site_web')
      )
      and not exists (
        select 1 from public.audit_log autre where autre.table_name = 'dossiers'
          and autre.record_id = a.record_id
          and ((autre.id < a.id and autre.new_data ? 'type_site_web')
            or (autre.id > a.id and autre.changed_fields && array['service','type_site_web']))
      )
  )
  update public.dossiers d set type_site_web = atlas_prive.type_site_web(d.service)
  from reprises_initiales r
  where d.id = r.record_id and d.type_site_web = r.type_initial and d.service = r.service_initial
    and d.type_site_web is distinct from atlas_prive.type_site_web(d.service)
    and not exists (select 1 from public.f03_versions v where v.dossier_id = d.id);

  update public.dossiers set type_site_web = atlas_prive.type_site_web(service)
  where type_site_web is null and atlas_prive.type_site_web(service) is not null;

  alter table public.dossiers enable trigger dossiers_type_site_web;
end;
$$;

-- Les instantanés d'audit contiennent le cahier des charges et l'accord client.
create policy audit_f03_visible on public.audit_log as restrictive for select to authenticated
  using (table_name <> 'f03_versions' or exists (
    select 1 from public.f03_versions v where v.id = audit_log.record_id
  ));
