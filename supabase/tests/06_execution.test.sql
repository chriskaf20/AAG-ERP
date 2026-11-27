-- Tests Phase 3 — exécution : missions terrain / interne, rapports, livrables, incidents,
-- points d'avancement, transitions en_cours et livre (nécessite seed.sql + seed_permissions.sql)
-- Dossier 001 (AFF, responsable …08) ; agent …11 ; acheteur SUP …09 ; DAF …06 ; gérant …02 ; admin …01
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

create function pg_temp.en(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;

-- État de départ : dossier 001 en lancement, client avec une adresse réelle
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'en_lancement', statut_change_le = clock_timestamp()
 where id = 'f0000000-0000-4000-8000-000000000001';
select set_config('atlas.changement_statut', 'off', true);
update public.clients set email = 'contact@client-exemple.com' where id = 'c0000000-0000-4000-8000-000000000001';
update public.contacts set email = 'projet@client-exemple.com' where id = (
  select contact_id from public.dossiers where id = 'f0000000-0000-4000-8000-000000000001'
);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Missions et affectations
-- ---------------------------------------------------------------------------
select pg_temp.en('10000000-0000-4000-8000-000000000008');
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'en_cours')$$,
                 '23514', null, 'en_cours impossible sans mission planifiée');

select pg_temp.en('10000000-0000-4000-8000-000000000009');
select throws_ok($$insert into public.missions (organization_id, dossier_id, type, titre, debut)
                   values ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
                           'terrain', 'Intrus', now())$$,
                 '42501', null, 'execution.write : un acheteur d''un autre département ne planifie pas');

select pg_temp.en('10000000-0000-4000-8000-000000000008');
insert into public.missions (id, organization_id, dossier_id, type, titre, lieu, debut) values
  ('ab000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'terrain', 'Nettoyage du site', 'Lubumbashi', now()),
  ('ab000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'interne', 'Étude préalable', null, now());

select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'en_cours')$$,
                 '23514', null, 'en_cours impossible sans personne affectée');

select throws_ok($$insert into public.mission_agents (organization_id, mission_id, user_id)
                   values ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001',
                           '10000000-0000-4000-8000-000000000009')$$,
                 '23514', null, 'mission terrain : seul un agent de terrain peut être affecté');
select throws_ok($$insert into public.mission_agents (organization_id, mission_id, user_id)
                   values ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002',
                           '10000000-0000-4000-8000-000000000012')$$,
                 '23514', null, 'mission interne : un compte client ne peut pas être affecté');
select lives_ok($$insert into public.mission_agents (organization_id, mission_id, user_id)
                  values ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002',
                          '10000000-0000-4000-8000-000000000009')$$,
                'mission interne : membre interne (acheteur) affecté');

select lives_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'en_cours')$$,
                'en_lancement → en_cours : la mission interne affectée suffit');
select lives_ok($$insert into public.mission_agents (organization_id, mission_id, user_id)
                  values ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001',
                          '10000000-0000-4000-8000-000000000011')$$,
                'mission terrain : agent de terrain affecté');
select lives_ok($$insert into public.mission_agents (organization_id, mission_id, user_id)
                  values ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002',
                          '10000000-0000-4000-8000-000000000001')$$,
                'mission interne : un administrateur interne peut être affecté');
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'livre')$$,
                 '23514', null, 'livre impossible : missions non terminées');

-- ---------------------------------------------------------------------------
-- Points d'avancement
-- ---------------------------------------------------------------------------
select is(public.enregistrer_point_avancement('f0000000-0000-4000-8000-000000000001',
            'Point hebdomadaire : préparation du site terminée.') ->> 'email_statut',
          'consigne', 'point d''avancement : consigné sans e-mail quand l''envoi est désactivé');

select pg_temp.en('10000000-0000-4000-8000-000000000001');
select throws_ok($$update public.organizations
                      set parametres = parametres || '{"points_avancement_email_actifs": true}'::jsonb
                    where id = 'a0000000-0000-4000-8000-000000000001'$$,
                 '42501', null, 'e-mail des points d''avancement : interrupteur réservé au gérant');
select pg_temp.en('10000000-0000-4000-8000-000000000002');
update public.organizations set parametres = parametres || '{"points_avancement_email_actifs": true}'::jsonb
 where id = 'a0000000-0000-4000-8000-000000000001';

select pg_temp.en('10000000-0000-4000-8000-000000000008');
select is(public.enregistrer_point_avancement('f0000000-0000-4000-8000-000000000001',
            'Point hebdomadaire : intervention planifiée cette semaine.') ->> 'email_statut',
          'simule', 'point d''avancement : envoi simulé (mode simulation)');
reset role;
update public.clients set email = 'contact@client.test' where id = 'c0000000-0000-4000-8000-000000000001';
update public.contacts set email = 'projet@client.test' where id = (
  select contact_id from public.dossiers where id = 'f0000000-0000-4000-8000-000000000001'
);
select throws_ok($$update public.points_avancement set texte = 'Texte réécrit après coup'
                    where dossier_id = 'f0000000-0000-4000-8000-000000000001'$$,
                 '42501', null, 'point d''avancement : définitif');
set local role authenticated;
select pg_temp.en('10000000-0000-4000-8000-000000000008');
select is(public.enregistrer_point_avancement('f0000000-0000-4000-8000-000000000001',
            'Point hebdomadaire : adresse de test, aucun envoi.') ->> 'email_statut',
          'ignore', 'point d''avancement : adresse en .test ignorée');

select pg_temp.en('10000000-0000-4000-8000-000000000011');
select throws_ok($$select public.enregistrer_point_avancement('f0000000-0000-4000-8000-000000000001',
                     'Un agent ne rédige pas le point client.')$$,
                 '42501', null, 'point d''avancement : réservé au pilote de l''exécution');

-- ---------------------------------------------------------------------------
-- Mission terrain : rapport de l'agent, signature du client
-- ---------------------------------------------------------------------------
select results_eq($$select titre from public.missions order by titre$$,
                  $$values ('Nettoyage du site'::text)$$,
                  'agent : ne voit que la mission à laquelle il est affecté');
select throws_ok($$insert into public.rapports_intervention (organization_id, mission_id, dossier_id, travaux)
                   values ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002',
                           'f0000000-0000-4000-8000-000000000001', 'Rapport sur une mission d''un autre')$$,
                 '42501', null, 'agent : pas de rapport sur une mission où il n''est pas affecté');
insert into public.rapports_intervention (id, organization_id, mission_id, dossier_id, travaux, latitude, longitude)
values ('ac000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'ab000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
        'Nettoyage complet des locaux', -11.664200, 27.479400);
select is((select statut::text from public.missions where id = 'ab000000-0000-4000-8000-000000000001'),
          'en_cours', 'rapport commencé → mission en cours');
select throws_ok($$select public.valider_rapport('ac000000-0000-4000-8000-000000000001')$$,
                 '42501', null, 'mission terrain : l''agent ne valide pas son rapport');
select ok(public.storage_terrain_acces(
  'a0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000001/ac000000-0000-4000-8000-000000000001/photo.jpg', true),
  'photo : l’agent peut déposer dans le chemin privé du rapport brouillon');
select ok(not public.storage_terrain_acces(
  'a0000000-0000-4000-8000-000000000002/f0000000-0000-4000-8000-000000000001/ac000000-0000-4000-8000-000000000001/photo.jpg', true),
  'photo : chemin d’une autre organisation refusé');
select lives_ok($$select public.signer_rapport('ac000000-0000-4000-8000-000000000001', 'Client Test',
                  'data:image/png;base64,iVBORw0KGgo=')$$, 'mission terrain : rapport signé par le client');
select is((select statut::text from public.missions where id = 'ab000000-0000-4000-8000-000000000001'),
          'terminee', 'rapport signé → mission terminée');
select throws_ok($$update public.rapports_intervention set travaux = 'Modifié après signature'
                    where id = 'ac000000-0000-4000-8000-000000000001'$$,
                 '42501', null, 'rapport signé : non modifiable');
select throws_ok($$insert into public.rapport_photos (organization_id, rapport_id, chemin)
                   values ('a0000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001', 'x/y/z/p.jpg')$$,
                 '42501', null, 'rapport signé : photos non modifiables');

select ok(not public.storage_terrain_acces(
  'a0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000001/ac000000-0000-4000-8000-000000000001/photo.jpg', true),
  'photo : aucun dépôt après signature');

-- Incident de gravité élevée signalé par l'agent
select lives_ok($$insert into public.incidents (organization_id, dossier_id, mission_id, description, gravite)
                  values ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
                          'ab000000-0000-4000-8000-000000000001', 'Dégât des eaux constaté', 'elevee')$$,
                'incident : signalé par une personne affectée à une mission du dossier');

-- ---------------------------------------------------------------------------
-- Mission interne : rapport d'un membre interne, validation par le responsable du dossier
-- ---------------------------------------------------------------------------
select pg_temp.en('10000000-0000-4000-8000-000000000008');
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'livre')$$,
                 '23514', 'Livraison impossible : chaque mission interne exige un rapport validé par le responsable du dossier',
                 'livre impossible : mission interne sans rapport validé');

select pg_temp.en('10000000-0000-4000-8000-000000000009');
insert into public.rapports_intervention (id, organization_id, mission_id, dossier_id, travaux)
values ('ac000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
        'ab000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'Étude rédigée et relue');
select throws_ok($$select public.signer_rapport('ac000000-0000-4000-8000-000000000002', 'Client Test',
                   'data:image/png;base64,iVBORw0KGgo=')$$,
                 '23514', null, 'mission interne : pas de signature client');
select throws_ok($$select public.valider_rapport('ac000000-0000-4000-8000-000000000002')$$,
                 '42501', null, 'mission interne : le rédacteur ne valide pas lui-même');

select pg_temp.en('10000000-0000-4000-8000-000000000008');
select pg_temp.en('10000000-0000-4000-8000-000000000002');
select throws_ok($$select public.valider_rapport('ac000000-0000-4000-8000-000000000002')$$,
                 '42501', null, 'mission interne : validation par le responsable désigné');
select pg_temp.en('10000000-0000-4000-8000-000000000008');
select lives_ok($$select public.valider_rapport('ac000000-0000-4000-8000-000000000002')$$,
                'mission interne : rapport validé par le responsable du dossier');
select is((select statut::text from public.missions where id = 'ab000000-0000-4000-8000-000000000002'),
          'terminee', 'rapport validé → mission terminée');

-- ---------------------------------------------------------------------------
-- Livrables, incident élevé, passage en livré
-- ---------------------------------------------------------------------------
insert into public.livrables (id, organization_id, dossier_id, libelle)
values ('ad000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'Rapport d''étude');
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'livre')$$,
                 '23514', 'Livraison impossible : des livrables ne sont pas remis',
                 'livre impossible : livrable non remis');
update public.livrables set remis_le = now() where id = 'ad000000-0000-4000-8000-000000000001';

select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'livre')$$,
                 '23514', 'Livraison impossible : un incident de gravité élevée est encore ouvert',
                 'livre impossible : incident de gravité élevée ouvert');
select throws_ok($$update public.incidents set responsable_id = '10000000-0000-4000-8000-000000000012'
                    where dossier_id = 'f0000000-0000-4000-8000-000000000001'$$,
                 '23514', null, 'incident : un compte client ne peut pas devenir responsable');
select lives_ok($$update public.incidents set statut = 'en_traitement', responsable_id = '10000000-0000-4000-8000-000000000011'
                    where dossier_id = 'f0000000-0000-4000-8000-000000000001'$$, 'le pilote peut affecter et suivre un incident');
select throws_ok($$update public.incidents set statut = 'clos'
                    where dossier_id = 'f0000000-0000-4000-8000-000000000001'$$,
                 '23514', null, 'incident : action corrective obligatoire pour clôturer');
update public.incidents set statut = 'clos', action_corrective = 'Fuite réparée et zone séchée'
 where dossier_id = 'f0000000-0000-4000-8000-000000000001';

select lives_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'livre')$$,
                'en_cours → livre : rapports terrain signés, internes validés, livrables remis, incidents clos');

select throws_ok($$insert into public.missions (organization_id, dossier_id, type, titre, debut)
                   values ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
                           'terrain', 'Après livraison', now())$$,
                 '23514', null, 'dossier livré : plus de nouvelle mission');
select pg_temp.en('10000000-0000-4000-8000-000000000011');
select throws_ok($$select public.nouvelle_version_rapport('ac000000-0000-4000-8000-000000000001')$$,
                 '23514', null, 'dossier livré : même l’agent affecté ne peut pas reprendre le rapport');

-- ---------------------------------------------------------------------------
-- Lecture
-- ---------------------------------------------------------------------------
select pg_temp.en('10000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.missions where dossier_id = 'f0000000-0000-4000-8000-000000000001'),
          0, 'DAF non affecté : le droit de lire les dossiers ne donne pas accès aux missions');
select pg_temp.en('10000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.missions) + (select count(*)::int from public.points_avancement), 0,
          'associé : aucune mission ni point d''avancement visible');

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.clients set email = 'contact@client-exemple.com' where id = 'c0000000-0000-4000-8000-000000000001';
update public.contacts set email = 'projet@client-exemple.com' where id = (
  select contact_id from public.dossiers where id = 'f0000000-0000-4000-8000-000000000001'
);
update public.organizations set parametres = parametres || '{"points_avancement_email_mode":"reel"}'::jsonb
 where id = 'a0000000-0000-4000-8000-000000000001';
create temp table _point_reel (id uuid);
grant all on _point_reel to authenticated, service_role;
set local role authenticated;
select pg_temp.en('10000000-0000-4000-8000-000000000008');
insert into _point_reel
select (public.enregistrer_point_avancement('f0000000-0000-4000-8000-000000000001', 'Envoi à tracer') ->> 'id')::uuid;
select is((select email_statut from public.points_avancement where id = (select id from _point_reel)),
          'en_attente', 'mode réel : point en attente du retour du serveur');
select throws_ok($$select public.confirmer_envoi_point((select id from _point_reel), true)$$,
                 '42501', null, 'l’utilisateur ne peut pas confirmer lui-même un envoi');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$select public.confirmer_envoi_point((select id from _point_reel), true)$$,
                'le serveur peut confirmer l’envoi Resend');
reset role;
select * from finish();
rollback;
