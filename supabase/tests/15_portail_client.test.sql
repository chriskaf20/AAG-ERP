begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(23);

create temp table _p(cle text primary key,id uuid);
grant all on _p to authenticated;
insert into _p values
 ('org_a','a0000000-0000-4000-8000-000000000001'),('org_b','a0000000-0000-4000-8000-000000000002'),
 ('a','c0000000-0000-4000-8000-000000000001'),('b','c0000000-0000-4000-8000-000000000002'),
 ('externe','c0000000-0000-4000-8000-000000000099'),
 ('dossier_a','f0000000-0000-4000-8000-000000000001'),('dossier_b','f0000000-0000-4000-8000-000000000002'),
 ('compte_a','10000000-0000-4000-8000-000000000012'),('compte_b','10000000-0000-4000-8000-000000000011'),
 ('sans_role','10000000-0000-4000-8000-000000000010'),
 ('partage','a9000000-0000-4000-8000-000000000001'),('brouillon','a9000000-0000-4000-8000-000000000002'),
 ('partage_b','a9000000-0000-4000-8000-000000000003'),('piece','a9000000-0000-4000-8000-000000000004'),
 ('hors_org','a9000000-0000-4000-8000-000000000005');

create function pg_temp.p(cle text) returns uuid language sql as $$ select id from _p where _p.cle=$1; $$;
create function pg_temp.acteur(n int) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('role','authenticated',
    'sub','10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::text,true);
$$;
create function pg_temp.lier(c text,u text,actif boolean default true) returns void language sql as $$
  select public.portail_lier_compte(pg_temp.p('org_a'),pg_temp.p(c),pg_temp.p(u),actif);
$$;
create function pg_temp.partager(d text,actif boolean default true) returns void language sql as $$
  select public.portail_partager_document(pg_temp.p('org_a'),pg_temp.p(d),actif);
$$;

insert into public.organizations(id,nom) values(pg_temp.p('org_b'),'Portail d’une autre organisation');
insert into public.clients(id,organization_id,raison_sociale)
values(pg_temp.p('externe'),pg_temp.p('org_b'),'Client entreprise B');
delete from public.user_roles where user_id in (pg_temp.p('compte_a'),pg_temp.p('compte_b'));
insert into public.user_roles(organization_id,user_id,role) values
  (pg_temp.p('org_a'),pg_temp.p('compte_a'),'client'),
  (pg_temp.p('org_a'),pg_temp.p('compte_b'),'client'),
  (pg_temp.p('org_b'),pg_temp.p('compte_a'),'client');

insert into public.documents(id,organization_id,dossier_id,type,bucket,chemin,nom_fichier)
select pg_temp.p(x.cle),d.organization_id,d.id,'f03_cahier_charges','dossiers',
  (case when x.cle='hors_org' then pg_temp.p('org_b') else d.organization_id end)::text || '/' || d.numero || '/f03/' || x.cle || '.pdf',
  x.cle || '.pdf'
from (values('partage','dossier_a'),('brouillon','dossier_a'),('partage_b','dossier_b'),('hors_org','dossier_a')) x(cle,dossier)
join public.dossiers d on d.id=pg_temp.p(x.dossier);
insert into public.documents(id,organization_id,client_id,type,bucket,chemin,nom_fichier)
values(pg_temp.p('piece'),pg_temp.p('org_a'),pg_temp.p('a'),'autre','clients',
  pg_temp.p('org_a')::text||'/'||pg_temp.p('a')::text||'/autre/piece.pdf','piece.pdf');
insert into storage.objects(bucket_id,name)
select bucket,chemin from public.documents where id in
  (pg_temp.p('partage'),pg_temp.p('brouillon'),pg_temp.p('partage_b'),pg_temp.p('piece'));

set local role authenticated;
select pg_temp.acteur(12);
select is((select count(*) from public.portail_dossiers(pg_temp.p('org_a'))),0::bigint,'compte non rattaché : aucun dossier');
select pg_temp.acteur(6);
select throws_ok($$select pg_temp.lier('a','compte_a')$$,'42501',null,'la DAF ne peut pas rattacher de compte');
select throws_ok($$select pg_temp.partager('partage')$$,'42501',null,'la DAF ne peut pas partager de document');
select pg_temp.acteur(2);
select throws_ok($$select pg_temp.lier('externe','compte_a')$$,'23514',null,'rattachement inter-organisations refusé');
select throws_ok($$select pg_temp.lier('a','sans_role')$$,'23514',null,'rattachement réservé à un compte avec le rôle client');
select pg_temp.lier('a','compte_a');
select pg_temp.lier('b','compte_b');
select throws_ok($$select pg_temp.lier('b','compte_a')$$,'23514',null,'changer le client d’un compte exige une révocation explicite');
select throws_ok($$select pg_temp.partager('hors_org')$$,'23514',null,'impossible de partager un chemin de fichier hors organisation');
select pg_temp.partager('partage');
select pg_temp.partager('partage_b');
select pg_temp.partager('piece');

select pg_temp.acteur(12);
select is((select id from public.portail_dossiers(pg_temp.p('org_a'),pg_temp.p('dossier_a'))),pg_temp.p('dossier_a'),
  'le client voit son dossier');
select is((select count(*) from public.portail_dossiers(pg_temp.p('org_a'),pg_temp.p('dossier_b'))),0::bigint,
  'le dossier d’un autre client est masqué');
select is((select count(*) from public.portail_dossiers(pg_temp.p('org_b'))),0::bigint,'l’autre organisation n’a aucun dossier attaché à ce compte');
select is((select array_agg(id) from public.portail_documents(pg_temp.p('org_a'),pg_temp.p('dossier_a'))),
  array[pg_temp.p('partage')],'une seule version du dossier est explicitement partagée');
select is((select id from public.portail_documents(pg_temp.p('org_a'))),pg_temp.p('piece'),'visible aussi pour une pièce de compte partagée');
select is((select count(*) from public.portail_document_fichier(pg_temp.p('org_a'),pg_temp.p('brouillon'))),
  0::bigint,'le fichier non partagé est interdit');
select is((select count(*) from public.documents),0::bigint,'le rôle client ne lit pas la table interne des documents');
select is((select count(*) from public.dossiers),0::bigint,'le rôle client ne lit pas la table interne des dossiers');

select set_config('storage.operation','object.list',true);
select is((select count(*) from storage.objects where bucket_id in ('dossiers','clients')),0::bigint,'le portail ne permet pas de lister les buckets');
select set_config('storage.operation','object.sign',true);
select is((select count(*) from storage.objects where bucket_id in ('dossiers','clients')),0::bigint,
  'le compte client ne peut pas créer d’URL signée réutilisable après révocation');
select set_config('storage.operation','object.get_authenticated',true);
select is((select count(*) from storage.objects where bucket_id in ('dossiers','clients')),2::bigint,'Storage autorise seulement les deux fichiers partagés');

select pg_temp.acteur(11);
select is((select count(*) from public.portail_document_fichier(pg_temp.p('org_a'),pg_temp.p('partage'))),
  0::bigint,'le client B ne télécharge pas le fichier partagé au client A');
select pg_temp.acteur(2);
select pg_temp.partager('partage',false);
select pg_temp.acteur(12);
select is((select count(*) from public.portail_document_fichier(pg_temp.p('org_a'),pg_temp.p('partage'))),0::bigint,
  'révoquer la pièce retire son téléchargement même si le compte est encore rattaché');
select is((select count(*) from storage.objects where bucket_id='clients'),1::bigint,
  'le partage révoqué ne supprime pas les autres partages');
select pg_temp.acteur(2);
select pg_temp.lier('a','compte_a',false);
select pg_temp.acteur(12);
select is((select count(*) from public.portail_dossiers(pg_temp.p('org_a'))),0::bigint,'rattachement révoqué : accès dossier retiré');
select is((select count(*) from storage.objects where bucket_id in ('dossiers','clients')),0::bigint,'rattachement révoqué : aucun téléchargement');

select * from finish();
rollback;
