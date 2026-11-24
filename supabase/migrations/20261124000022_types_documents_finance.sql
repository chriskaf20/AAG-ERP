-- Phase 2 — Types de documents générés (PDF figés après signature)
alter type public.document_type add value if not exists 'devis';
alter type public.document_type add value if not exists 'facture';
alter type public.document_type add value if not exists 'contrat';
alter type public.document_type add value if not exists 'pv_lancement';
alter type public.document_type add value if not exists 'recu';
