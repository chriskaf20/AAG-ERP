alter table public.bons_commande drop constraint bons_commande_statut_check;
alter table public.bons_commande add constraint bons_commande_statut_check check
  (statut in ('brouillon', 'a_valider', 'valide', 'emis', 'recu_partiel', 'recu', 'annule'));

create table public.receptions_achat (
  id uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bon_id uuid not null,
  date_reception date not null,
  reference text,
  observations text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, bon_id, id),
  foreign key (organization_id, bon_id) references public.bons_commande (organization_id, id) on delete restrict
);

create table public.reception_achat_lignes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bon_id uuid not null,
  reception_id uuid not null,
  ligne_id uuid not null,
  quantite numeric(14,3) not null check (quantite > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (reception_id, ligne_id),
  foreign key (organization_id, bon_id, reception_id) references public.receptions_achat (organization_id, bon_id, id) on delete restrict,
  foreign key (organization_id, bon_id, ligne_id) references public.bon_commande_lignes (organization_id, bon_id, id) on delete restrict
);

create index receptions_achat_bon_idx on public.receptions_achat (bon_id, date_reception);
create index receptions_achat_created_by_idx on public.receptions_achat (created_by);
create index reception_achat_lignes_bon_ligne_idx on public.reception_achat_lignes (bon_id, ligne_id);
create index reception_achat_lignes_created_by_idx on public.reception_achat_lignes (created_by);

create trigger receptions_achat_meta before insert on public.receptions_achat for each row execute function public.tg_meta();
create trigger reception_achat_lignes_meta before insert on public.reception_achat_lignes for each row execute function public.tg_meta();
create trigger audit after insert on public.receptions_achat for each row execute function public.tg_audit();
create trigger audit after insert on public.reception_achat_lignes for each row execute function public.tg_audit();

alter table public.receptions_achat enable row level security;
alter table public.reception_achat_lignes enable row level security;
revoke all on public.receptions_achat, public.reception_achat_lignes from anon, authenticated;
grant select on public.receptions_achat, public.reception_achat_lignes to authenticated;

create policy receptions_achat_select on public.receptions_achat for select to authenticated
  using (exists (select 1 from public.bons_commande b where b.id = bon_id and b.organization_id = receptions_achat.organization_id));
create policy reception_achat_lignes_select on public.reception_achat_lignes for select to authenticated
  using (exists (select 1 from public.receptions_achat r where r.id = reception_id and r.organization_id = reception_achat_lignes.organization_id));

create function public.receptionner_achat(
  p_org uuid, p_bon uuid, p_operation uuid, p_date date, p_reference text, p_observations text, p_lignes jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  bon public.bons_commande;
  ancienne public.receptions_achat;
  ligne record;
  demande jsonb;
  enregistree jsonb;
  restant numeric;
begin
  select * into bon from public.bons_commande b where b.id = p_bon and b.organization_id = p_org for update;
  if not found or not public.achat_autorise(p_org, bon.department_id, 'achats.write') then
    raise exception 'Réception réservée aux acheteurs habilités pour cette commande' using errcode = 'insufficient_privilege';
  end if;
  if p_operation is null or p_date is null or jsonb_typeof(p_lignes) is distinct from 'array' then
    raise exception 'Indiquez une date et les quantités reçues' using errcode = 'check_violation';
  end if;

  select jsonb_object_agg(ligne_id, round(quantite, 3)) into demande
    from jsonb_to_recordset(p_lignes) as l(ligne_id uuid, quantite numeric);
  if demande is null or (select count(*) from jsonb_object_keys(demande)) <> jsonb_array_length(p_lignes) then
    raise exception 'Indiquez une seule quantité par ligne réceptionnée' using errcode = 'check_violation';
  end if;
  select * into ancienne from public.receptions_achat where id = p_operation and bon_id = p_bon and organization_id = p_org;
  if found then
    select jsonb_object_agg(ligne_id, quantite) into enregistree from public.reception_achat_lignes where reception_id = p_operation;
    if ancienne.date_reception is distinct from p_date or ancienne.reference is distinct from nullif(trim(p_reference), '')
       or ancienne.observations is distinct from nullif(trim(p_observations), '') or enregistree is distinct from demande then
      raise exception 'Cette réception a déjà été enregistrée avec un autre contenu. Rechargez le bon.' using errcode = 'check_violation';
    end if;
    return ancienne.id;
  end if;
  if bon.statut not in ('emis', 'recu_partiel') then
    raise exception 'Réception possible seulement sur un bon émis avec des quantités restantes' using errcode = 'check_violation';
  end if;

  insert into public.receptions_achat(id, organization_id, bon_id, date_reception, reference, observations)
  values (p_operation, p_org, p_bon, p_date, nullif(trim(p_reference), ''), nullif(trim(p_observations), ''));
  for ligne in select key::uuid id, value::numeric quantite from jsonb_each_text(demande)
  loop
    select l.quantite - coalesce((
      select sum(r.quantite) from public.reception_achat_lignes r where r.bon_id = p_bon and r.ligne_id = l.id
    ), 0) into restant from public.bon_commande_lignes l where l.bon_id = p_bon and l.id = ligne.id;
    if restant is null or ligne.quantite is null or ligne.quantite <= 0 or ligne.quantite > restant then
      raise exception 'La quantité doit être positive, correspondre à une ligne du bon et ne pas dépasser le reste à recevoir'
        using errcode = 'check_violation';
    end if;
    insert into public.reception_achat_lignes(organization_id, bon_id, reception_id, ligne_id, quantite)
    values (p_org, p_bon, p_operation, ligne.id, ligne.quantite);
  end loop;

  update public.bons_commande set statut = case when exists (
    select 1 from public.bon_commande_lignes l where l.bon_id = p_bon
      and l.quantite > coalesce((select sum(r.quantite) from public.reception_achat_lignes r
        where r.bon_id = p_bon and r.ligne_id = l.id), 0)
  ) then 'recu_partiel' else 'recu' end where id = p_bon;
  return p_operation;
end;
$$;

revoke execute on function public.receptionner_achat(uuid, uuid, uuid, date, text, text, jsonb)
  from public, anon, service_role;
grant execute on function public.receptionner_achat(uuid, uuid, uuid, date, text, text, jsonb) to authenticated;
