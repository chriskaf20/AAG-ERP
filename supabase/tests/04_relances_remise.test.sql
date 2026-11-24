-- Tests Phase 2 — garde-fous des relances et remise des factures au client (nécessite seed.sql)
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

-- Factures émises sur le dossier 009 (contact …05, email en .test) : solde en retard de 35 jours, acompte
select set_config('atlas.finance_systeme', 'on', true);
insert into public.factures (id, organization_id, dossier_id, type)
values ('ff000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009', 'solde'),
       ('ff000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009', 'acompte');
insert into public.facture_lignes (organization_id, facture_id, description, prix_unitaire)
values ('a0000000-0000-4000-8000-000000000001', 'ff000000-0000-4000-8000-000000000031', 'Solde', 1000),
       ('a0000000-0000-4000-8000-000000000001', 'ff000000-0000-4000-8000-000000000032', 'Acompte', 500);
update public.factures set statut = 'emise', numero = 'FAC-TEST-031', date_emission = current_date - 50, echeance = current_date - 35
 where id = 'ff000000-0000-4000-8000-000000000031';
update public.factures set statut = 'emise', numero = 'FAC-TEST-032', date_emission = current_date, echeance = current_date + 15
 where id = 'ff000000-0000-4000-8000-000000000032';
select public.facture_recalculer('ff000000-0000-4000-8000-000000000031');
select set_config('atlas.finance_systeme', 'off', true);

-- ---------------------------------------------------------------------------
-- Relances
-- ---------------------------------------------------------------------------
select is((select parametres -> 'relances_actives' from public.organizations
           where id = 'a0000000-0000-4000-8000-000000000001'), 'false'::jsonb,
          'relances désactivées par défaut');
select is(jsonb_array_length(public.relances_a_envoyer()), 0, 'relances désactivées : rien à envoyer');

update public.organizations set parametres = parametres || '{"relances_actives": true}'
 where id = 'a0000000-0000-4000-8000-000000000001';
select is(jsonb_array_length(public.relances_a_envoyer()), 0, 'adresse en .test : jamais relancée');

update public.contacts set email = 'compta@clinique-exemple.com' where id = 'e0000000-0000-4000-8000-000000000005';
select is(jsonb_array_length(public.relances_a_envoyer()), 1, 'facture en retard avec email réel : 1 relance');
select ok((public.relances_a_envoyer() -> 0 ->> 'simulation')::boolean, 'mode simulation par défaut');
select is(public.relances_a_envoyer() -> 0 ->> 'niveau', 'j30', 'niveau J+30 après 35 jours de retard');

select public.enregistrer_relance('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009',
  'facture', 'ff000000-0000-4000-8000-000000000031', 'j30', 'compta@clinique-exemple.com', 'simulee');
select is(jsonb_array_length(public.relances_a_envoyer()), 0, 'relance simulée tracée : pas de doublon');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$update public.organizations set parametres = parametres || '{"relances_mode": "reel"}'
                   where id = 'a0000000-0000-4000-8000-000000000001'$$, '42501', null,
                 'administrateur : ne peut pas modifier les relances');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok($$update public.organizations set parametres = parametres || '{"relances_actives": false}'
                  where id = 'a0000000-0000-4000-8000-000000000001'$$,
                'gérant : peut désactiver les relances');

-- ---------------------------------------------------------------------------
-- Remise au client
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select throws_ok($$select public.marquer_facture_remise('ff000000-0000-4000-8000-000000000031')$$, '23514', null,
                 'facture de solde non normalisée : remise au client impossible');
select public.normaliser_facture('ff000000-0000-4000-8000-000000000031', 'FN-TEST-31', 'DEF-TEST-31');
select lives_ok($$select public.marquer_facture_remise('ff000000-0000-4000-8000-000000000031')$$,
                'facture de solde normalisée : remise au client');

reset role;
select * from finish();
rollback;
