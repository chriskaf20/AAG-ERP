-- Archivage idempotent après signature.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);
create temp table _ctx (cle text primary key, val text not null);
grant all on _ctx to authenticated, service_role;

select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'accepte' where id = 'f0000000-0000-4000-8000-000000000009';
select set_config('atlas.changement_statut', 'off', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.devis (id, organization_id, dossier_id, objet)
values ('dd000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'Travaux et étude');
insert into public.devis_lignes (organization_id, devis_id, description, prix_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000010', 'Travaux et étude', 6250);
select public.valider_devis('dd000000-0000-4000-8000-000000000010');
insert into _ctx select 'devis_token', public.envoyer_devis('dd000000-0000-4000-8000-000000000010') ->> 'token';

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.signer_par_lien((select val from _ctx where cle = 'devis_token'), 'Client Test',
                              'data:image/png;base64,iVBORw0KGgo=', null, 'pgtap');

reset role;
insert into _ctx
select 'chemin_archive',organization_id::text||'/'||numero||'/archives-devis/dd000000-0000-4000-8000-000000000010.pdf'
from public.dossiers where id='f0000000-0000-4000-8000-000000000009';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values ('dossiers',(select val from _ctx where cle='chemin_archive'))$$,
  '42501',null,'même le gérant ne peut pas préremplir le chemin d’archive');
select throws_ok($$select public.consigner_archive_devis('dd000000-0000-4000-8000-000000000010',
  (select val from _ctx where cle='chemin_archive'),'devis.pdf',12)$$,'42501',null,'consignation réservée au serveur');
reset role;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.consigner_archive_devis('dd000000-0000-4000-8000-000000000010',
  (select val from _ctx where cle='chemin_archive'),'devis.pdf',12)$$,'23514',null,'pas de métadonnées si le fichier est absent');
insert into storage.objects(bucket_id,name) values ('dossiers',(select val from _ctx where cle='chemin_archive'));
insert into _ctx select 'archive',public.consigner_archive_devis('dd000000-0000-4000-8000-000000000010',
  (select val from _ctx where cle='chemin_archive'),'devis.pdf',12)::text;
select is(public.consigner_archive_devis('dd000000-0000-4000-8000-000000000010',
  (select val from _ctx where cle='chemin_archive'),'devis.pdf',12)::text,
  (select val from _ctx where cle='archive'),'la consignation répétée réutilise l’archive');
select is((select count(*) from public.documents where devis_archive_id='dd000000-0000-4000-8000-000000000010'),
  1::bigint,'un seul document archivé pour la version signée');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$update public.documents set libelle='Réécrit' where id=(select val::uuid from _ctx where cle='archive')$$,
  '42501',null,'les métadonnées du document signé sont figées');
with supprime as (delete from storage.objects where name=(select val from _ctx where cle='chemin_archive')
  returning id) select is(count(*),0::bigint,'le fichier archivé ne peut plus être supprimé depuis Storage') from supprime;

select * from finish();
rollback;
