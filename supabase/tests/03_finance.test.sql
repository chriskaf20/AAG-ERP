-- Tests Phase 2 — devis, signature, factures, paiements, PV, statuts, RLS (nécessite seed.sql)
-- Dossier 009 (accepté, DIG, pilote = directeur des opérations …05) ; DAF = …06 ; gérant = …02
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

create temp table _ctx (cle text primary key, val text);
grant all on _ctx to public;

-- État de référence du seed (indépendant des données de scénario)
update public.dossiers set responsable_id = '10000000-0000-4000-8000-000000000009'
 where id = 'f0000000-0000-4000-8000-000000000005';
update public.dossiers set responsable_id = '10000000-0000-4000-8000-000000000007'
 where id = 'f0000000-0000-4000-8000-000000000010';

-- Indépendant des manipulations manuelles : dossier 009 remis en « accepté », numéro FAC attendu
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'accepte' where id = 'f0000000-0000-4000-8000-000000000009';
select set_config('atlas.changement_statut', 'off', true);
insert into _ctx select 'fac_attendu', 'FAC-' || extract(year from current_date) || '-' || lpad((coalesce(
  (select dernier from public.compteurs where organization_id = 'a0000000-0000-4000-8000-000000000001'
     and type = 'FAC' and annee = extract(year from current_date)), 0) + 1)::text, 3, '0');

-- Données pour la RLS (créées sans utilisateur) : dossier 001 du responsable de dossier …08
insert into public.devis (id, organization_id, dossier_id, objet)
values ('dd000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'Devis du responsable de dossier');
insert into public.factures (id, organization_id, dossier_id, type)
values ('ff000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'mensuelle');

-- ---------------------------------------------------------------------------
-- Devis et seuil de validation
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);

insert into public.devis (id, organization_id, dossier_id, objet)
values ('dd000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'Réseau et postes');
insert into public.devis_lignes (organization_id, devis_id, description, quantite, prix_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000010', 'Postes de travail', 10, 800);

select is((select total_ttc from public.devis where id = 'dd000000-0000-4000-8000-000000000010'),
          9280.00::numeric(14,2), 'devis : total TTC avec TVA 16 %');
select ok((select depasse_seuil from public.devis where id = 'dd000000-0000-4000-8000-000000000010'),
          'devis : au-dessus du seuil de validation');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.envoyer_devis('dd000000-0000-4000-8000-000000000010')$$, '23514', null,
                 'seuil : envoi bloqué sans validation du gérant');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.valider_devis('dd000000-0000-4000-8000-000000000010')$$, 'seuil : validation par le gérant');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
update public.devis_lignes set quantite = 11 where devis_id = 'dd000000-0000-4000-8000-000000000010';
select is((select statut::text from public.devis where id = 'dd000000-0000-4000-8000-000000000010'),
          'brouillon', 'seuil : une modification après validation annule la validation');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select public.valider_devis('dd000000-0000-4000-8000-000000000010');
-- devis.send : gérant (le dossier 009 est en DIG, sans responsable de département)
insert into _ctx select 'token', public.envoyer_devis('dd000000-0000-4000-8000-000000000010') ->> 'token';
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);

select is((select statut::text from public.devis where id = 'dd000000-0000-4000-8000-000000000010'),
          'envoye', 'devis validé puis envoyé');
select lives_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009', 'devis_envoye')$$,
                'dossier : accepte → devis_envoye');

-- Sous le seuil : envoi sans validation (dossier 005, par le gérant)
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.devis (id, organization_id, dossier_id, objet)
values ('dd000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000005', 'Consommables');
insert into public.devis_lignes (organization_id, devis_id, description, quantite, prix_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000011', 'Lot', 1, 1000);
select lives_ok($$select public.envoyer_devis('dd000000-0000-4000-8000-000000000011')$$,
                'seuil : devis sous le seuil envoyé sans validation');

-- ---------------------------------------------------------------------------
-- Signature par lien (serveur, service_role) : usage unique, devis figé
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$select public.signer_par_lien((select val from _ctx where cle = 'token'), 'Client Test',
                  'data:image/png;base64,iVBORw0KGgo=', '10.0.0.1', 'pgtap')$$, 'signature client par lien');
select throws_ok($$select public.signer_par_lien((select val from _ctx where cle = 'token'), 'Client Test',
                   'data:image/png;base64,iVBORw0KGgo=', '10.0.0.1', 'pgtap')$$, '23514', null,
                 'lien de signature à usage unique');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select statut::text from public.devis where id = 'dd000000-0000-4000-8000-000000000010'),
          'signe', 'devis signé');
select throws_ok($$update public.devis_lignes set quantite = 1 where devis_id = 'dd000000-0000-4000-8000-000000000010'$$,
                 '42501', null, 'devis signé : lignes non modifiables');
select throws_ok($$update public.devis set objet = 'x' where id = 'dd000000-0000-4000-8000-000000000010'$$,
                 '42501', null, 'devis signé : devis non modifiable');
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009', 'en_lancement')$$,
                 '23514', null, 'lancement impossible sans acompte encaissé');

-- ---------------------------------------------------------------------------
-- Factures : numéro à l'émission, paiements, statut
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
insert into _ctx select 'acompte', public.creer_facture_depuis_devis('dd000000-0000-4000-8000-000000000010', 'acompte')::text;
select is((select numero from public.factures where id = (select val::uuid from _ctx where cle = 'acompte')),
          null, 'brouillon : pas de numéro');

insert into public.factures (id, organization_id, dossier_id, type)
values ('ff000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'mensuelle');
insert into public.facture_lignes (organization_id, facture_id, description, prix_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'ff000000-0000-4000-8000-000000000020', 'Test', 100);
delete from public.factures where id = 'ff000000-0000-4000-8000-000000000020';

select public.emettre_facture((select val::uuid from _ctx where cle = 'acompte'));
select is((select numero from public.factures where id = (select val::uuid from _ctx where cle = 'acompte')),
          (select val from _ctx where cle = 'fac_attendu'),
          'numéro attribué à l''émission, brouillon supprimé sans trou');
select is((select total_ttc from public.factures where id = (select val::uuid from _ctx where cle = 'acompte')),
          3062.40::numeric(14,2), 'acompte = 30 % du devis (TTC)');

insert into public.paiements (organization_id, facture_id, montant, mode, reference)
select 'a0000000-0000-4000-8000-000000000001', val::uuid, 1000, 'mpesa', 'MP-001' from _ctx where cle = 'acompte';
select is((select statut::text from public.factures where id = (select val::uuid from _ctx where cle = 'acompte')),
          'partiellement_payee', 'paiement partiel → partiellement payée');
select ok((select numero_recu like 'REC-%' from public.paiements
            where facture_id = (select val::uuid from _ctx where cle = 'acompte')), 'reçu REC numéroté');
select throws_ok($$insert into public.paiements (organization_id, facture_id, montant, mode, reference)
                   select 'a0000000-0000-4000-8000-000000000001', val::uuid, 5000, 'banque', 'X'
                   from _ctx where cle = 'acompte'$$, '23514', null, 'paiement supérieur au solde refusé');

insert into public.paiements (organization_id, facture_id, montant, mode, reference)
select 'a0000000-0000-4000-8000-000000000001', val::uuid, 2062.40, 'banque', 'VIR-001' from _ctx where cle = 'acompte';
select is((select statut::text from public.factures where id = (select val::uuid from _ctx where cle = 'acompte')),
          'payee', 'paiement total → payée');

-- ---------------------------------------------------------------------------
-- PV de lancement F-04
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009', 'en_lancement')$$,
                 '23514', null, 'lancement impossible sans PV signé');

insert into public.pv_lancement (id, organization_id, dossier_id, devis_id, perimetre_confirme, planning_confirme,
  interlocuteurs_confirmes, livrables_confirmes, acces_site_confirme, acompte_confirme)
values ('ee000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'dd000000-0000-4000-8000-000000000010', true, true, true, true, true, true);
select public.signer_pv('ee000000-0000-4000-8000-000000000001', 'atlas', 'Directeur Opérations', 'data:image/png;base64,iVBORw0KGgo=');
select public.signer_pv('ee000000-0000-4000-8000-000000000001', 'client', 'Client Test', 'data:image/png;base64,iVBORw0KGgo=');
select lives_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009', 'en_lancement')$$,
                'devis signé + acompte payé + PV signé → en_lancement');

-- ---------------------------------------------------------------------------
-- Normalisation DGI, solde, avoir
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
insert into _ctx select 'solde', public.creer_facture_depuis_devis('dd000000-0000-4000-8000-000000000010', 'solde')::text;
select throws_ok($$select public.emettre_facture((select val::uuid from _ctx where cle = 'solde'))$$, '23514', null,
                 'solde impossible tant que l''acompte n''est pas normalisé');
select public.normaliser_facture((select val::uuid from _ctx where cle = 'acompte'), 'FN-2026-0001', 'DEF-ABC-123', 'QR');
select lives_ok($$select public.emettre_facture((select val::uuid from _ctx where cle = 'solde'))$$,
                'solde émis après normalisation de l''acompte');
select public.emettre_avoir((select val::uuid from _ctx where cle = 'solde'), 145.60, 'Geste commercial');
select is((select solde_du from public.factures where id = (select val::uuid from _ctx where cle = 'solde')),
          7000.00::numeric(14,2), 'avoir : le solde dû diminue du montant de l''avoir');

-- Clôture
reset role;
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'receptionne_a_facturer' where id = 'f0000000-0000-4000-8000-000000000009';
select set_config('atlas.changement_statut', 'off', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
insert into public.paiements (organization_id, facture_id, montant, mode, reference)
select 'a0000000-0000-4000-8000-000000000001', val::uuid, 7000, 'banque', 'VIR-002' from _ctx where cle = 'solde';

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009', 'cloture')$$,
                 '23514', null, 'clôture impossible sans facture normalisée');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select public.normaliser_facture((select val::uuid from _ctx where cle = 'solde'), 'FN-2026-0002', 'DEF-DEF-456');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select lives_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009', 'cloture')$$,
                'clôture : factures normalisées et soldées');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select ok((select count(*) from public.devis) >= 3 and (select count(*) from public.factures) >= 3,
          'DAF : voit tous les devis et factures');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
select results_eq($$select id::text from public.devis$$,
                  $$values ('dd000000-0000-4000-8000-000000000001')$$,
                  'responsable_dossier : uniquement les devis de ses dossiers');
select results_eq($$select id::text from public.factures$$,
                  $$values ('ff000000-0000-4000-8000-000000000001')$$,
                  'responsable_dossier : uniquement les factures de ses dossiers');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select is((select count(*)::int from public.devis) + (select count(*)::int from public.factures)
          + (select count(*)::int from public.paiements) + (select count(*)::int from public.pv_lancement), 0,
          'agent_terrain : aucune donnée commerciale ou financière');

reset role;
select * from finish();
rollback;
