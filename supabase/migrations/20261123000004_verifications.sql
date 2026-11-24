-- Phase 1 — Vérifications (fiche F-02)
-- 8 points : true = conforme, false = non conforme, null = non évalué.
-- Une vérification validée (signée) par le gérant n'est plus modifiable.

create type public.verification_decision as enum ('accepte', 'complement_requis', 'refuse');

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,

  identite_verifiee boolean,
  identite_verifiee_obs text,
  documents_valides boolean,
  documents_valides_obs text,
  coordonnees_confirmees boolean,
  coordonnees_confirmees_obs text,
  signataire_habilite boolean,
  signataire_habilite_obs text,
  activite_legale boolean,
  activite_legale_obs text,
  capacite_atlas boolean,
  capacite_atlas_obs text,
  capacite_paiement boolean,
  capacite_paiement_obs text,
  absence_conflit boolean,
  absence_conflit_obs text,

  observations text,
  decision public.verification_decision,
  pieces_demandees text,   -- obligatoire si complement_requis
  motif text,              -- obligatoire si refuse
  verifie_par uuid references public.profiles (id) on delete set null,
  verifie_le timestamptz,
  valide_par uuid references public.profiles (id) on delete set null,
  valide_le timestamptz,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint validation_complete check (
    (valide_par is null and valide_le is null)
    or (valide_par is not null and valide_le is not null and decision is not null)
  )
);

create index verifications_dossier_idx on public.verifications (dossier_id, created_at desc);

-- Une seule vérification non validée (brouillon) à la fois par dossier
create unique index verifications_un_brouillon
  on public.verifications (dossier_id) where valide_le is null;

create trigger verifications_meta before insert or update on public.verifications
  for each row execute function public.tg_meta();

create function public.tg_verifications_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.valide_le is not null then
      raise exception 'Une vérification validée ne peut pas être supprimée'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.valide_le is not null then
    raise exception 'Vérification validée : document signé, non modifiable'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.dossiers
                 where id = new.dossier_id and organization_id = new.organization_id) then
    raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
  end if;

  if auth.uid() is not null and not exists (
    select 1 from public.dossiers where id = new.dossier_id and statut = 'en_verification') then
    raise exception 'La vérification n''est possible que pour un dossier « en vérification »'
      using errcode = 'check_violation';
  end if;

  -- La validation (signature) ne passe que par valider_verification()
  if new.valide_le is not null
     and coalesce(current_setting('atlas.validation_verification', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'La validation se fait via valider_verification()'
      using errcode = 'insufficient_privilege';
  end if;

  -- Traçabilité du vérificateur
  if new.decision is not null and (tg_op = 'INSERT' or new.decision is distinct from old.decision) then
    new.verifie_par := coalesce(auth.uid(), new.verifie_par);
    new.verifie_le := case when auth.uid() is null then coalesce(new.verifie_le, now()) else now() end;
  elsif new.decision is null then
    new.verifie_par := null;
    new.verifie_le := null;
  end if;

  return new;
end;
$$;

create trigger verifications_guard before insert or update or delete on public.verifications
  for each row execute function public.tg_verifications_guard();

-- ---------------------------------------------------------------------------
-- Contrôle de complétude d'une vérification avant validation
-- ---------------------------------------------------------------------------
create function public.verification_erreurs(v public.verifications)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  e text[] := '{}';
  pts boolean[] := array[
    v.identite_verifiee, v.documents_valides, v.coordonnees_confirmees,
    v.signataire_habilite, v.activite_legale, v.capacite_atlas,
    v.capacite_paiement, v.absence_conflit
  ];
begin
  if v.decision is null then
    e := e || 'Décision manquante';
  end if;
  if array_position(pts, null) is not null then
    e := e || 'Les 8 points doivent être évalués (conforme / non conforme)';
  end if;
  if v.decision = 'accepte' and false = any (pts) then
    e := e || 'Acceptation impossible : tous les points doivent être conformes';
  end if;
  if v.decision = 'complement_requis' and coalesce(trim(v.pieces_demandees), '') = '' then
    e := e || 'Pièces demandées obligatoires pour un complément';
  end if;
  if v.decision = 'refuse' and coalesce(trim(v.motif), '') = '' then
    e := e || 'Motif obligatoire pour un refus';
  end if;
  return e;
end;
$$;
