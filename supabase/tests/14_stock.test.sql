begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);
create temp table _stock(cle text primary key, id uuid);
grant all on _stock to authenticated;

insert into public.organizations(id, nom)
values ('a0000000-0000-4000-8000-000000000002', 'Autre organisation de recette');
delete from public.user_roles where user_id = '10000000-0000-4000-8000-000000000012';
insert into public.user_roles(organization_id, user_id, role)
values ('a0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012','gerant');
insert into public.stock_articles(id, organization_id, code, nom, unite)
values ('a8100000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','EXT','Article externe','pièce');
select is((select count(*) from public.stock_emplacements where par_defaut), 2::bigint, 'un défaut pour chaque nouvelle organisation et celles migrées');

insert into public.fournisseurs(id,organization_id,nom)
values ('a7000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Fournisseur stock');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated"}',true);
insert into _stock select 'principal', id from public.stock_emplacements where par_defaut;
insert into public.stock_emplacements(organization_id,nom)
values ('a0000000-0000-4000-8000-000000000001','Réserve');
insert into _stock select 'reserve', id from public.stock_emplacements where nom='Réserve';
insert into public.stock_articles(organization_id,code,nom,unite)
values ('a0000000-0000-4000-8000-000000000001','MAT-01','Composant','pièce');
insert into _stock select 'article', id from public.stock_articles where code='MAT-01';
select is((select count(*) from public.stock_articles),1::bigint,'catalogue limité à l’organisation de l’acheteur');

create function pg_temp.bon(p_article uuid)
returns uuid language sql as $$
  select public.enregistrer_bon_commande(
    'a0000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-00000000000b',null,'Composant et pose','USD',
    jsonb_build_array(jsonb_build_object('description','Composant','quantite',5,'prix_unitaire',50,'article_id',p_article),
      jsonb_build_object('description','Pose','quantite',1,'prix_unitaire',100)));
$$;
create function pg_temp.stock_transition(p_cle text,p_action text)
returns void language sql as $$
  select public.transition_bon_commande('a0000000-0000-4000-8000-000000000001',(select id from _stock where cle=p_cle),p_action);
$$;
create function pg_temp.stock_reception(p_cle text,p_op uuid,p_composant numeric,p_pose numeric default null)
returns uuid language sql as $$
  select public.receptionner_achat(
    'a0000000-0000-4000-8000-000000000001',b.id,p_op,current_date,'BL-14',null,
    (select jsonb_agg(jsonb_build_object('ligne_id',l.id,'quantite',v.q))
     from public.bon_commande_lignes l join (values ('Composant',p_composant),('Pose',p_pose)) v(nom,q)
       on v.nom=l.description and v.q is not null where l.bon_id=b.id))
  from _stock b where b.cle=p_cle;
$$;
create function pg_temp.stock_manuel(p_op uuid,p_lieu text,p_type text,p_delta numeric,p_motif text)
returns uuid language sql as $$
  select public.stock_mouvement('a0000000-0000-4000-8000-000000000001',p_op,
    (select id from _stock where cle='article'),(select id from _stock where cle=p_lieu),p_type,p_delta,p_motif);
$$;

select throws_ok($$select pg_temp.bon('a8100000-0000-4000-8000-000000000002')$$,'23514',null,'article externe refusé sur le bon');
insert into _stock select 'bon',pg_temp.bon((select id from _stock where cle='article'));
select pg_temp.stock_transition('bon','soumettre');
select pg_temp.stock_transition('bon','emettre');
select throws_ok($$insert into public.stock_mouvements(organization_id,article_id,emplacement_id,type,quantite)
  values ('a0000000-0000-4000-8000-000000000001',(select id from _stock where cle='article'),
    (select id from _stock where cle='principal'),'sortie',-1)$$,'42501',null,'insertion directe dans l’historique refusée');

select pg_temp.stock_reception('bon','a8000000-0000-4000-8000-000000000001',2,1);
select is((select count(*) from public.stock_mouvements),1::bigint,'une entrée pour l’article, aucune pour la prestation');
select is((select quantite from public.stock_quantites where emplacement_id=(select id from _stock where cle='principal')),
  2::numeric,'premier lot reçu à l’emplacement par défaut');
select throws_ok($$select public.stock_choisir_emplacement_defaut('a0000000-0000-4000-8000-000000000001',
  (select id from _stock where cle='reserve'))$$,'42501',null,'acheteur : choix du défaut refusé');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select public.stock_choisir_emplacement_defaut('a0000000-0000-4000-8000-000000000001',
  (select id from _stock where cle='reserve'));
select is((select id from public.stock_emplacements where par_defaut),(select id from _stock where cle='reserve'),'gérant : un seul nouveau défaut');
select pg_temp.stock_reception('bon','a8000000-0000-4000-8000-000000000001',2,1);
select is((select count(*) from public.stock_mouvements),1::bigint,'reprise de la réception sans entrée supplémentaire après changement du défaut');

insert into _stock select 'remplacement',public.remplacer_bon_commande('a0000000-0000-4000-8000-000000000001',
  (select id from _stock where cle='bon'),'Remplacement de recette');
select is((select article_id from public.bon_commande_lignes where bon_id=(select id from _stock where cle='remplacement')),
  (select id from _stock where cle='article'),'article stockable conservé sur le reliquat');
select pg_temp.stock_transition('remplacement','soumettre');
select pg_temp.stock_transition('remplacement','emettre');
select pg_temp.stock_reception('remplacement','a8000000-0000-4000-8000-000000000002',3);
select is((select quantite from public.stock_quantites where emplacement_id=(select id from _stock where cle='reserve')),
  3::numeric,'reliquat reçu au nouvel emplacement par défaut');
select is((select sum(quantite) from public.stock_quantites),5::numeric,'les cinq unités sont comptées une seule fois');

select throws_ok($$select pg_temp.stock_manuel('a8300000-0000-4000-8000-000000000001','principal','sortie',-3,'')$$,
  '23514',null,'sortie excédentaire refusée à cet emplacement');
select throws_ok($$select pg_temp.stock_manuel('a8300000-0000-4000-8000-000000000001','principal','ajustement',2,' ')$$,
  '23514',null,'motif exigé pour un ajustement');
select pg_temp.stock_manuel('a8300000-0000-4000-8000-000000000001','principal','sortie',-1,'Utilisation');
select pg_temp.stock_manuel('a8300000-0000-4000-8000-000000000001','principal','sortie',-1,'Utilisation');
select is((select quantite from public.stock_quantites where emplacement_id=(select id from _stock where cle='principal')),1::numeric,
  'la sortie répétée ne décrémente qu’une fois');
select pg_temp.stock_manuel('a8300000-0000-4000-8000-000000000002','principal','ajustement',2,'Comptage physique');
select is((select sum(quantite) from public.stock_quantites),6::numeric,'ajustement appliqué au stock physique');
select is((select motif from public.stock_mouvements where type='ajustement'),'Comptage physique','motif dans l’historique');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select is((select count(*) from public.stock_mouvements),4::bigint,'DAF : lecture du journal');
select throws_ok($$select pg_temp.stock_manuel('a8300000-0000-4000-8000-000000000003','principal','sortie',-1,null)$$,
  '42501',null,'DAF : sortie interdite');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000012","role":"authenticated"}',true);
select is((select count(*) from public.stock_quantites),0::bigint,'autre organisation : aucune quantité visible');

select * from finish();
rollback;
