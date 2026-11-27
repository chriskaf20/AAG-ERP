begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);
create temp table _bc(cle text primary key, id uuid);
grant all on _bc to authenticated;

insert into public.fournisseurs(id, organization_id, nom)
values ('a7000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Fournisseur émission');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
insert into _bc select 'initial', public.enregistrer_bon_commande(
  'a0000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-00000000000b',null,'Matériel','USD',
  '[{"description":"Lot A","quantite":4,"prix_unitaire":2500},{"description":"Lot B","quantite":2,"prix_unitaire":10}]');
create function pg_temp.transition(p_cle text, p_action text)
returns void language sql as $$
  select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',
    (select id from _bc where cle = p_cle), p_action);
$$;
create function pg_temp.remplacer(p_cle text, p_motif text)
returns uuid language sql as $$
  select public.remplacer_bon_commande('a0000000-0000-4000-8000-000000000001',
    (select id from _bc where cle = p_cle), p_motif);
$$;
create function pg_temp.recevoir(p_cle text, p_lot text, p_op uuid, p_qte numeric)
returns uuid language sql as $$
 select public.receptionner_achat('a0000000-0000-4000-8000-000000000001',
   b.id,p_op,current_date,null,null,jsonb_build_array(jsonb_build_object('ligne_id',l.id,'quantite',p_qte)))
 from _bc b join public.bon_commande_lignes l on l.bon_id=b.id
 where b.cle=p_cle and l.description=p_lot;
$$;

select pg_temp.transition('initial','soumettre');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.transition('initial','valider');
select pg_temp.transition('initial','emettre');
select pg_temp.recevoir('initial','Lot A','a8000000-0000-4000-8000-000000000001',1);
select pg_temp.recevoir('initial','Lot B','a8000000-0000-4000-8000-000000000002',2);
update public.fournisseurs set nom = 'Nouveau nom fournisseur'
where id = 'a7000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select throws_ok($$select pg_temp.remplacer('initial','Lot révisé')$$,'42501',null,'DAF en lecture seule');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
select throws_ok($$select pg_temp.remplacer('initial',' ')$$,'23514',null,'motif exigé');
insert into _bc select 'remplacement', pg_temp.remplacer('initial','Lot révisé');
select is(pg_temp.remplacer('initial','Lot révisé'),(select id from _bc where cle='remplacement'),'relance : un seul remplacement');
select is((select statut from public.bons_commande where id=(select id from _bc where cle='initial')),
  'reliquat_annule','reliquat original annulé');
select is((select mentions_emission #>> '{fournisseur,raison_sociale}' from public.bons_commande
  where id=(select id from _bc where cle='initial')),'Fournisseur émission','mentions du PDF d’origine figées');
select is((select sum(quantite) from public.bon_commande_lignes where bon_id=(select id from _bc where cle='initial')),
  6::numeric,'quantités originales inchangées');
select is((select count(*) from public.bon_commande_lignes where bon_id=(select id from _bc where cle='remplacement')),
  1::bigint,'la ligne intégralement reçue n’est pas recopiée');
select is((select quantite from public.bon_commande_lignes where bon_id=(select id from _bc where cle='remplacement')),
  3::numeric,'seules les trois unités restantes sont commandées');
select ok((select b.bon_origine_id = a.id and b.statut = 'brouillon' and b.valide_le is null
  from public.bons_commande b join _bc a on a.cle='initial' where b.id=(select id from _bc where cle='remplacement')),
  'nouveau brouillon lié, soumis à sa propre validation');
select throws_ok($$select pg_temp.recevoir('initial','Lot A','a8000000-0000-4000-8000-000000000003',1)$$,
  '23514',null,'interdiction de recevoir le reliquat sur le bon initial');
select is(pg_temp.recevoir('initial','Lot A','a8000000-0000-4000-8000-000000000001',1),
  'a8000000-0000-4000-8000-000000000001'::uuid,'relecture idempotente de la réception initiale');
select throws_ok($$select public.enregistrer_bon_commande(
  'a0000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-00000000000b',null,'Matériel','USD',
  '[{"description":"Lot A","quantite":4,"prix_unitaire":2500}]',(select id from _bc where cle='remplacement'))$$,
  '23514',null,'l’ajout d’une quantité déjà reçue est interdit sur le remplacement');
select pg_temp.transition('remplacement','soumettre');
select throws_ok($$select pg_temp.transition('remplacement','emettre')$$,'23514',null,'visa du gérant exigé de nouveau');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.transition('remplacement','valider');
select pg_temp.transition('remplacement','emettre');
select lives_ok($$select pg_temp.recevoir('remplacement','Lot A','a8000000-0000-4000-8000-000000000004',3)$$,
  'les trois unités restantes sont réceptionnées sur le nouveau bon');
select is((select sum(quantite) from public.reception_achat_lignes), 6::numeric,'six unités reçues en tout, sans double comptage');
select * from finish();
rollback;
