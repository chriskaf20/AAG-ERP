-- Tests des règles de statut — Phase 1 (nécessite les données de seed.sql)
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

-- Raccourcis : resp.dossier = …08, gérant = …02, agent = …11
-- Dossier 001 (nouveau, resp …08), 003 (en_verification, resp …08, agent affecté),
-- 006 (en_verification, PEF), 010 (nouveau, resp AFF …07)

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- Statut protégé et transitions interdites
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.dossiers set statut = 'accepte' where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'modification directe du statut interdite'
);

select throws_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'accepte')$$,
  '23514', null,
  'nouveau → accepte : transition interdite'
);

select throws_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'en_cours')$$,
  '23514', null,
  'nouveau → en_cours : transition hors phase 1 interdite'
);

-- ---------------------------------------------------------------------------
-- nouveau → en_verification
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'en_verification')$$,
  'nouveau → en_verification par le responsable du dossier'
);

select is(
  (select statut::text from public.dossiers where id = 'f0000000-0000-4000-8000-000000000001'),
  'en_verification', 'statut mis à jour'
);

select is(
  (select count(*)::int from public.dossier_status_history
   where dossier_id = 'f0000000-0000-4000-8000-000000000001'
     and ancien_statut = 'nouveau' and nouveau_statut = 'en_verification'
     and created_by = '10000000-0000-4000-8000-000000000008'),
  1, 'historique écrit'
);

reset role;
select is(
  (select count(*)::int from public.audit_log
   where record_id = 'f0000000-0000-4000-8000-000000000001' and action = 'STATUT'),
  1, 'audit écrit'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- en_verification → accepte : vérification validée par le gérant obligatoire
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'accepte')$$,
  '42501', null,
  'décision réservée au gérant'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000001', 'accepte')$$,
  '23514', null,
  'gérant : acceptation impossible sans F-02 validée'
);

-- Le responsable remplit la F-02 avec un point non conforme
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
insert into public.verifications (id, organization_id, dossier_id,
  identite_verifiee, documents_valides, coordonnees_confirmees, signataire_habilite,
  activite_legale, capacite_atlas, capacite_paiement, absence_conflit, decision)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001', true, true, true, true, true, true, false, true, 'accepte');

select is(
  (select verifie_par from public.verifications where id = 'b0000000-0000-4000-8000-000000000001'),
  '10000000-0000-4000-8000-000000000008'::uuid, 'vérifié par = auteur de la décision'
);

select throws_ok(
  $$update public.verifications set valide_le = now(), valide_par = auth.uid()
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'validation directe (hors valider_verification) interdite'
);

select throws_ok(
  $$select public.valider_verification('b0000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'validation réservée au gérant'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.valider_verification('b0000000-0000-4000-8000-000000000001')$$,
  '23514', null,
  'acceptation refusée si un point est non conforme'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
update public.verifications set capacite_paiement = true
 where id = 'b0000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$select public.valider_verification('b0000000-0000-4000-8000-000000000001')$$,
  'gérant : validation de la F-02 conforme'
);

select is(
  (select statut::text from public.dossiers where id = 'f0000000-0000-4000-8000-000000000001'),
  'accepte', 'dossier accepté après validation du gérant'
);

select throws_ok(
  $$update public.verifications set observations = 'modif' where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'F-02 validée : non modifiable'
);

-- ---------------------------------------------------------------------------
-- Complément requis puis retour en vérification (dossier 003)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
insert into public.verifications (id, organization_id, dossier_id,
  identite_verifiee, documents_valides, coordonnees_confirmees, signataire_habilite,
  activite_legale, capacite_atlas, capacite_paiement, absence_conflit, decision)
values ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000003', true, false, true, true, true, true, true, true, 'complement_requis');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.valider_verification('b0000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'complément requis : pièces demandées obligatoires'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
update public.verifications set pieces_demandees = 'RCCM à jour'
 where id = 'b0000000-0000-4000-8000-000000000002';

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select public.valider_verification('b0000000-0000-4000-8000-000000000002');
select is(
  (select statut::text || ' / ' || statut_motif from public.dossiers where id = 'f0000000-0000-4000-8000-000000000003'),
  'complement_requis / RCCM à jour', 'dossier en complément requis avec pièces demandées comme motif'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000003', 'en_verification')$$,
  '42501', null,
  'agent_terrain : ne peut pas changer le statut d''un dossier affecté'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
select lives_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000003', 'en_verification')$$,
  'complement_requis → en_verification'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000003', 'complement_requis', 'x')$$,
  '23514', null,
  'une ancienne F-02 ne peut pas être réutilisée après retour en vérification'
);

-- ---------------------------------------------------------------------------
-- Refus (dossier 006) et classement sans suite (dossier 010)
-- ---------------------------------------------------------------------------
insert into public.verifications (id, organization_id, dossier_id,
  identite_verifiee, documents_valides, coordonnees_confirmees, signataire_habilite,
  activite_legale, capacite_atlas, capacite_paiement, absence_conflit, decision)
values ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000006', true, true, true, true, false, true, true, true, 'refuse');

select throws_ok(
  $$select public.valider_verification('b0000000-0000-4000-8000-000000000003')$$,
  '23514', null,
  'refus : motif obligatoire'
);

update public.verifications set motif = 'Autorisations d''exploitation absentes'
 where id = 'b0000000-0000-4000-8000-000000000003';
select public.valider_verification('b0000000-0000-4000-8000-000000000003');
select is(
  (select statut::text from public.dossiers where id = 'f0000000-0000-4000-8000-000000000006'),
  'refuse', 'dossier refusé avec motif'
);

select throws_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000010', 'classe_sans_suite', '  ')$$,
  '23514', null,
  'classement sans suite : motif obligatoire'
);

select lives_ok(
  $$select public.change_dossier_status('f0000000-0000-4000-8000-000000000010', 'classe_sans_suite', 'Client injoignable')$$,
  'classement sans suite avec motif par le gérant'
);

reset role;
select * from finish();
rollback;
