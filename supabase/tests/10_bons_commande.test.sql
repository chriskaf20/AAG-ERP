begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

create temp table _achats(id uuid, cle text primary key);
grant all on _achats to authenticated;
insert into public.fournisseurs(id, organization_id, nom) values
  ('a7000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Fournisseur de recette');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated"}', true);

insert into _achats select public.enregistrer_bon_commande(
 'a0000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-00000000000b', null, 'Achat de fonctionnement', 'USD',
 '[{"description":"Prestations","quantite":3,"prix_unitaire":2500}]'), 'haut';
select is((select total_ttc from public.bons_commande where id = (select id from _achats where cle='haut')), 8700::numeric,
 'total TTC calculé pour l’achat hors dossier');
select is((select numero from public.bons_commande where id = (select id from _achats where cle='haut')), null::text,
 'le brouillon ne consomme aucun numéro');
select lives_ok($$select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',
 (select id from _achats where cle='haut'),'soumettre')$$, 'soumission du bon');
select is((select statut from public.bons_commande where id = (select id from _achats where cle='haut')), 'a_valider', 'au-dessus du seuil : validation nécessaire');
select throws_ok($$select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',
 (select id from _achats where cle='haut'),'emettre')$$, '23514', null, 'émission avant validation refusée en base');
select throws_ok($$select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',
 (select id from _achats where cle='haut'),'valider')$$, '42501', null, 'acheteur : validation interdite');
select throws_ok($$select public.enregistrer_bon_commande('a0000000-0000-4000-8000-000000000001',
 'a7000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-00000000000a',null,'Autre département','USD',
 '[{"description":"Ligne","quantite":1,"prix_unitaire":100}]')$$, '42501', null, 'acheteur : autre département refusé');

insert into _achats select public.enregistrer_bon_commande(
 'a0000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-00000000000b',
 (select id from public.dossiers where department_id = 'd0000000-0000-4000-8000-00000000000b' limit 1),
 'Achat sur dossier', 'USD', '[{"description":"Fournitures","quantite":2,"prix_unitaire":30}]'), 'bas';
select ok((select dossier_id is not null from public.bons_commande where id = (select id from _achats where cle='bas')), 'achat rattaché à un dossier');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',
 (select id from _achats where cle='haut'),'valider')$$, 'gérant : bon au-dessus du seuil validé');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',(select id from _achats where cle='haut'),'emettre');
select matches((select numero from public.bons_commande where id = (select id from _achats where cle='haut')),
 '^BC-[0-9]{4}-001$', 'numéro BC attribué à l’émission');
select throws_ok($$select public.enregistrer_bon_commande('a0000000-0000-4000-8000-000000000001',
 'a7000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-00000000000b',null,'Modification','USD',
 '[{"description":"Ligne","quantite":1,"prix_unitaire":100}]',(select id from _achats where cle='haut'))$$,
 '23514', null, 'bon émis immuable');
select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',(select id from _achats where cle='bas'),'soumettre');
select lives_ok($$select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',
 (select id from _achats where cle='bas'),'emettre')$$, 'sous le seuil : émission sans visa du gérant');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select count(*) from public.bons_commande), 2::bigint, 'DAF : consultation des commandes');

select * from finish();
rollback;
