-- Phase 2 — Paiements et reçus (REC-AAAA-NNN) ; statut de facture recalculé automatiquement

create type public.paiement_mode as enum ('banque', 'mpesa', 'airtel_money', 'orange_money', 'especes');

create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  facture_id uuid not null references public.factures (id) on delete restrict,
  dossier_id uuid references public.dossiers (id) on delete restrict,
  numero_recu text not null default '',
  montant numeric(14, 2) not null check (montant > 0),
  devise public.devise not null default 'USD',
  mode public.paiement_mode not null,
  reference text,
  date_paiement date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, numero_recu),
  check (mode = 'especes' or reference is not null)
);

create index paiements_facture_idx on public.paiements (facture_id);
create index paiements_date_idx on public.paiements (organization_id, date_paiement desc);

create trigger paiements_meta before insert or update on public.paiements
  for each row execute function public.tg_meta();

create function public.tg_paiements_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.factures;
begin
  select * into f from public.factures where id = new.facture_id for update;
  if f.id is null or f.organization_id <> new.organization_id then
    raise exception 'Facture invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  if f.statut in ('brouillon', 'annulee') then
    raise exception 'Paiement impossible sur une facture %', f.statut using errcode = 'check_violation';
  end if;
  if new.devise <> f.devise then
    raise exception 'Le paiement doit être dans la devise de la facture (%)', f.devise
      using errcode = 'check_violation';
  end if;
  if new.montant > f.solde_du then
    raise exception 'Montant supérieur au solde dû (%)', f.solde_du using errcode = 'check_violation';
  end if;
  new.dossier_id := f.dossier_id;
  new.numero_recu := public.prochain_numero(new.organization_id, 'REC', new.date_paiement);
  return new;
end;
$$;

create trigger paiements_before before insert on public.paiements
  for each row execute function public.tg_paiements_before();

create trigger paiements_immuable before update or delete on public.paiements
  for each row execute function public.tg_immuable();

create function public.tg_paiements_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.facture_recalculer(new.facture_id);
  return null;
end;
$$;

create trigger paiements_after after insert on public.paiements
  for each row execute function public.tg_paiements_after();

create function public.tg_avoirs_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.facture_recalculer(new.facture_id);
  return null;
end;
$$;

create trigger avoirs_after after insert on public.avoirs
  for each row execute function public.tg_avoirs_after();
