begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(10);
create temp table _invit(cle text primary key,id uuid);
grant all on _invit to authenticated,service_role;
create function pg_temp.acteur(n int) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('role','authenticated',
  'sub','10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::text,true);
$$;
create function pg_temp.invite(mail text,r public.app_role,d uuid default null) returns uuid language sql as $$
 select public.preparer_invitation('a0000000-0000-4000-8000-000000000001',mail,'Agent de recette','Test',r,d);
$$;
set local role authenticated;
select pg_temp.acteur(11);
select throws_ok($$select pg_temp.invite('nouveau@atlas-erp.test','agent_terrain')$$,'42501',null,'agent sans droit d’inviter');
select pg_temp.acteur(2);
select throws_ok($$select pg_temp.invite('nouveau@atlas-erp.test','admin_systeme')$$,'42501',null,'gérant sans droit d’inviter un administrateur système');
select throws_ok($$select pg_temp.invite('nouveau@atlas-erp.test','acheteur')$$,'23514',null,'département requis');
select throws_ok($$select pg_temp.invite('nouveau@atlas-erp.test','acheteur','d0000000-0000-4000-8000-000000000999')$$,'23514',null,'département inconnu refusé');
select throws_ok($$select pg_temp.invite('gerant@atlas-erp.test','agent_terrain')$$,'23514',null,'pas de réattribution silencieuse d’un compte existant');
insert into _invit select 'demande',pg_temp.invite('nouveau@atlas-erp.test','acheteur','d0000000-0000-4000-8000-00000000000b');
select is(pg_temp.invite('nouveau@ATLAS-ERP.TEST','acheteur','d0000000-0000-4000-8000-00000000000b'),
 (select id from _invit where cle='demande'),'relance de la même invitation');
reset role;

insert into auth.users(id,email,raw_user_meta_data)
values('10000000-0000-4000-8000-000000000098','autre@atlas-erp.test',
  jsonb_build_object('atlas_invitation',(select id from _invit where cle='demande'))),
 ('10000000-0000-4000-8000-000000000099','nouveau@atlas-erp.test',
  jsonb_build_object('atlas_invitation',(select id from _invit where cle='demande'),'role','gerant'));
update auth.users set invited_at=now() where id='10000000-0000-4000-8000-000000000098';
select is((select count(*) from public.user_roles where user_id='10000000-0000-4000-8000-000000000098'),
 0::bigint,'un autre email ne récupère pas la demande');
select is((select count(*) from public.user_roles where user_id='10000000-0000-4000-8000-000000000099'),
 0::bigint,'le simple ajout de métadonnées ne rattache aucun rôle');
update auth.users set invited_at=now() where id='10000000-0000-4000-8000-000000000099';
select is((select role::text from public.user_roles where user_id='10000000-0000-4000-8000-000000000099'),
 'acheteur','le rôle provient de la demande autorisée, jamais des métadonnées publiques');
set local role service_role;
select ok(public.invitation_rattachee((select id from _invit where cle='demande'),'10000000-0000-4000-8000-000000000099'),
 'le serveur peut confirmer que la bonne demande a été rattachée');
select * from finish();
rollback;
