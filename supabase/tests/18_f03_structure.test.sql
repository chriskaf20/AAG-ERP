-- F-03 structuré et verrou de démarrage. Données isolées, avec seed.sql + seed_permissions.sql.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(164);

create function pg_temp.en(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.org() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;
create function pg_temp.web() returns uuid language sql as $$ select 'f0300000-0000-4000-8000-000000000001'::uuid $$;
create function pg_temp.refonte() returns uuid language sql as $$ select 'f0300000-0000-4000-8000-000000000002'::uuid $$;
create function pg_temp.autre() returns uuid language sql as $$ select 'f0300000-0000-4000-8000-000000000003'::uuid $$;
create function pg_temp.contenu() returns jsonb language sql as $$
  select '{"objectif":"Catalogue en ligne","public_vise":"Prospects et demandes de contact","langues":"Français",
          "pages":"Accueil, catalogue, contact","exclusions":"Vente en ligne","fonctionnalites":"Formulaire",
          "domaine":"exemple.test","hebergement":"Équipe Digital","date_mise_en_ligne":"2026-12-30",
          "remise_acces":"Responsable du dossier","contenus":"Textes remis par courriel","criteres_reception":"Formulaire testé",
          "formation":"Une prise en main","interlocuteur_client":"Client Test"}'::jsonb;
$$;

-- Un Digital de la bonne organisation et un Digital hors organisation.
insert into public.user_roles (organization_id, user_id, role, department_id)
values (pg_temp.org(), '10000000-0000-4000-8000-000000000010', 'responsable_departement',
        'd0000000-0000-4000-8000-00000000000d');
insert into public.organizations(id, nom, sigle, prefixe_dossier)
values ('a0300000-0000-4000-8000-000000000002', 'Organisation témoin', 'TEM', 'TEM');
insert into public.departments(id, organization_id, code, nom)
values ('d0300000-0000-4000-8000-000000000002', 'a0300000-0000-4000-8000-000000000002', 'DIG', 'Digital témoin');
insert into public.user_roles (organization_id, user_id, role, department_id)
values ('a0300000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009',
        'responsable_departement', 'd0300000-0000-4000-8000-000000000002');

insert into public.dossiers (id, organization_id, canal, client_id, service, type_site_web, besoin, department_id, responsable_id, statut)
select x.id, pg_temp.org(), 'email', 'c0000000-0000-4000-8000-000000000001', x.service, x.type_web,
       'Demande de test', 'd0000000-0000-4000-8000-00000000000a',
       '10000000-0000-4000-8000-000000000008', 'en_lancement'
from (values
  (pg_temp.web(), 'Création de site web', null::text),
  (pg_temp.refonte(), 'Refonte du site Internet', null::text),
  (pg_temp.autre(), 'Maintenance de site web', null::text),
  ('f0300000-0000-4000-8000-000000000004'::uuid, 'Projet Extranet', 'refonte')
) x(id, service, type_web);

insert into public.missions(id, organization_id, dossier_id, type, titre, debut)
select d.id, pg_temp.org(), d.id, 'interne', 'Mission de test', now()
from public.dossiers d where d.id in (pg_temp.web(),pg_temp.refonte(),pg_temp.autre());
insert into public.mission_agents(organization_id,mission_id,user_id)
select pg_temp.org(), m.id, '10000000-0000-4000-8000-000000000008'
from public.missions m where m.id in (pg_temp.web(),pg_temp.refonte(),pg_temp.autre());

insert into public.documents(id,organization_id,dossier_id,type,libelle,bucket,chemin,nom_fichier)
values ('d0300000-0000-4000-8000-000000000003',pg_temp.org(),pg_temp.web(),'f03_cahier_charges','F-03 historique',
  'dossiers','test/ancien-v1.pdf','ancien-v1.pdf');
insert into public.documents(organization_id,dossier_id,type,libelle,bucket,chemin,nom_fichier,version_precedente_id)
values (pg_temp.org(),pg_temp.web(),'f03_cahier_charges','F-03 historique',
  'dossiers','test/ancien-v2.pdf','ancien-v2.pdf','d0300000-0000-4000-8000-000000000003');

select is((select type_site_web from public.dossiers where id=pg_temp.web()), 'creation', 'création reconnue');
select is((select type_site_web from public.dossiers where id=pg_temp.refonte()), 'refonte', 'refonte reconnue');
select is((select type_site_web from public.dossiers where id=pg_temp.autre()), null::text, 'la maintenance reste hors F-03');
select is((select type_site_web from public.dossiers where id='f0300000-0000-4000-8000-000000000004'), 'refonte', 'catégorie F-01 explicite conservée');
select ok(not has_table_privilege('anon','public.f03_versions','select'), 'versions inaccessibles sans session');
select ok(not has_function_privilege('anon','public.dossiers_f03(uuid,uuid)','execute'), 'liste inaccessible sans session');
insert into public.dossier_affectations (organization_id,dossier_id,user_id)
values (pg_temp.org(),pg_temp.web(),'10000000-0000-4000-8000-000000000011');

select is(atlas_prive.type_site_web(libelle), attendu, 'Classement du service « ' || libelle || ' »')
from (values
  ('CRÉATION D’UN SITE INTERNET', 'creation'),
  (normalize('Création de site web', NFD), 'creation'),
  ('Site vitrine – refonte', 'refonte'),
  ('Réalisation de sites marchands', 'creation'),
  ('Site Web / création', 'creation'),
  ('Refonte de la boutique en ligne', 'refonte'),
  ('Refonte complète du site institutionnel', 'refonte'),
  ('Conception d’un nouveau site vitrine', 'creation'),
  ('Site web', null), ('Site marchand', null), ('Refonte web', null),
  ('Audit préalable à la refonte du site web', null),
  ('Création de contenu pour un site internet', null),
  ('Création de site web annulée', null), ('Création ou refonte du site internet', null),
  ('Maintenance de site web', null), ('Installation sur site', null),
  ('Informatique', null), ('Étude', null)
) exemples(libelle, attendu);

set local role authenticated;
select pg_temp.en('10000000-0000-4000-8000-000000000008');

select throws_ok($$select public.change_dossier_status(pg_temp.web(), 'en_cours')$$,'23514',null,'pas de démarrage sans F-03');
select throws_ok($$select public.change_dossier_status(pg_temp.refonte(), 'en_cours')$$,'23514',null,'même verrou pour une refonte');
select lives_ok($$select public.change_dossier_status(pg_temp.autre(), 'en_cours')$$,'une maintenance suit son parcours habituel');
select lives_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),1,'{}',false)$$,'le responsable crée un brouillon partiel');
select throws_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),1,'{}',true,
  (select updated_at from public.f03_versions where dossier_id=pg_temp.web() and version=1))$$,'23514',null,'le brouillon incomplet ne part pas en validation');

select pg_temp.en('10000000-0000-4000-8000-000000000010');
select throws_ok($$select public.decider_f03(pg_temp.org(),pg_temp.web(),1,true)$$,'23514',null,'Digital ne valide pas un brouillon');
select throws_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),1,pg_temp.contenu(),true)$$,
  '42501',null,'Digital ne rédige pas à la place du responsable');
select is((select count(*) from public.dossiers_f03(pg_temp.org(),pg_temp.web())),1::bigint,'Digital voit le F-03 du dossier AFF');

select pg_temp.en('10000000-0000-4000-8000-000000000008');
select lives_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),1,pg_temp.contenu(),true,
  (select updated_at from public.f03_versions where dossier_id=pg_temp.web() and version=1))$$,'le responsable soumet la v1 complète');
select throws_ok($$select public.decider_f03(pg_temp.org(),pg_temp.web(),1,true)$$,'42501',null,'le responsable ne valide pas comme Digital');
select throws_ok($$update public.f03_versions set etat='valide' where dossier_id=pg_temp.web()$$,'42501',null,'écriture directe du statut refusée');

select pg_temp.en('10000000-0000-4000-8000-000000000007');
select throws_ok($$select public.decider_f03(pg_temp.org(),pg_temp.web(),1,true)$$,'42501',null,'responsable de département AFF refusé');
select pg_temp.en('10000000-0000-4000-8000-000000000009');
select throws_ok($$select public.decider_f03(pg_temp.org(),pg_temp.web(),1,true)$$,'42501',null,'Digital d’une autre organisation refusé');
select is((select count(*) from public.f03_versions where dossier_id=pg_temp.web()),0::bigint,'les versions restent isolées entre organisations');

select pg_temp.en('10000000-0000-4000-8000-000000000010');
select lives_ok($$select public.decider_f03(pg_temp.org(),pg_temp.web(),1,true)$$,'le responsable Digital valide la v1');
select throws_ok($$select public.consigner_accord_f03(pg_temp.org(),pg_temp.web(),1,current_date,'Courriel')$$,
  '42501',null,'Digital ne consigne pas l’accord à la place du responsable');

select pg_temp.en('10000000-0000-4000-8000-000000000008');
select throws_ok($$select public.change_dossier_status(pg_temp.web(),'en_cours')$$,'23514',null,'la validation Digital seule ne suffit pas');
select lives_ok($$select public.consigner_accord_f03(pg_temp.org(),pg_temp.web(),1,current_date,'Courriel d’accord v1')$$,'le responsable consigne l’accord v1');
select throws_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),1,'{}',false,
  (select updated_at from public.f03_versions where dossier_id=pg_temp.web() and version=1))$$,
  '23514',null,'le contenu validé est figé');
select lives_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),2,pg_temp.contenu(),false)$$,'une nouvelle version devient courante dès le brouillon');
select throws_ok($$select public.change_dossier_status(pg_temp.web(),'en_cours')$$,'23514',null,'les deux validations v1 ne couvrent pas la v2');
select is((select accord_reference from public.f03_versions where dossier_id=pg_temp.web() and version=1),
  'Courriel d’accord v1','l’accord v1 reste dans son historique');
select throws_ok($$select public.consigner_accord_f03(pg_temp.org(),pg_temp.web(),1,current_date,'Ancienne version')$$,
  '23514',null,'accord sur une version dépassée refusé');
select lives_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),2,pg_temp.contenu(),true,
  (select updated_at from public.f03_versions where dossier_id=pg_temp.web() and version=2))$$,'soumission distincte de la v2');
select lives_ok($$select public.consigner_accord_f03(pg_temp.org(),pg_temp.web(),2,current_date,'Courriel d’accord v2')$$,'l’accord est associé à la v2');
select throws_ok($$select public.change_dossier_status(pg_temp.web(),'en_cours')$$,'23514',null,'l’accord v2 seul ne suffit pas');

select pg_temp.en('10000000-0000-4000-8000-000000000010');
select lives_ok($$select public.decider_f03(pg_temp.org(),pg_temp.web(),2,true)$$,'Digital doit valider à nouveau la v2');
select pg_temp.en('10000000-0000-4000-8000-000000000008');
select lives_ok($$select public.change_dossier_status(pg_temp.web(),'en_cours')$$,'les deux validations v2 autorisent le démarrage');
select results_eq($$select version from public.documents where dossier_id=pg_temp.web() and type='f03_cahier_charges' order by version$$,
  $$values (1),(2)$$,'les deux versions de la pièce F-03 historique sont conservées');

select lives_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.refonte(),1,pg_temp.contenu(),true)$$,
  'le responsable soumet aussi le F-03 de refonte');
select pg_temp.en('10000000-0000-4000-8000-000000000010');
select throws_ok($$select public.decider_f03(pg_temp.org(),pg_temp.refonte(),1,false)$$,'23514',null,
  'une demande de corrections doit être motivée');
select lives_ok($$select public.decider_f03(pg_temp.org(),pg_temp.refonte(),1,false,'Préciser le périmètre repris')$$,
  'Digital peut renvoyer le F-03 pour corrections');
select pg_temp.en('10000000-0000-4000-8000-000000000008');
select throws_ok($$select public.change_dossier_status(pg_temp.refonte(),'en_cours')$$,'23514',null,
  'les corrections demandées maintiennent le blocage');
select lives_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.refonte(),2,pg_temp.contenu(),true)$$,
  'le responsable soumet une version corrigée de la refonte');
select is((select motif from public.f03_versions where dossier_id=pg_temp.refonte() and version=1),
  'Préciser le périmètre repris','le motif reste lié à la version renvoyée');
select pg_temp.en('10000000-0000-4000-8000-000000000010');
select lives_ok($$select public.decider_f03(pg_temp.org(),pg_temp.refonte(),2,true)$$,
  'Digital valide la version corrigée de la refonte');
select pg_temp.en('10000000-0000-4000-8000-000000000008');
select lives_ok($$select public.consigner_accord_f03(pg_temp.org(),pg_temp.refonte(),2,current_date,'Courriel de refonte')$$,
  'l’accord client est consigné sur la version de refonte corrigée');
select lives_ok($$select public.change_dossier_status(pg_temp.refonte(),'en_cours')$$,
  'une refonte passe en cours avec ses deux validations courantes');

-- Une révision pendant l'exécution ne rétrograde pas le dossier. Un retour
-- en cours par le refus de réception reste une nouvelle transition.
select lives_ok($$select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),3,pg_temp.contenu(),false)$$,
  'révision v3 ouverte pendant l’exécution');
select is((select statut::text from public.dossiers where id=pg_temp.web()),'en_cours','le dossier reste en cours');
insert into public.rapports_intervention (id, organization_id, mission_id, dossier_id, travaux)
values (pg_temp.web(),pg_temp.org(),pg_temp.web(),pg_temp.web(),'Rapport du projet web');
select public.valider_rapport(pg_temp.web());
select lives_ok($$select public.change_dossier_status(pg_temp.web(),'livre')$$,'la révision ne suspend pas la livraison en cours');
insert into public.pv_reception (id, organization_id, dossier_id, type)
values (pg_temp.web(),pg_temp.org(),pg_temp.web(),'F05');
select throws_ok($$select public.refuser_reception(pg_temp.web(),'Correction demandée')$$,'23514',
  'Passage en cours impossible : validez la version courante du F-03 avec Digital et consignez l’accord client',
  'le retour via le PV exige les deux approbations de la v3');
select is((select statut::text from public.dossiers where id=pg_temp.web()),'livre','le refus bloqué conserve le statut livré');
select ok((select refuse_le is null from public.pv_reception where id=pg_temp.web()),'le refus bloqué laisse le PV ouvert');
select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),3,pg_temp.contenu(),true,
  (select updated_at from public.f03_versions where dossier_id=pg_temp.web() and version=3));
select public.consigner_accord_f03(pg_temp.org(),pg_temp.web(),3,current_date,'Courriel v3');
select pg_temp.en('10000000-0000-4000-8000-000000000010');
select public.decider_f03(pg_temp.org(),pg_temp.web(),3,true);
select pg_temp.en('10000000-0000-4000-8000-000000000008');
select lives_ok($$select public.refuser_reception(pg_temp.web(),'Correction demandée')$$,
  'le même refus aboutit après les deux approbations v3');
select is((select statut::text from public.dossiers where id=pg_temp.web()),'en_cours','le retour effectif est en cours');

-- Droits par défaut sur un dossier AFF. Les contrôles exécutent les RPC et
-- les lectures sous le rôle authenticated de chaque utilisateur fictif.
create function pg_temp.verifier_role(n int, nom text, lecture boolean, redaction boolean, digital boolean, audit boolean)
returns setof text language plpgsql as $$
begin
  perform pg_temp.en('10000000-0000-4000-8000-' || lpad(n::text,12,'0'));
  return next is(exists (select from public.dossiers_f03(pg_temp.org(),pg_temp.web())),lecture,nom || ' · liste');
  return next is(exists (select from public.f03_versions where dossier_id=pg_temp.web()),lecture,nom || ' · versions');
  return next is(exists (select from public.audit_log where table_name='f03_versions'
    and new_data ->> 'dossier_id'=pg_temp.web()::text),audit,nom || ' · contenu du journal');
  if not redaction then
    return next throws_ok('select public.enregistrer_f03(pg_temp.org(),pg_temp.web(),4,''{}'',false)',
      '42501',null,nom || ' · rédaction refusée');
    return next throws_ok('select public.consigner_accord_f03(pg_temp.org(),pg_temp.web(),3,current_date,''Accord'')',
      '42501',null,nom || ' · consignation refusée');
  end if;
  if not digital then
    return next throws_ok('select public.decider_f03(pg_temp.org(),pg_temp.web(),3,true)',
      '42501',null,nom || ' · décision Digital refusée');
  end if;
end;
$$;
select r.* from (values
  (1,'Admin système',false,false,false,false), (2,'Gérant',true,false,false,true),
  (3,'Associé',false,false,false,false), (4,'Directeur commercial',true,false,false,false),
  (5,'Directeur des opérations',true,false,false,false), (6,'DAF',true,false,false,true),
  (7,'Responsable du département du dossier',true,false,false,false),
  (8,'Responsable désigné du dossier',true,true,false,false),
  (9,'Acheteur hors département et Digital dans une autre organisation',false,false,false,false),
  (10,'Responsable Digital',true,false,true,false), (11,'Agent terrain affecté au dossier',false,false,false,false),
  (12,'Client portail',false,false,false,false), (13,'Responsable dossier non désigné',false,false,false,false)
) t(n,nom,lecture,redaction,digital,audit)
cross join lateral pg_temp.verifier_role(t.n,t.nom,t.lecture,t.redaction,t.digital,t.audit) r;

reset role;
delete from public.user_roles where user_id='10000000-0000-4000-8000-000000000010'
  and organization_id=pg_temp.org() and role='responsable_departement';
set local role authenticated;
select * from pg_temp.verifier_role(10,'RH hors département',false,false,false,false);
reset role;
update public.user_roles set department_id='d0000000-0000-4000-8000-00000000000a'
  where organization_id=pg_temp.org() and role in ('acheteur','responsable_rh')
    and user_id in ('10000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000010');
set local role authenticated;
select * from pg_temp.verifier_role(9,'Acheteur du département du dossier',true,false,false,false);
select * from pg_temp.verifier_role(10,'RH du département du dossier',true,false,false,false);

select * from finish();
rollback;
