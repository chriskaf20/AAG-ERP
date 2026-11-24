-- Données de test — Phase 2 : catalogue de services Atlas (prix indicatifs à ajuster)
insert into public.services (organization_id, department_id, nom, unite, prix_base_usd) values
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000d', 'Site web', 'forfait', 1500),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000d', 'Vidéo publicitaire', 'forfait', 800),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000d', 'Campagne Google / réseaux sociaux', 'mois', 500),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000d', 'Fiche Google (Google Business Profile)', 'forfait', 150),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000d', 'Accompagnement mensuel', 'mois', 400),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b', 'Prado avec chauffeur', 'jour', 250),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b', 'Course berline', 'course', 40),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000c', 'Entretien de site', 'mois', 600),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000c', 'Intervention de nettoyage', 'm2', 2),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'Étude de faisabilité', 'forfait', 3000),
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000c', 'Recrutement', 'forfait', 700)
on conflict (organization_id, nom) do nothing;
