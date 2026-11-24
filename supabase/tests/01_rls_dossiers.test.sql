-- Tests RLS — Phase 1 (nécessite les données de seed.sql)
-- Exécution : supabase test db   (ou via scripts/run-db-tests)
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

-- État de référence du seed (indépendant des données de scénario)
update public.dossiers set responsable_id = '10000000-0000-4000-8000-000000000009'
 where id = 'f0000000-0000-4000-8000-000000000005';
update public.dossiers set responsable_id = '10000000-0000-4000-8000-000000000007'
 where id = 'f0000000-0000-4000-8000-000000000010';

-- ---------------------------------------------------------------------------
-- agent_terrain : ne voit que les dossiers qui lui sont affectés
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}', true);

select results_eq(
  $$select numero from public.dossiers order by numero$$,
  $$values ('AAG-2026-003'::text), ('AAG-2026-006'::text)$$,
  'agent_terrain : voit uniquement ses 2 dossiers affectés'
);

select is(
  (select count(*)::int from public.dossiers d
   where not exists (select 1 from public.dossier_affectations a
                     where a.dossier_id = d.id and a.user_id = auth.uid())),
  0,
  'agent_terrain : aucun dossier non affecté visible'
);

select results_eq(
  $$select raison_sociale from public.clients order by raison_sociale$$,
  $$values ('Groupe Hôtelier Exemple SA'::text), ('Mines Exemple du Haut-Katanga SARL'::text)$$,
  'agent_terrain : ne voit que les clients de ses dossiers'
);

select is(
  (select count(*)::int from public.dossier_status_history
   where dossier_id not in ('f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000006')),
  0,
  'agent_terrain : historique limité à ses dossiers'
);

select throws_ok(
  $$insert into public.dossiers (organization_id, canal, client_id, service, besoin, department_id)
    values ('a0000000-0000-4000-8000-000000000001', 'appel', 'c0000000-0000-4000-8000-000000000001',
            'Test', 'Test', 'd0000000-0000-4000-8000-00000000000a')$$,
  '42501', null,
  'agent_terrain : ne peut pas créer de dossier'
);

select is(
  (select count(*)::int from public.audit_log), 0,
  'agent_terrain : aucun accès au journal d''audit'
);

-- Affectation retirée → le dossier disparaît
reset role;
delete from public.dossier_affectations
 where dossier_id = 'f0000000-0000-4000-8000-000000000006'
   and user_id = '10000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}', true);

select results_eq(
  $$select numero from public.dossiers order by numero$$,
  $$values ('AAG-2026-003'::text)$$,
  'agent_terrain : un dossier désaffecté n''est plus visible'
);

-- ---------------------------------------------------------------------------
-- responsable_dossier : ne voit que les siens
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);

select results_eq(
  $$select numero from public.dossiers order by numero$$,
  $$values ('AAG-2026-001'::text), ('AAG-2026-003'::text), ('AAG-2026-004'::text), ('AAG-2026-007'::text)$$,
  'responsable_dossier : voit uniquement ses 4 dossiers'
);

select is(
  (select count(*)::int from public.dossiers where responsable_id is distinct from auth.uid()),
  0,
  'responsable_dossier : aucun dossier d''un autre responsable'
);

-- Réattribution du dossier 001 à un autre responsable → il disparaît
reset role;
update public.dossiers set responsable_id = '10000000-0000-4000-8000-000000000007'
 where id = 'f0000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.dossiers where numero = 'AAG-2026-001'),
  0,
  'responsable_dossier : un dossier réattribué n''est plus visible'
);

select throws_ok(
  $$insert into public.dossiers (organization_id, canal, client_id, service, besoin, department_id, responsable_id)
    values ('a0000000-0000-4000-8000-000000000001', 'appel', 'c0000000-0000-4000-8000-000000000001',
            'Test', 'Test', 'd0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000007')$$,
  '42501', null,
  'responsable_dossier : ne peut pas créer un dossier pour un autre responsable'
);

-- ---------------------------------------------------------------------------
-- Département, direction, client
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
select results_eq(
  $$select numero from public.dossiers order by numero$$,
  $$values ('AAG-2026-002'::text), ('AAG-2026-005'::text), ('AAG-2026-008'::text)$$,
  'acheteur (SUP) : voit les dossiers de son département'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.dossiers), 10, 'gérant : voit les 10 dossiers');
select ok((select count(*) from public.audit_log) > 0, 'gérant : lit le journal d''audit');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.dossiers) + (select count(*)::int from public.clients),
  0,
  'client (portail) : aucun dossier ni client visible en phase 1'
);

-- ---------------------------------------------------------------------------
-- Isolation entre organisations
-- ---------------------------------------------------------------------------
reset role;
insert into public.organizations (id, nom, prefixe_dossier) values ('a0000000-0000-4000-8000-000000000002', 'Autre PME', 'APM');
insert into public.departments (id, organization_id, code, nom)
  values ('d0000000-0000-4000-8000-0000000000aa', 'a0000000-0000-4000-8000-000000000002', 'AFF', 'Affaires');
insert into public.clients (id, organization_id, raison_sociale)
  values ('c0000000-0000-4000-8000-0000000000aa', 'a0000000-0000-4000-8000-000000000002', 'Client autre PME');
insert into public.dossiers (organization_id, canal, client_id, service, besoin, department_id)
  values ('a0000000-0000-4000-8000-000000000002', 'email', 'c0000000-0000-4000-8000-0000000000aa',
          'Service', 'Besoin', 'd0000000-0000-4000-8000-0000000000aa');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.dossiers where organization_id = 'a0000000-0000-4000-8000-000000000002')
  + (select count(*)::int from public.clients where organization_id = 'a0000000-0000-4000-8000-000000000002'),
  0,
  'gérant Atlas : ne voit rien d''une autre organisation'
);

-- ---------------------------------------------------------------------------
-- Anonyme
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$select * from public.dossiers$$, '42501', null, 'anonyme : accès refusé');

reset role;
select * from finish();
rollback;
