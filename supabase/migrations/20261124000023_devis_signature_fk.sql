-- Phase 2 — Lien devis → signature (intégrité + jointure API)
alter table public.devis
  add constraint devis_signature_id_fkey foreign key (signature_id) references public.signatures (id) on delete restrict;
