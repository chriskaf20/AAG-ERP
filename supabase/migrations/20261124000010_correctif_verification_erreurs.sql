-- Correctif : ajout d'éléments au tableau d'erreurs avec array_append

create or replace function public.verification_erreurs(v public.verifications)
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
    e := array_append(e, 'Décision manquante');
  end if;
  if array_position(pts, null) is not null then
    e := array_append(e, 'Les 8 points doivent être évalués (conforme / non conforme)');
  end if;
  if v.decision = 'accepte' and false = any (pts) then
    e := array_append(e, 'Acceptation impossible : tous les points doivent être conformes');
  end if;
  if v.decision = 'complement_requis' and coalesce(trim(v.pieces_demandees), '') = '' then
    e := array_append(e, 'Pièces demandées obligatoires pour un complément');
  end if;
  if v.decision = 'refuse' and coalesce(trim(v.motif), '') = '' then
    e := array_append(e, 'Motif obligatoire pour un refus');
  end if;
  return e;
end;
$$;
