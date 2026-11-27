-- Phase 3 — Exécution et réception : nouvelles valeurs d'énumérations
-- (migration séparée : une valeur ajoutée ne peut pas être utilisée dans la même transaction).

alter type public.app_permission add value if not exists 'missions.read_assigned';
alter type public.app_permission add value if not exists 'missions.report';
alter type public.app_permission add value if not exists 'execution.write';
alter type public.app_permission add value if not exists 'reception.write';

alter type public.signature_objet add value if not exists 'pv_reception';
alter type public.signature_objet add value if not exists 'rapport_intervention';

alter type public.document_type add value if not exists 'pv_reception';
alter type public.document_type add value if not exists 'rapport_intervention';
