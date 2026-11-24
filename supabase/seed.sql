-- Données de test — Phase 1 (développement uniquement)
-- Mot de passe commun des comptes de test : AtlasTest2026!

-- ---------------------------------------------------------------------------
-- Organisation et départements
-- ---------------------------------------------------------------------------
insert into public.organizations (id, nom, sigle, rccm, nif, id_nat, adresse, telephone, email, logo_path, prefixe_dossier)
values (
  'a0000000-0000-4000-8000-000000000001',
  'ATLAS AFRICA GROUP SARL', 'AAG',
  'CD/LSH/RCCM/00-B-00000', 'A0000000X', '0-000-N00000X',
  'Lubumbashi, Haut-Katanga, RDC', '+243 000 000 000', 'contact@atlasafricagroup.com',
  '/logo.png', 'AAG'
);

insert into public.departments (id, organization_id, code, nom) values
  ('d0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'AFF', 'Affaires et projets'),
  ('d0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000001', 'SUP', 'Supply et logistique'),
  ('d0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001', 'PEF', 'People et Facilities'),
  ('d0000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-000000000001', 'DIG', 'Digital et technologies');

-- ---------------------------------------------------------------------------
-- Utilisateurs (un par rôle)
-- ---------------------------------------------------------------------------
with u(id, email, nom) as (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'admin@atlas-erp.test',          'Admin Système'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'gerant@atlas-erp.test',         'Gérant Test'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'associe@atlas-erp.test',        'Associé Test'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'dir.commercial@atlas-erp.test', 'Directeur Commercial Test'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'dir.operations@atlas-erp.test', 'Directeur Opérations Test'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 'daf@atlas-erp.test',            'DAF Test'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 'resp.aff@atlas-erp.test',       'Responsable AFF Test'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 'resp.dossier@atlas-erp.test',   'Responsable Dossier Test'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 'acheteur@atlas-erp.test',       'Acheteur Test'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 'rh@atlas-erp.test',             'Responsable RH Test'),
  ('10000000-0000-4000-8000-000000000011'::uuid, 'agent@atlas-erp.test',          'Agent Terrain Test'),
  ('10000000-0000-4000-8000-000000000012'::uuid, 'client@atlas-erp.test',         'Client Portail Test')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('AtlasTest2026!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nom_complet', u.nom), now(), now(),
  '', '', '', '', '', '', '', ''
from u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users where email like '%@atlas-erp.test';

update public.profiles
   set organization_id = 'a0000000-0000-4000-8000-000000000001'
 where email like '%@atlas-erp.test';

insert into public.user_roles (organization_id, user_id, role, department_id) values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin_systeme', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'gerant', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'associe', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'directeur_commercial', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'directeur_operations', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'daf', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'responsable_departement', 'd0000000-0000-4000-8000-00000000000a'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000008', 'responsable_dossier', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'acheteur', 'd0000000-0000-4000-8000-00000000000b'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000010', 'responsable_rh', 'd0000000-0000-4000-8000-00000000000c'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', 'agent_terrain', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000012', 'client', null);

-- ---------------------------------------------------------------------------
-- Clients fictifs et contacts
-- ---------------------------------------------------------------------------
insert into public.clients (id, organization_id, type, raison_sociale, rccm, nif, id_nat, adresse, telephone, email, created_by) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'entreprise',
   'Mines Exemple du Haut-Katanga SARL', 'CD/LSH/RCCM/21-B-00101', 'A2100101K', '6-118-N10101K',
   'Avenue de la Révolution, Lubumbashi', '+243 990 000 101', 'achats@mines-exemple.test', '10000000-0000-4000-8000-000000000004'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'entreprise',
   'Lubum Transit & Logistique SARL', 'CD/LSH/RCCM/19-B-00202', 'A1900202L', '6-118-N20202L',
   'Route Kasenga, Lubumbashi', '+243 990 000 202', 'contact@lubum-transit.test', '10000000-0000-4000-8000-000000000004'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'entreprise',
   'Groupe Hôtelier Exemple SA', 'CD/LSH/RCCM/17-B-00303', 'A1700303H', '6-118-N30303H',
   'Boulevard Kamanyola, Lubumbashi', '+243 990 000 303', 'direction@hotel-exemple.test', '10000000-0000-4000-8000-000000000004'),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'entreprise',
   'Clinique Exemple Bel-Air', 'CD/LSH/RCCM/22-B-00404', 'A2200404C', '6-118-N40404C',
   'Quartier Bel-Air, Lubumbashi', '+243 990 000 404', 'admin@clinique-exemple.test', '10000000-0000-4000-8000-000000000004'),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'particulier',
   'Patrick Exemple Kabeya', null, null, null,
   'Commune Annexe, Lubumbashi', '+243 990 000 505', 'p.exemple@mail.test', '10000000-0000-4000-8000-000000000004');

insert into public.contacts (id, organization_id, client_id, nom, fonction, telephone, email, est_signataire) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Sarah Exemple Mwamba', 'Directrice des achats', '+243 990 100 101', 's.mwamba@mines-exemple.test', true),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Didier Exemple Banza', 'Ingénieur maintenance', '+243 990 100 102', 'd.banza@mines-exemple.test', false),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'Joseph Exemple Kalenga', 'Gérant', '+243 990 100 201', 'j.kalenga@lubum-transit.test', true),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
   'Aline Exemple Ngoy', 'Directrice générale', '+243 990 100 301', 'a.ngoy@hotel-exemple.test', true),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004',
   'Dr Marc Exemple Tshibangu', 'Directeur médical', '+243 990 100 401', 'm.tshibangu@clinique-exemple.test', true),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005',
   'Patrick Exemple Kabeya', 'Particulier', '+243 990 000 505', 'p.exemple@mail.test', true);

-- ---------------------------------------------------------------------------
-- 10 dossiers (numérotés AAG-2026-001 à 010 par le trigger, dans l'ordre)
-- AFF = …0a, SUP = …0b, PEF = …0c, DIG = …0d
-- resp.dossier (…08) : dossiers 1, 3, 4, 7   — agent (…11) affecté aux dossiers 3 et 6
-- ---------------------------------------------------------------------------
insert into public.dossiers (id, organization_id, date_reception, canal, client_id, contact_id, service, besoin,
  delai_souhaite, budget_indicatif, department_id, responsable_id, pieces_recues, accuse_reception_envoye,
  statut, statut_motif, statut_change_le, created_by)
select x.id::uuid, 'a0000000-0000-4000-8000-000000000001', x.date_rec::date, x.canal::public.canal_reception,
       x.client::uuid, x.contact::uuid, x.service, x.besoin, x.delai::date, x.budget,
       x.dept::uuid, x.resp::uuid, x.pieces::public.piece_type[], x.ar, x.statut::public.dossier_statut,
       x.motif, x.change_le::timestamptz, '10000000-0000-4000-8000-000000000004'
from (values
  ('f0000000-0000-4000-8000-000000000001', '2026-09-02', 'visite',   'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
   'Maintenance industrielle', 'Révision de deux groupes électrogènes 500 kVA sur site.', '2026-12-15', 18000,
   'd0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000008', '{rccm,nif,id_nat}', true, 'nouveau', null, null),
  ('f0000000-0000-4000-8000-000000000002', '2026-09-10', 'email',    'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003',
   'Transport et dédouanement', 'Acheminement de 3 conteneurs depuis Durban jusqu''à Lubumbashi.', '2026-11-30', 9500,
   'd0000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000005', '{rccm}', false, 'nouveau', null, null),
  ('f0000000-0000-4000-8000-000000000003', '2026-09-18', 'appel',    'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
   'Fourniture d''équipements', 'Fourniture de pièces de rechange pour concasseurs.', '2026-12-01', 42000,
   'd0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000008', '{rccm,nif,id_nat,piece_identite}', true, 'en_verification', null, '2026-09-20 09:00+01'),
  ('f0000000-0000-4000-8000-000000000004', '2026-09-25', 'whatsapp', 'c0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000004',
   'Aménagement', 'Rénovation de 12 chambres et du hall d''accueil.', '2027-02-28', 65000,
   'd0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000008', '{rccm,nif}', true, 'complement_requis', 'Id. Nat. et pièce d''identité du signataire', '2026-10-01 10:00+01'),
  ('f0000000-0000-4000-8000-000000000005', '2026-10-03', 'site_web', 'c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000005',
   'Approvisionnement médical', 'Fourniture de consommables médicaux trimestrielle.', '2026-12-20', 12500,
   'd0000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000009', '{rccm,nif,id_nat,piece_identite}', true, 'accepte', null, '2026-10-10 15:00+01'),
  ('f0000000-0000-4000-8000-000000000006', '2026-10-08', 'visite',   'c0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000004',
   'Services généraux', 'Contrat de nettoyage et d''entretien des espaces verts.', '2027-01-15', 7800,
   'd0000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-000000000010', '{rccm,nif,id_nat,piece_identite}', true, 'en_verification', null, '2026-10-12 08:30+01'),
  ('f0000000-0000-4000-8000-000000000007', '2026-10-14', 'email',    'c0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000006',
   'Construction', 'Construction d''une clôture et d''un portail.', '2027-03-01', 6000,
   'd0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000008', '{piece_identite}', true, 'refuse', 'Capacité de paiement non démontrée', '2026-10-20 11:00+01'),
  ('f0000000-0000-4000-8000-000000000008', '2026-10-22', 'appel',    'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003',
   'Entreposage', 'Location d''un entrepôt de 500 m² pour 6 mois.', '2026-12-01', 15000,
   'd0000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000009', '{rccm,nif,id_nat}', false, 'classe_sans_suite', 'Le client a trouvé une autre solution', '2026-10-28 14:00+01'),
  ('f0000000-0000-4000-8000-000000000009', '2026-11-04', 'site_web', 'c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000005',
   'Informatique', 'Mise en place d''un réseau et de 20 postes de travail.', '2027-01-31', 28000,
   'd0000000-0000-4000-8000-00000000000d', '10000000-0000-4000-8000-000000000005', '{rccm,nif,id_nat,piece_identite}', true, 'accepte', null, '2026-11-12 16:00+01'),
  ('f0000000-0000-4000-8000-000000000010', '2026-11-18', 'whatsapp', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
   'Étude', 'Étude de faisabilité pour une base vie de 80 personnes.', '2027-02-15', 35000,
   'd0000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000007', '{rccm,nif,id_nat}', true, 'nouveau', null, null)
) as x(id, date_rec, canal, client, contact, service, besoin, delai, budget, dept, resp, pieces, ar, statut, motif, change_le)
order by x.id;

insert into public.dossier_affectations (organization_id, dossier_id, user_id) values
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000011'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000011');

-- Vérifications validées pour les dossiers ayant reçu une décision
insert into public.verifications (organization_id, dossier_id,
  identite_verifiee, documents_valides, coordonnees_confirmees, signataire_habilite,
  activite_legale, capacite_atlas, capacite_paiement, absence_conflit,
  observations, decision, pieces_demandees, motif, verifie_par, verifie_le, valide_par, valide_le)
values
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004',
   true, false, true, false, true, true, true, true,
   'Pièces incomplètes', 'complement_requis', 'Id. Nat. et pièce d''identité du signataire', null,
   '10000000-0000-4000-8000-000000000008', '2026-09-30 16:00+01', '10000000-0000-4000-8000-000000000002', '2026-10-01 10:00+01'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000005',
   true, true, true, true, true, true, true, true,
   'Dossier complet', 'accepte', null, null,
   '10000000-0000-4000-8000-000000000009', '2026-10-09 12:00+01', '10000000-0000-4000-8000-000000000002', '2026-10-10 15:00+01'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007',
   true, true, true, true, true, true, false, true,
   'Aucune garantie de paiement', 'refuse', null, 'Capacité de paiement non démontrée',
   '10000000-0000-4000-8000-000000000008', '2026-10-19 09:00+01', '10000000-0000-4000-8000-000000000002', '2026-10-20 11:00+01'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009',
   true, true, true, true, true, true, true, true,
   'Dossier complet', 'accepte', null, null,
   '10000000-0000-4000-8000-000000000005', '2026-11-11 10:00+01', '10000000-0000-4000-8000-000000000002', '2026-11-12 16:00+01');

-- Historique des statuts cohérent avec l'état des dossiers
insert into public.dossier_status_history (organization_id, dossier_id, ancien_statut, nouveau_statut, motif, created_at, created_by)
select 'a0000000-0000-4000-8000-000000000001', h.dossier::uuid, h.ancien::public.dossier_statut,
       h.nouveau::public.dossier_statut, h.motif, h.le::timestamptz, h.par::uuid
from (values
  ('f0000000-0000-4000-8000-000000000003', 'nouveau', 'en_verification', null, '2026-09-20 09:00+01', '10000000-0000-4000-8000-000000000008'),
  ('f0000000-0000-4000-8000-000000000004', 'nouveau', 'en_verification', null, '2026-09-27 09:00+01', '10000000-0000-4000-8000-000000000008'),
  ('f0000000-0000-4000-8000-000000000004', 'en_verification', 'complement_requis', 'Id. Nat. et pièce d''identité du signataire', '2026-10-01 10:00+01', '10000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000005', 'nouveau', 'en_verification', null, '2026-10-05 09:00+01', '10000000-0000-4000-8000-000000000009'),
  ('f0000000-0000-4000-8000-000000000005', 'en_verification', 'accepte', null, '2026-10-10 15:00+01', '10000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000006', 'nouveau', 'en_verification', null, '2026-10-12 08:30+01', '10000000-0000-4000-8000-000000000010'),
  ('f0000000-0000-4000-8000-000000000007', 'nouveau', 'en_verification', null, '2026-10-16 09:00+01', '10000000-0000-4000-8000-000000000008'),
  ('f0000000-0000-4000-8000-000000000007', 'en_verification', 'refuse', 'Capacité de paiement non démontrée', '2026-10-20 11:00+01', '10000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000008', 'nouveau', 'classe_sans_suite', 'Le client a trouvé une autre solution', '2026-10-28 14:00+01', '10000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000009', 'nouveau', 'en_verification', null, '2026-11-06 09:00+01', '10000000-0000-4000-8000-000000000005'),
  ('f0000000-0000-4000-8000-000000000009', 'en_verification', 'accepte', null, '2026-11-12 16:00+01', '10000000-0000-4000-8000-000000000002')
) as h(dossier, ancien, nouveau, motif, le, par);
