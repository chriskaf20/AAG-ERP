-- psql sur une base locale fictive avec les seeds, juste avant la migration
-- 20261128063939. Les deux migrations et toutes les données de cet essai
-- sont exécutées dans la transaction de test.
\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

create function pg_temp.dossier_fictif(p_service text, p_statut public.dossier_statut)
returns uuid language sql as $$
  insert into public.dossiers (organization_id,client_id,department_id,responsable_id,canal,service,besoin,statut)
  select organization_id,client_id,department_id,responsable_id,canal,p_service,'Essai de reprise',p_statut
  from public.dossiers where id='f0000000-0000-4000-8000-000000000001' returning id;
$$;
select pg_temp.dossier_fictif('Site web','en_cours') as generique,
       pg_temp.dossier_fictif('Audit préalable à la refonte du site web','en_lancement') as audit_site,
       pg_temp.dossier_fictif('CRÉATION D’UN SITE INTERNET','en_cours') as creation,
       pg_temp.dossier_fictif('Site web','en_lancement') as avec_version,
       pg_temp.dossier_fictif('Site web','nouveau') as modifie \gset

\ir ../../supabase/migrations/20261128063939_f03_structure.sql
select is((select type_site_web from public.dossiers where id=:'generique'),'creation','10ada08 classe le libellé générique');
select is((select type_site_web from public.dossiers where id=:'audit_site'),'refonte','10ada08 classe l’audit en refonte');
insert into public.f03_versions(organization_id,dossier_id,version,contenu)
select organization_id,id,1,'{}' from public.dossiers where id=:'avec_version';
update public.dossiers set type_site_web='refonte' where id=:'modifie';

-- Saisie explicite depuis F-01 après la première migration, identique à
-- l'ancienne déduction. La nouvelle migration doit respecter cette saisie.
insert into public.dossiers (organization_id,client_id,department_id,canal,service,type_site_web,besoin)
select organization_id,client_id,department_id,canal,'Site web','creation','Choix explicite'
from public.dossiers where id=:'generique' returning id as explicite \gset

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.f03_versions where dossier_id=:'avec_version'),0::bigint,
  '10ada08 réserve la fiche à ses lecteurs');
select ok(exists (select from public.audit_log where table_name='f03_versions'
  and new_data ->> 'dossier_id'=:'avec_version'), '10ada08 expose néanmoins le contenu à l’admin système via le journal');
reset role;
set local request.jwt.claims = '{}';

\ir ../../supabase/migrations/20261128070519_f03_revue_libelles.sql
select is((select type_site_web from public.dossiers where id=:'generique'),null::text,'libellé générique rendu au classement humain');
select is((select type_site_web from public.dossiers where id=:'audit_site'),null::text,'l’audit ancien sort des refontes déduites');
select is((select type_site_web from public.dossiers where id=:'creation'),'creation','création explicite dans le libellé reprise');
select is((select count(*) from public.dossiers where id in (:'generique',:'creation') and statut='en_cours'),2::bigint,
  'les deux dossiers déjà en cours gardent leur statut');
select is((select type_site_web from public.dossiers where id=:'explicite'),'creation','saisie F-01 conservée');
select is((select type_site_web from public.dossiers where id=:'modifie'),'refonte','requalification postérieure conservée');
select is((select type_site_web from public.dossiers where id=:'avec_version'),'creation','le F-03 engagé reste accessible');
select is((select count(*) from public.f03_versions where dossier_id=:'avec_version'),1::bigint,'historique structuré conservé');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.audit_log where table_name='f03_versions'
  and new_data ->> 'dossier_id'=:'avec_version'),0::bigint,'le correctif protège aussi les instantanés historiques');
select * from finish();
rollback;
