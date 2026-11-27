-- F-05, réception tacite et isolation des dossiers bloqués par le contrôle multidevise.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

create temp table _jetons (devis_id uuid primary key, token text);
grant all on _jetons to authenticated, service_role;
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'accepte' where id in (
  'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000009'
);
select set_config('atlas.changement_statut', 'off', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.devis (id, organization_id, dossier_id, objet)
select ('dd000000-0000-4000-8000-' || right(id::text, 12))::uuid, organization_id, id, 'Prestation de recette'
  from public.dossiers where id in (
    'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003',
    'f0000000-0000-4000-8000-000000000009'
  );
insert into public.devis_lignes (organization_id, devis_id, description, prix_unitaire)
select organization_id, id, 'Prestation', 100 from public.devis where objet = 'Prestation de recette';
select public.valider_devis(id) from public.devis where objet = 'Prestation de recette';
insert into _jetons select id, public.envoyer_devis(id) ->> 'token' from public.devis where objet = 'Prestation de recette';

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.signer_par_lien(token, 'Client Test', 'data:image/png;base64,iVBORw0KGgo=', null, 'pgtap') from _jetons;
reset role;

update public.organizations set parametres = jsonb_set(parametres, '{reception_tacite_jours}', '7')
where id = 'a0000000-0000-4000-8000-000000000001';
select set_config('atlas.changement_statut', 'on', true);
update public.dossiers set statut = 'livre',
  statut_change_le = now() - case when id = 'f0000000-0000-4000-8000-000000000004'
    then interval '6 days' else interval '9 days' end
where id in (
  'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002',
  'f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000004',
  'f0000000-0000-4000-8000-000000000009'
);
select set_config('atlas.changement_statut', 'off', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.contrats (organization_id, dossier_id, objet, statut, reception_tacite)
select organization_id, id, 'Contrat de recette', 'signe', id <> 'f0000000-0000-4000-8000-000000000002'
from public.dossiers where statut = 'livre';

insert into public.factures (id, organization_id, dossier_id, type, objet, devise)
values ('ee000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'mensuelle', 'Facture de recette mixte', 'CDF');
insert into public.facture_lignes (organization_id, facture_id, description, prix_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'ee000000-0000-4000-8000-000000000041', 'Service en CDF', 10000);
select public.emettre_facture('ee000000-0000-4000-8000-000000000041');

insert into public.pv_reception (id, organization_id, dossier_id, type, decision)
values ('ee000000-0000-4000-8000-000000000050', 'a0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000009', 'F05', 'sans_reserve');
select is((select count(*) from public.pv_reception_lignes where pv_id = 'ee000000-0000-4000-8000-000000000050'),
  9::bigint, 'F-05 : neuf points prédéfinis');
select throws_ok($$update public.pv_reception_lignes set libelle = 'Point modifié'
  where pv_id = 'ee000000-0000-4000-8000-000000000050'$$, '23514', null, 'F-05 : les intitulés sont fixes');
select throws_ok($$select public.signer_pv_reception('ee000000-0000-4000-8000-000000000050', 'atlas', 'Atlas',
  'data:image/png;base64,iVBORw0KGgo=')$$, '23514', 'Tous les points du PV doivent être renseignés', 'F-05 : checklist obligatoire');
update public.pv_reception_lignes set resultat = 'conforme' where pv_id = 'ee000000-0000-4000-8000-000000000050';
select public.signer_pv_reception('ee000000-0000-4000-8000-000000000050', 'atlas', 'Atlas', 'data:image/png;base64,iVBORw0KGgo=');
select lives_ok($$select public.signer_pv_reception('ee000000-0000-4000-8000-000000000050', 'client', 'Client Test',
  'data:image/png;base64,iVBORw0KGgo=')$$, 'F-05 : signatures Atlas et client après la checklist');
select throws_ok($$select public.receptions_tacites()$$, '42501', null, 'un compte utilisateur ne déclenche pas la tâche SQL');

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.receptions_tacites(), 1, 'une réception tacite, malgré le dossier multidevise bloqué');
select is(public.receptions_tacites(), 0, 'relancer la tâche ne réapplique pas la transition');

reset role;
select ok((select statut = 'livre' and not reception_tacite from public.dossiers
  where id = 'f0000000-0000-4000-8000-000000000001') and not exists (
    select 1 from public.factures where dossier_id = 'f0000000-0000-4000-8000-000000000001' and type = 'solde'
  ), 'le dossier USD/CDF reste livré et sans brouillon');
select ok((select statut = 'livre' from public.dossiers where id = 'f0000000-0000-4000-8000-000000000002'),
  'absence de clause : le dossier reste livré');
select ok((select statut = 'livre' from public.dossiers where id = 'f0000000-0000-4000-8000-000000000004'),
  'échéance non atteinte : le dossier reste livré');
select ok((select statut = 'livre' from public.dossiers where id = 'f0000000-0000-4000-8000-000000000009'),
  'le PV F-05 signé bloque la réception tacite');
select ok((select statut = 'receptionne_a_facturer' and reception_tacite from public.dossiers
  where id = 'f0000000-0000-4000-8000-000000000003') and exists (select 1 from public.dossier_status_history
  where dossier_id = 'f0000000-0000-4000-8000-000000000003' and motif like 'Réception tacite%'),
  'réception tacite enregistrée avec son motif');
select is((select total_ttc from public.factures where dossier_id = 'f0000000-0000-4000-8000-000000000003'
  and type = 'solde' and statut = 'brouillon'), 116::numeric, 'brouillon de solde de la réception tacite');

select * from finish();
rollback;
