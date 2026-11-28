-- Archivage idempotent après signature.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);
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
-- Émule l’opération Storage uniquement pour ce test transactionnel.
set local storage.allow_delete_query = 'true';
with supprime as (delete from storage.objects where name=(select val from _ctx where cle='chemin_archive')
  returning id) select is(count(*),0::bigint,'le fichier archivé ne peut plus être supprimé depuis Storage') from supprime;

-- Une signature traitée par l’ancienne application après le premier rattachement automatique.
insert into public.devis (id, organization_id, dossier_id, objet)
values ('dd000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'Étude à reprendre');
insert into public.devis_lignes (organization_id, devis_id, description, prix_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000011', 'Étude', 100);
insert into _ctx select 'historique_token', public.envoyer_devis('dd000000-0000-4000-8000-000000000011') ->> 'token';

select throws_ok($$select public.rattacher_archive_devis_existante('dd000000-0000-4000-8000-000000000011')$$,
  '42501',null,'le rattachement est réservé au serveur');

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.signer_par_lien((select val from _ctx where cle='historique_token'), 'Client Test',
                             'data:image/png;base64,iVBORw0KGgo=', null, 'pgtap');
insert into _ctx (cle, val)
select x.cle, x.val
from public.devis d join public.dossiers ds on ds.id=d.dossier_id
cross join lateral (values
  ('historique_prefixe', d.organization_id::text||'/'||ds.numero||'/devis/'),
  ('historique_libelle', 'Devis '||d.numero||' v'||d.version||' signé'),
  ('historique_nom', d.numero||'-v'||d.version||'-signe.pdf')
) x(cle,val)
where d.id='dd000000-0000-4000-8000-000000000011';
insert into _ctx
select 'historique_chemin', (select val from _ctx where cle='historique_prefixe')||'1700000000001-'||
                            (select val from _ctx where cle='historique_nom');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
with imitation as (
  insert into storage.objects(bucket_id,name)
  select 'dossiers', (select val from _ctx where cle='historique_prefixe')||'1700000000000-'||
                     (select val from _ctx where cle='historique_nom')
  returning name
)
insert into public.documents (organization_id,dossier_id,type,libelle,bucket,chemin,nom_fichier,mime_type,taille,est_signe)
select 'a0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000009','devis',
       (select val from _ctx where cle='historique_libelle'),'dossiers',name,
       (select val from _ctx where cle='historique_nom'),'application/pdf',12,true
from imitation;

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.rattacher_archive_devis_existante('dd000000-0000-4000-8000-000000000011'),null::uuid,
  'des métadonnées imitées par un utilisateur ne sont pas prises pour une archive du serveur');

insert into public.documents (id,organization_id,dossier_id,type,libelle,bucket,chemin,nom_fichier,mime_type,taille,est_signe)
values ('da000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009','devis',(select val from _ctx where cle='historique_libelle'),
        'dossiers',(select val from _ctx where cle='historique_chemin'),
        (select val from _ctx where cle='historique_nom'),'application/pdf',12,true);
select is(public.rattacher_archive_devis_existante('dd000000-0000-4000-8000-000000000011'),null::uuid,
  'un document historique sans objet Storage ne peut pas être rattaché');
insert into storage.objects(bucket_id,name) select 'dossiers',val from _ctx where cle='historique_chemin';
select is(public.rattacher_archive_devis_existante('dd000000-0000-4000-8000-000000000011'),
  'da000000-0000-4000-8000-000000000011'::uuid,'l’archive historique du serveur est conservée');
select is(public.rattacher_archive_devis_existante('dd000000-0000-4000-8000-000000000011'),
  'da000000-0000-4000-8000-000000000011'::uuid,'la reprise suivante renvoie le même document');
select is((select chemin from public.documents where devis_archive_id='dd000000-0000-4000-8000-000000000011'),
  (select val from _ctx where cle='historique_chemin'),'le chemin historique est conservé');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
with supprime as (delete from storage.objects where name=(select val from _ctx where cle='historique_chemin')
  returning id) select is(count(*),0::bigint,'le fichier historique rattaché ne peut plus être supprimé') from supprime;

select * from finish();
rollback;
