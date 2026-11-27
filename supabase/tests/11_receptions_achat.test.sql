begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

create temp table _achats(id uuid, cle text primary key);
grant all on _achats to authenticated;
insert into public.organizations(id, nom)
values ('a0000000-0000-4000-8000-000000000002', 'Organisation de recette distincte');
delete from public.user_roles where user_id = '10000000-0000-4000-8000-000000000012';
insert into public.user_roles (organization_id, user_id, role)
values ('a0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000012', 'gerant');
insert into public.fournisseurs(id, organization_id, nom)
values ('a7000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Fournisseur de recette');

create function pg_temp.reception(operation uuid, premier numeric, second numeric default null)
returns uuid language sql as $$
  select public.receptionner_achat(
    'a0000000-0000-4000-8000-000000000001', (select id from _achats where cle = 'bon'),
    operation, date '2026-11-27', 'BL-01', null,
    (select jsonb_agg(jsonb_build_object('ligne_id', id, 'quantite', q))
     from (values ('lot1', premier), ('lot2', second)) as compte(cle, q)
     join _achats a using (cle) where q is not null)
  );
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
insert into _achats select public.enregistrer_bon_commande(
  'a0000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-00000000000b', null, 'Achat de recette', 'USD',
  '[{"description":"Lot 1","quantite":4,"prix_unitaire":10},{"description":"Lot 2","quantite":2,"prix_unitaire":20}]'
), 'bon';
insert into _achats select id, replace(lower(description), ' ', '') from public.bon_commande_lignes
where bon_id = (select id from _achats where cle = 'bon');

select throws_ok($$select pg_temp.reception('a8000000-0000-4000-8000-000000000001', 1)$$,
  '23514', null, 'réception avant émission refusée');
select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001', (select id from _achats where cle = 'bon'), 'soumettre');
select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001', (select id from _achats where cle = 'bon'), 'emettre');

select is(pg_temp.reception('a8000000-0000-4000-8000-000000000001', 1),
  'a8000000-0000-4000-8000-000000000001'::uuid, 'réception partielle consignée par l’acheteur');
select is((select statut from public.bons_commande where id = (select id from _achats where cle = 'bon')),
  'recu_partiel', 'reste à recevoir après la première réception');
select is(pg_temp.reception('a8000000-0000-4000-8000-000000000001', 1.000),
  'a8000000-0000-4000-8000-000000000001'::uuid, 'le même envoi retrouve la réception initiale');
select throws_ok($$select pg_temp.reception('a8000000-0000-4000-8000-000000000001', 2)$$,
  '23514', null, 'même identifiant et contenu différent refusés');
select throws_ok($$select pg_temp.reception('a8000000-0000-4000-8000-000000000002', 4, 1)$$,
  '23514', null, 'excédent refusé sur une ligne');
select is((select count(*) from public.receptions_achat), 1::bigint, 'reprise et excédent sans réception supplémentaire');
select is((select count(*) from public.reception_achat_lignes), 1::bigint, 'reprise et excédent sans quantité supplémentaire');

select lives_ok($$select pg_temp.reception('a8000000-0000-4000-8000-000000000002', 3, 2)$$, 'dernier lot reçu');
select is((select statut from public.bons_commande where id = (select id from _achats where cle = 'bon')),
  'recu', 'commande totalement reçue lorsque chaque ligne est soldée');
select throws_ok($$select pg_temp.reception('a8000000-0000-4000-8000-000000000003', 1)$$,
  '23514', null, 'aucune nouvelle réception lorsque la commande est soldée');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select count(*) from public.receptions_achat), 2::bigint, 'la DAF lit les réceptions');
select throws_ok($$select pg_temp.reception('a8000000-0000-4000-8000-000000000004', 1)$$,
  '42501', null, 'la DAF ne peut pas réceptionner');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select is((select count(*) from public.reception_achat_lignes), 0::bigint, 'le gérant d’une autre organisation ne lit aucune ligne reçue');

select * from finish();
rollback;
