begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into public.organizations(id, nom) values ('a0000000-0000-4000-8000-000000000004', 'Fournisseurs d’une autre organisation');
insert into public.fournisseurs(organization_id, nom) values ('a0000000-0000-4000-8000-000000000004', 'Fournisseur étranger');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
select lives_ok($$insert into public.fournisseurs(organization_id, nom, evaluation)
  values ('a0000000-0000-4000-8000-000000000001','Procureur fictif',5)$$, 'acheteur : création dans son organisation');
select throws_ok($$insert into public.fournisseurs(organization_id, nom)
  values ('a0000000-0000-4000-8000-000000000001',' procureur FICTIF ')$$, '23505', null, 'nom unique dans une organisation');
select is((select count(*) from public.fournisseurs where nom = 'Fournisseur étranger'), 0::bigint, 'annuaire isolé entre organisations');
select throws_ok($$update public.fournisseurs set organization_id = 'a0000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'organisation du fournisseur immuable pour les utilisateurs');
select lives_ok($$update public.fournisseurs set actif = false where nom = 'Procureur fictif'$$, 'acheteur : désactivation de la fiche');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select actif from public.fournisseurs where nom = 'Procureur fictif'), false, 'DAF : lecture de la fiche inactive');
select throws_ok($$insert into public.fournisseurs(organization_id, nom)
  values ('a0000000-0000-4000-8000-000000000001','Création interdite')$$, '42501', null, 'DAF : accès en lecture seule');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select is((select count(*) from public.fournisseurs), 0::bigint, 'agent terrain hors périmètre achats');

select * from finish();
rollback;
