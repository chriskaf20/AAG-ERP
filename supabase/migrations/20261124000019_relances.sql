-- Phase 2 — Relances (devis J+7 ; factures J+7, J+15, J+30 après échéance)

create type public.relance_niveau as enum ('j7', 'j15', 'j30');

create table public.relances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  objet_type text not null check (objet_type in ('devis', 'facture')),
  objet_id uuid not null,
  niveau public.relance_niveau not null,
  canal text not null default 'email' check (canal in ('email')),
  destinataire text,
  statut text not null check (statut in ('envoyee', 'echec')),
  erreur text,
  envoyee_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Une relance réussie par objet et par niveau ; les échecs peuvent être retentés
create unique index relances_unique_envoyee on public.relances (objet_type, objet_id, niveau)
  where statut = 'envoyee';
create index relances_dossier_idx on public.relances (dossier_id, envoyee_le desc);

create trigger relances_meta before insert or update on public.relances
  for each row execute function public.tg_meta();
