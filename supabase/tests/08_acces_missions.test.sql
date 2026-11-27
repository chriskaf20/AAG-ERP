-- Périmètre de lecture, rédaction affectée, validation et isolation des organisations.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(35);

create function pg_temp.en(p_num int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', '10000000-0000-4000-8000-' || lpad(p_num::text, 12, '0'), 'role', 'authenticated'
  )::text, true);
$$;

-- Même département que l'acheteur …09. Le responsable désigné est …08.
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'en_cours',
  department_id = 'd0000000-0000-4000-8000-00000000000b',
  responsable_id = '10000000-0000-4000-8000-000000000008'
where id = 'f0000000-0000-4000-8000-000000000001';
select set_config('atlas.changement_statut', 'off', true);

insert into public.organizations(id, nom)
values ('a0000000-0000-4000-8000-000000000002', 'Entreprise fictive distincte');
delete from public.user_roles where user_id = '10000000-0000-4000-8000-000000000012';
insert into public.user_roles(organization_id, user_id, role)
values ('a0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000012', 'gerant');

insert into public.missions(id, organization_id, dossier_id, type, titre, debut)
select id, 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', type, titre, now()
from (values
  ('ab000000-0000-4000-8000-000000000031'::uuid, 'terrain'::public.mission_type, 'Intervention confidentielle'),
  ('ab000000-0000-4000-8000-000000000032', 'interne', 'Étude affectée à l’acheteur'),
  ('ab000000-0000-4000-8000-000000000033', 'interne', 'Brouillon à créer')
) as m(id, type, titre);
insert into public.mission_agents(organization_id, mission_id, user_id) values
  ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000011'),
  ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000009'),
  ('a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000009');

set local role authenticated;
select pg_temp.en(11);
select lives_ok($$insert into public.rapports_intervention(id, organization_id, dossier_id, mission_id, travaux)
values ('ac000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000031', 'Rapport terrain confidentiel')$$,
  'agent affecté : crée le brouillon');
select results_eq($$update public.rapports_intervention set observations = 'Relevé terrain'
where id = 'ac000000-0000-4000-8000-000000000031' returning observations$$, $$values ('Relevé terrain'::text)$$,
  'agent affecté : modifie le brouillon');
insert into public.rapport_photos(organization_id, rapport_id, chemin) values
  ('a0000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000031',
   'a0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000001/ac000000-0000-4000-8000-000000000031/photo.jpg');

select pg_temp.en(9);
select ok(public.dossier_perm('f0000000-0000-4000-8000-000000000001'), 'acheteur : le dossier de son département reste lisible');
select is(public.mission_detail('ab000000-0000-4000-8000-000000000031'), null::jsonb,
  'acheteur du même département : fiche de la mission sans affectation masquée');
select is((select count(*) from public.missions where id = 'ab000000-0000-4000-8000-000000000031'), 0::bigint,
  'acheteur : lecture directe de la mission refusée');
select is((select count(*) from public.rapports_intervention where id = 'ac000000-0000-4000-8000-000000000031'), 0::bigint,
  'acheteur : lecture directe du rapport refusée');
select is((select count(*) from public.rapport_photos where rapport_id = 'ac000000-0000-4000-8000-000000000031'), 0::bigint,
  'acheteur : métadonnées photo masquées');
select ok(not public.storage_terrain_acces(
  'a0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000001/ac000000-0000-4000-8000-000000000031/photo.jpg',
  false), 'acheteur : lecture Storage refusée');
select results_eq($$update public.rapports_intervention set observations = 'Interdit'
where id = 'ac000000-0000-4000-8000-000000000031' returning id$$, $$select null::uuid where false$$,
  'acheteur : aucune modification du rapport non affecté');
select ok(public.mission_detail('ab000000-0000-4000-8000-000000000032') ->> 'peut_rediger' = 'true',
  'acheteur : accès et rédaction réservés à sa propre affectation');
insert into public.rapports_intervention(id, organization_id, dossier_id, mission_id, travaux)
values ('ac000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000032', 'Brouillon interne affecté');

select pg_temp.en(5);
select ok(public.mission_detail('ab000000-0000-4000-8000-000000000031') is not null,
  'directeur des opérations non affecté : lit la mission et le rapport');
select is(public.mission_detail('ab000000-0000-4000-8000-000000000031') ->> 'peut_rediger', 'false',
  'directeur non affecté : droit de rédaction absent de la fiche');
select results_eq($$update public.rapports_intervention set travaux = 'Interdit'
where id = 'ac000000-0000-4000-8000-000000000031' returning id$$, $$select null::uuid where false$$,
  'directeur non affecté : le brouillon ne peut pas être modifié');
select throws_ok($$insert into public.rapports_intervention(organization_id, dossier_id, mission_id, travaux)
values ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
        'ab000000-0000-4000-8000-000000000033', 'Interdit')$$, '42501', null,
  'directeur non affecté : création interdite');
select lives_ok($$select public.signer_rapport('ac000000-0000-4000-8000-000000000031', 'Client fictif',
  'data:image/png;base64,iVBORw0KGgo=')$$, 'directeur : peut enregistrer la signature client au titre du pilotage');
select throws_ok($$select public.nouvelle_version_rapport('ac000000-0000-4000-8000-000000000031')$$, '42501', null,
  'directeur non affecté : reprise en nouveau brouillon interdite');

select pg_temp.en(2);
select is((select count(*) from public.rapports_intervention), 2::bigint, 'gérant : lecture des rapports du dossier');
select results_eq($$update public.rapports_intervention set observations = 'Interdit'
where id = 'ac000000-0000-4000-8000-000000000032' returning id$$, $$select null::uuid where false$$,
  'gérant non affecté : le brouillon ne peut pas être modifié');
select ok(exists(select 1 from public.audit_log where table_name = 'rapports_intervention'),
  'gérant habilité à l’audit : accès aux traces des rapports');

select pg_temp.en(8);
select is((select count(*) from public.missions), 3::bigint, 'responsable désigné : lecture des missions de son dossier');
select results_eq($$update public.rapports_intervention set observations = 'Interdit'
where id = 'ac000000-0000-4000-8000-000000000032' returning id$$, $$select null::uuid where false$$,
  'responsable désigné non affecté : le brouillon ne peut pas être modifié');
select lives_ok($$select public.valider_rapport('ac000000-0000-4000-8000-000000000032')$$,
  'responsable désigné non affecté : validation interne toujours autorisée');
select is((select count(*) from public.signatures where objet_id = 'ac000000-0000-4000-8000-000000000031'), 1::bigint,
  'responsable désigné : lecture de la signature client');

select pg_temp.en(6);
select is((select count(*) from public.signatures where objet_id = 'ac000000-0000-4000-8000-000000000031'), 0::bigint,
  'DAF : le droit de lecture des devis ne donne pas accès à la signature du rapport');
select is((select count(*) from public.audit_log where table_name in ('missions', 'mission_agents', 'rapports_intervention', 'rapport_photos')),
  0::bigint, 'DAF : audit des missions et rapports hors périmètre');
select ok(exists(select 1 from public.audit_log where table_name = 'dossiers'), 'DAF : audit des dossiers conservé');

select pg_temp.en(12);
select ok(public.has_role('a0000000-0000-4000-8000-000000000002', array['gerant']::public.app_role[]),
  'le compte étranger est bien gérant de l’autre organisation');
select is(public.mission_detail('ab000000-0000-4000-8000-000000000031'), null::jsonb,
  'gérant étranger : RPC de lecture isolée');
select is((select count(*) from public.missions) + (select count(*) from public.rapports_intervention)
        + (select count(*) from public.rapport_photos) + (select count(*) from public.signatures), 0::bigint,
  'gérant étranger : tables mission, rapport, photo et signature isolées');
select throws_ok($$insert into public.rapports_intervention(organization_id, dossier_id, mission_id, travaux)
values ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
        'ab000000-0000-4000-8000-000000000033', 'Interdit')$$, '42501', null, 'gérant étranger : insertion bloquée');
select throws_ok($$select public.signer_rapport('ac000000-0000-4000-8000-000000000031', 'Client fictif',
  'data:image/png;base64,iVBORw0KGgo=')$$, '42501', null, 'gérant étranger : signature par RPC bloquée');

select pg_temp.en(2);
insert into public.mission_agents(organization_id, mission_id, user_id)
select 'a0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000033', user_id
from (values ('10000000-0000-4000-8000-000000000002'::uuid), ('10000000-0000-4000-8000-000000000005'),
             ('10000000-0000-4000-8000-000000000008')) as agents(user_id);
select pg_temp.en(5);
select lives_ok($$insert into public.rapports_intervention(id, organization_id, dossier_id, mission_id, travaux)
values ('ac000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000033', 'Créé après affectation')$$,
  'directeur affecté : création autorisée');
select results_eq($$update public.rapports_intervention set observations = 'Directeur affecté'
where id = 'ac000000-0000-4000-8000-000000000033' returning observations$$, $$values ('Directeur affecté'::text)$$,
  'directeur affecté : modification autorisée');
select pg_temp.en(2);
select results_eq($$update public.rapports_intervention set observations = 'Gérant affecté'
where id = 'ac000000-0000-4000-8000-000000000033' returning observations$$, $$values ('Gérant affecté'::text)$$,
  'gérant affecté : modification autorisée');
select pg_temp.en(8);
select results_eq($$update public.rapports_intervention set observations = 'Responsable affecté'
where id = 'ac000000-0000-4000-8000-000000000033' returning observations$$, $$values ('Responsable affecté'::text)$$,
  'responsable désigné affecté : modification autorisée');

reset role;
select * from finish();
rollback;
