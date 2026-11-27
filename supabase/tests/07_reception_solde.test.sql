-- Réception F-06, réserves, avoir sur l'acompte, avenants et clôture.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);
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
select is((select total_ttc from public.devis where id = 'dd000000-0000-4000-8000-000000000010'),
          7250.00::numeric, 'devis TTC de départ');
select public.valider_devis('dd000000-0000-4000-8000-000000000010');
insert into _ctx select 'devis_token', public.envoyer_devis('dd000000-0000-4000-8000-000000000010') ->> 'token';

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.signer_par_lien((select val from _ctx where cle = 'devis_token'), 'Client Test',
                              'data:image/png;base64,iVBORw0KGgo=', null, 'pgtap');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into _ctx select 'acompte', public.creer_facture_depuis_devis('dd000000-0000-4000-8000-000000000010', 'acompte')::text;
select public.emettre_facture((select val::uuid from _ctx where cle = 'acompte'));
select is((select total_ttc from public.factures where id = (select val::uuid from _ctx where cle = 'acompte')),
          2175.00::numeric, 'acompte TTC à 30 %');
select public.emettre_avoir((select val::uuid from _ctx where cle = 'acompte'), 500, 'Réduction de l’acompte');
select is((select montant_avoirs from public.factures where id = (select val::uuid from _ctx where cle = 'acompte')),
          500.00::numeric, 'avoir déduit de l’acompte déjà facturé');
select public.normaliser_facture((select val::uuid from _ctx where cle = 'acompte'), 'FN-ACOMPTE-07', 'DEF-ACOMPTE-07');
insert into public.paiements (organization_id, facture_id, montant, mode, reference)
select 'a0000000-0000-4000-8000-000000000001', val::uuid, 1675, 'banque', 'VIR-ACOMPTE-07' from _ctx where cle = 'acompte';

-- État livré pour isoler le circuit de réception. Les transitions d'exécution sont testées dans 06.
reset role;
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'livre', statut_change_le = clock_timestamp()
 where id = 'f0000000-0000-4000-8000-000000000009';
select set_config('atlas.changement_statut', 'off', true);
set local role authenticated;

insert into public.pv_reception (id, organization_id, dossier_id, type)
values ('ee000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'F06');
select throws_ok($$select public.refuser_reception('ee000000-0000-4000-8000-000000000010', '  ')$$,
                 '23514', 'Motif du refus obligatoire', 'refus sans motif bloqué');
select is((public.refuser_reception('ee000000-0000-4000-8000-000000000010', 'Contrôle du livrable à reprendre')).statut::text,
          'en_cours', 'refus motivé : retour en cours');
select ok((select refuse_le is not null and motif_refus = 'Contrôle du livrable à reprendre'
             from public.pv_reception where id = 'ee000000-0000-4000-8000-000000000010'), 'refus archivé sur le PV');

reset role;
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'livre', statut_change_le = clock_timestamp()
 where id = 'f0000000-0000-4000-8000-000000000009';
select set_config('atlas.changement_statut', 'off', true);
set local role authenticated;

insert into public.pv_reception (id, organization_id, dossier_id, type, decision, date_limite_reserves, satisfaction)
values ('ee000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'F06', 'avec_reserves', current_date + 7, 4);
select is((select version from public.pv_reception where id = 'ee000000-0000-4000-8000-000000000011'),
          2, 'nouvelle version du PV après refus');
insert into public.pv_reception_lignes (organization_id, pv_id, libelle, resultat)
values ('a0000000-0000-4000-8000-000000000001', 'ee000000-0000-4000-8000-000000000011', 'Poser le marquage', 'non_realise');
select throws_ok($$select public.signer_pv_reception('ee000000-0000-4000-8000-000000000011', 'atlas', 'Atlas',
                  'data:image/png;base64,iVBORw0KGgo=')$$, '23514', null, 'PV avec réserves : détail obligatoire');
insert into public.reserves (id, organization_id, dossier_id, pv_id, description)
values ('ee000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'ee000000-0000-4000-8000-000000000011', 'Poser le marquage');
select throws_ok($$select public.creer_lien_pv_reception('ee000000-0000-4000-8000-000000000011')$$,
                 '23514', null, 'lien client : signature Atlas préalable');
select lives_ok($$select public.signer_pv_reception('ee000000-0000-4000-8000-000000000011', 'atlas', 'Atlas',
                  'data:image/png;base64,iVBORw0KGgo=')$$, 'PV signé par Atlas');
select throws_ok($$update public.pv_reception_lignes set libelle = 'Réécrit' where pv_id = 'ee000000-0000-4000-8000-000000000011'$$,
                 '42501', null, 'texte figé dès la première signature');

insert into _ctx select 'pv_token', public.creer_lien_pv_reception('ee000000-0000-4000-8000-000000000011');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.lien_signature_info((select val from _ctx where cle = 'pv_token')) ->> 'objet_type',
          'pv_reception', 'lien public associé au PV de réception');
select lives_ok($$select public.signer_par_lien((select val from _ctx where cle = 'pv_token'), 'Client Test',
                  'data:image/png;base64,iVBORw0KGgo=', null, 'pgtap')$$, 'PV signé par le client via lien');
select throws_ok($$select public.signer_par_lien((select val from _ctx where cle = 'pv_token'), 'Client Test',
                   'data:image/png;base64,iVBORw0KGgo=', null, 'pgtap')$$, '23514', null, 'lien PV à usage unique');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009','receptionne_a_facturer')$$,
                 '23514', null, 'réception bloquée tant que la réserve est ouverte');
select lives_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009','reserves')$$,
                'passage avec réserves');
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009','receptionne_a_facturer')$$,
                 '23514', null, 'réserve ouverte bloquante après le changement de statut');
select is((public.lever_reserve('ee000000-0000-4000-8000-000000000020', 'Marquage posé')).statut,
          'levee', 'réserve levée');
select lives_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009','receptionne_a_facturer')$$,
                'réception après levée de la réserve');
insert into _ctx select 'solde', id::text from public.factures
 where dossier_id = 'f0000000-0000-4000-8000-000000000009' and type = 'solde' and statut = 'brouillon';
select is((select total_ttc from public.factures where id = (select val::uuid from _ctx where cle = 'solde')),
          5575.00::numeric, 'solde automatique : 7 250 − (2 175 − 500) = 5 575');
select is((select count(*) from public.factures where dossier_id = 'f0000000-0000-4000-8000-000000000009' and type = 'solde'),
          1::bigint, 'un seul brouillon de solde généré');
select ok((select receptionne_le is not null and garantie_fin >= current_date
             from public.dossiers where id = 'f0000000-0000-4000-8000-000000000009'), 'réception et garantie enregistrées');

insert into public.contrats (id, organization_id, dossier_id, devis_id, objet, statut)
values ('ee000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'dd000000-0000-4000-8000-000000000010', 'Contrat de travaux', 'signe');
insert into public.avenants (organization_id, contrat_id, objet, montant_delta, statut) values
 ('a0000000-0000-4000-8000-000000000001', 'ee000000-0000-4000-8000-000000000030', 'Travaux en plus', 800, 'signe'),
 ('a0000000-0000-4000-8000-000000000001', 'ee000000-0000-4000-8000-000000000030', 'Travaux retirés', -125, 'signe'),
 ('a0000000-0000-4000-8000-000000000001', 'ee000000-0000-4000-8000-000000000030', 'Avenant en préparation', 999, 'brouillon');
reset role;
select public.generer_facture_solde('f0000000-0000-4000-8000-000000000009');
set local role authenticated;
select is((select total_ttc from public.factures where id = (select val::uuid from _ctx where cle = 'solde')),
          6250.00::numeric, 'avenants signés : + 800 − 125, brouillon ignoré');

select public.emettre_facture((select val::uuid from _ctx where cle = 'solde'));
select public.normaliser_facture((select val::uuid from _ctx where cle = 'solde'), 'FN-SOLDE-07', 'DEF-SOLDE-07');
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009','cloture')$$,
                 '23514', 'Clôture impossible : factures non soldées', 'clôture bloquée par le solde dû');
insert into public.paiements (organization_id, facture_id, montant, mode, reference)
select 'a0000000-0000-4000-8000-000000000001', val::uuid, 6250, 'banque', 'VIR-SOLDE-07' from _ctx where cle = 'solde';
select throws_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009','cloture')$$,
                 '23514', 'Clôture impossible : l''avis du client (note de 1 à 5) doit être saisi', 'avis obligatoire');
insert into public.avis_clients (organization_id, dossier_id, note, commentaire)
values ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009', 4, 'Réserve bien traitée');
select lives_ok($$select public.change_dossier_status('f0000000-0000-4000-8000-000000000009','cloture')$$,
                'clôture après normalisation, paiement et avis client');
select is((select statut::text from public.dossiers where id = 'f0000000-0000-4000-8000-000000000009'),
          'cloture', 'dossier clôturé');

reset role;
select * from finish();
rollback;
