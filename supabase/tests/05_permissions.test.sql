-- Tests des permissions (role_permissions, has_permission, portée, union multi-rôle)
-- Comptes : …01 admin, …02 gérant, …03 associé, …05 dir. opérations, …06 DAF, …07 resp. AFF,
-- …08 resp. dossier, …09 acheteur SUP, …11 agent, …13 multi (resp. dossier + acheteur SUP),
-- …14 gérant + admin_systeme
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create temp table _ctx (cle text primary key, val text);
grant all on _ctx to public;

-- Dossiers AFF 001 (resp …08) et 010 (resp …13) passés en « accepté » pour les devis
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'accepte'
 where id in ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000010');
select set_config('atlas.changement_statut', 'off', true);

set local role authenticated;
create function pg_temp.en(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- has_permission et union
-- ---------------------------------------------------------------------------
select pg_temp.en('10000000-0000-4000-8000-000000000001');
select ok(public.has_permission('a0000000-0000-4000-8000-000000000001', 'admin.users'), 'admin : admin.users');
select ok(not public.has_permission('a0000000-0000-4000-8000-000000000001', 'dossiers.read_all'), 'admin : aucune donnée métier');
select is((select count(*)::int from public.dossiers) + (select count(*)::int from public.clients), 0,
          'admin : ne voit ni dossiers ni clients');

select pg_temp.en('10000000-0000-4000-8000-000000000003');
select ok(public.has_permission('a0000000-0000-4000-8000-000000000001', 'reports.read'), 'associé : reports.read');
select is((select count(*)::int from public.dossiers), 0, 'associé : aucun dossier');
select ok((public.rapport_indicateurs('a0000000-0000-4000-8000-000000000001') ->> 'marge_signee_usd') is not null,
          'associé : rapports avec marge agrégée');

select pg_temp.en('10000000-0000-4000-8000-000000000011');
select throws_ok($$select public.rapport_indicateurs('a0000000-0000-4000-8000-000000000001')$$, '42501', null,
                 'agent : rapports refusés');

select pg_temp.en('10000000-0000-4000-8000-000000000014');
select ok(public.has_permission('a0000000-0000-4000-8000-000000000001', 'admin.users')
          and public.has_permission('a0000000-0000-4000-8000-000000000001', 'dossiers.decide'),
          'gérant + admin : union des permissions');
select is(cardinality(public.mes_permissions('a0000000-0000-4000-8000-000000000001')), 20,
          'gérant + admin : 20 permissions distinctes');

select pg_temp.en('10000000-0000-4000-8000-000000000013');
select is(cardinality(public.mes_permissions('a0000000-0000-4000-8000-000000000001')), 10,
          'multi (resp. dossier + acheteur) : union = 10 permissions');
select results_eq($$select numero from public.dossiers order by numero$$,
                  $$values ('AAG-2026-002'::text), ('AAG-2026-005'::text), ('AAG-2026-008'::text), ('AAG-2026-010'::text)$$,
                  'multi : ses dossiers + ceux du département SUP');
select ok(public.dossier_perm('f0000000-0000-4000-8000-000000000010', 'dossiers.verify'),
          'multi : pilote de son dossier (rôle resp. dossier)');
select ok(not public.dossier_perm('f0000000-0000-4000-8000-000000000002', 'dossiers.verify'),
          'multi : lecture seule sur les dossiers SUP (rôle acheteur)');
select ok(not public.has_permission('a0000000-0000-4000-8000-000000000001', 'devis.send'), 'multi : pas de devis.send');

-- ---------------------------------------------------------------------------
-- DAF : lecture de tous les dossiers, pas de création
-- ---------------------------------------------------------------------------
select pg_temp.en('10000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.dossiers), 10, 'DAF : lit tous les dossiers');
select throws_ok($$insert into public.dossiers (organization_id, canal, client_id, service, besoin, department_id)
                   values ('a0000000-0000-4000-8000-000000000001', 'appel', 'c0000000-0000-4000-8000-000000000001',
                           'Test', 'Test', 'd0000000-0000-4000-8000-00000000000a')$$, '42501', null,
                 'DAF : ne peut pas créer de dossier');
select throws_ok($$insert into public.devis (organization_id, dossier_id) values
                   ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001')$$, '42501', null,
                 'DAF : ne peut pas établir de devis');

-- ---------------------------------------------------------------------------
-- devis.send : responsable du département du dossier ou gérant uniquement
-- ---------------------------------------------------------------------------
select pg_temp.en('10000000-0000-4000-8000-000000000008');
insert into public.devis (id, organization_id, dossier_id, objet)
values ('dd000000-0000-4000-8000-000000000050', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'Petit devis');
insert into public.devis_lignes (organization_id, devis_id, description, quantite, prix_unitaire, cout_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000050', 'Prestation', 1, 1000, 600);
select is((select marge from public.devis where id = 'dd000000-0000-4000-8000-000000000050'), 400.00::numeric(14,2),
          'marge = HT - coûts estimés');
select throws_ok($$select public.envoyer_devis('dd000000-0000-4000-8000-000000000050')$$, '42501', null,
                 'responsable de dossier : envoi refusé');
select is(public.soumettre_devis('dd000000-0000-4000-8000-000000000050'), 1,
          'responsable de dossier : soumission notifie le responsable AFF');

select pg_temp.en('10000000-0000-4000-8000-000000000007');
select is((select count(*)::int from public.notifications where titre like 'Devis%à envoyer'), 1,
          'responsable AFF : notification reçue');

-- Responsable de département d'un autre département (dossier 009 en DIG)
select pg_temp.en('10000000-0000-4000-8000-000000000002');
insert into public.devis (id, organization_id, dossier_id, objet)
values ('dd000000-0000-4000-8000-000000000051', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'Devis DIG');
insert into public.devis_lignes (organization_id, devis_id, description, quantite, prix_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000051', 'Prestation', 1, 1000);
select pg_temp.en('10000000-0000-4000-8000-000000000007');
select throws_ok($$select public.envoyer_devis('dd000000-0000-4000-8000-000000000051')$$, null, null,
                 'responsable AFF : ne peut pas envoyer un devis d''un autre département');

select lives_ok($$select public.envoyer_devis('dd000000-0000-4000-8000-000000000050')$$,
                'responsable AFF : envoie le devis de son département');

select pg_temp.en('10000000-0000-4000-8000-000000000005');
select throws_ok($$select public.envoyer_devis('dd000000-0000-4000-8000-000000000051')$$, '42501', null,
                 'directeur des opérations : envoi refusé');

reset role;
select * from finish();
rollback;
