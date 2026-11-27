-- Phase 3 — PV de réception : F-05 (site web, 9 points) et F-06 (prestation, lignes libres),
-- réserves. Un PV signé ou refusé est définitif : une correction = nouveau PV (version suivante).

create table public.pv_reception (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  type text not null check (type in ('F05', 'F06')),
  version integer not null default 1,
  date_reception date not null default current_date,
  lieu text,
  observations text,
  decision text check (decision in ('sans_reserve', 'avec_reserves', 'refus')),
  date_limite_reserves date,
  motif_refus text,
  satisfaction smallint check (satisfaction between 1 and 5),
  signature_atlas_id uuid references public.signatures (id) on delete restrict,
  signature_client_id uuid references public.signatures (id) on delete restrict,
  signe_le timestamptz,
  refuse_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (dossier_id, version),
  check (signe_le is null or refuse_le is null)
);

create index pv_reception_org_fk_idx on public.pv_reception (organization_id);
create index pv_reception_sig_atlas_fk_idx on public.pv_reception (signature_atlas_id);
create index pv_reception_sig_client_fk_idx on public.pv_reception (signature_client_id);
create index pv_reception_created_by_fk_idx on public.pv_reception (created_by);
-- Un seul PV en cours par dossier
create unique index pv_reception_un_ouvert on public.pv_reception (dossier_id)
  where signe_le is null and refuse_le is null;

create trigger pv_reception_meta before insert or update on public.pv_reception
  for each row execute function public.tg_meta();

create function public.tg_pv_reception_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_systeme boolean := coalesce(current_setting('atlas.execution_systeme', true), '') = 'on';
  v_statut public.dossier_statut;
begin
  if tg_op = 'DELETE' then
    if (old.signature_atlas_id is not null or old.signature_client_id is not null or old.refuse_le is not null)
       and exists (select 1 from public.dossiers where id = old.dossier_id) then
      raise exception 'PV de réception signé ou refusé : suppression interdite' using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    select statut into v_statut from public.dossiers
     where id = new.dossier_id and organization_id = new.organization_id for update;
    if not found then
      raise exception 'Dossier invalide pour cette organisation' using errcode = 'check_violation';
    end if;
    if v_statut <> 'livre' then
      raise exception 'Le PV de réception s''établit sur un dossier livré' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.pv_reception where dossier_id = new.dossier_id and refuse_le is null) then
      raise exception 'Un PV existe déjà pour la réception de ce dossier' using errcode = 'unique_violation';
    end if;
    new.version := coalesce((select max(version) from public.pv_reception where dossier_id = new.dossier_id), 0) + 1;
    new.signature_atlas_id := null; new.signature_client_id := null;
    new.signe_le := null; new.refuse_le := null;
    return new;
  end if;

  if old.signe_le is not null or old.refuse_le is not null then
    raise exception 'PV de réception signé ou refusé : non modifiable (établissez un nouveau PV)'
      using errcode = 'insufficient_privilege';
  end if;
  if new.dossier_id is distinct from old.dossier_id or new.type is distinct from old.type
     or new.version is distinct from old.version then
    raise exception 'Dossier, type et version d''un PV immuables' using errcode = 'check_violation';
  end if;
  if v_systeme then return new; end if;

  if new.signature_atlas_id is distinct from old.signature_atlas_id
     or new.signature_client_id is distinct from old.signature_client_id
     or new.signe_le is distinct from old.signe_le
     or new.refuse_le is distinct from old.refuse_le then
    raise exception 'Signature et refus passent par les fonctions dédiées' using errcode = 'insufficient_privilege';
  end if;
  if old.signature_atlas_id is not null or old.signature_client_id is not null then
    raise exception 'PV déjà signé par une partie : contenu non modifiable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger pv_reception_guard before insert or update or delete on public.pv_reception
  for each row execute function public.tg_pv_reception_guard();

-- ---------------------------------------------------------------------------
-- Lignes : points F-05 (pré-remplis) ou livrables / tâches F-06 (libres)
-- ---------------------------------------------------------------------------
create table public.pv_reception_lignes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pv_id uuid not null references public.pv_reception (id) on delete cascade,
  ordre integer not null default 0,
  code text,
  libelle text not null check (length(trim(libelle)) > 0),
  resultat text check (resultat in ('conforme', 'non_conforme', 'non_applicable', 'realise', 'non_realise')),
  observation text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index pv_reception_lignes_pv_idx on public.pv_reception_lignes (pv_id, ordre);
create index pv_reception_lignes_org_fk_idx on public.pv_reception_lignes (organization_id);
create index pv_reception_lignes_created_by_fk_idx on public.pv_reception_lignes (created_by);

create trigger pv_reception_lignes_meta before insert or update on public.pv_reception_lignes
  for each row execute function public.tg_meta();

-- Contenu figé dès la première signature ou le refus
create function public.pv_reception_fige(p_pv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pv_reception
     where id = p_pv and (signature_atlas_id is not null or signature_client_id is not null
                          or signe_le is not null or refuse_le is not null));
$$;
revoke execute on function public.pv_reception_fige(uuid) from public, anon, authenticated;

create function public.tg_pv_reception_lignes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_systeme boolean := coalesce(current_setting('atlas.execution_systeme', true), '') = 'on';
  p public.pv_reception;
begin
  if tg_op = 'UPDATE' and new.pv_id is distinct from old.pv_id then
    raise exception 'PV de réception immuable' using errcode = 'check_violation';
  end if;
  select * into p from public.pv_reception where id = coalesce(new.pv_id, old.pv_id) for update;
  if p.id is null then
    return coalesce(new, old);  -- suppression en cascade
  end if;
  if public.pv_reception_fige(p.id) then
    raise exception 'PV signé ou refusé : lignes non modifiables' using errcode = 'insufficient_privilege';
  end if;
  if tg_op <> 'DELETE' and p.organization_id <> new.organization_id then
    raise exception 'PV invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  if p.type = 'F05' and not v_systeme then
    if tg_op <> 'UPDATE' then
      raise exception 'F-05 : les 9 points sont fixes (cochez « non applicable » au besoin)'
        using errcode = 'check_violation';
    end if;
    if new.code is distinct from old.code or new.libelle is distinct from old.libelle
       or new.ordre is distinct from old.ordre or new.pv_id is distinct from old.pv_id then
      raise exception 'F-05 : seuls le résultat et l''observation se modifient' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op <> 'DELETE' and new.resultat is not null
     and ((p.type = 'F05' and new.resultat not in ('conforme', 'non_conforme', 'non_applicable'))
       or (p.type = 'F06' and new.resultat not in ('realise', 'non_realise'))) then
    raise exception 'Résultat invalide pour un PV %', p.type using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger pv_reception_lignes_guard before insert or update or delete on public.pv_reception_lignes
  for each row execute function public.tg_pv_reception_lignes_guard();

create function public.tg_pv_reception_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'F05' then
    perform set_config('atlas.execution_systeme', 'on', true);
    insert into public.pv_reception_lignes (organization_id, pv_id, ordre, code, libelle)
    select new.organization_id, new.id, x.ordre, x.code, x.libelle
    from (values
      (1, 'pages_en_ligne', 'Pages en ligne'),
      (2, 'contenus_corrects', 'Textes et photos corrects'),
      (3, 'affichage_adaptatif', 'Affichage mobile, tablette et ordinateur'),
      (4, 'formulaire_whatsapp', 'Formulaire de contact et WhatsApp'),
      (5, 'domaine_https', 'Nom de domaine et HTTPS'),
      (6, 'emails_pro', 'Adresses e-mail professionnelles'),
      (7, 'fiche_google', 'Fiche Google'),
      (8, 'acces_remis', 'Accès remis au client'),
      (9, 'formation_faite', 'Formation faite')
    ) as x(ordre, code, libelle);
    perform set_config('atlas.execution_systeme', 'off', true);
  end if;
  return null;
end;
$$;

create trigger pv_reception_after_insert after insert on public.pv_reception
  for each row execute function public.tg_pv_reception_after_insert();

-- ---------------------------------------------------------------------------
-- Réserves
-- ---------------------------------------------------------------------------
create table public.reserves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  pv_id uuid not null references public.pv_reception (id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  date_limite date,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'levee')),
  levee_le timestamptz,
  levee_par uuid references public.profiles (id) on delete set null,
  commentaire_levee text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index reserves_dossier_idx on public.reserves (dossier_id, statut);
create index reserves_pv_idx on public.reserves (pv_id);
create index reserves_org_fk_idx on public.reserves (organization_id);
create index reserves_levee_par_fk_idx on public.reserves (levee_par);
create index reserves_created_by_fk_idx on public.reserves (created_by);

create trigger reserves_meta before insert or update on public.reserves
  for each row execute function public.tg_meta();

create function public.tg_reserves_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_systeme boolean := coalesce(current_setting('atlas.execution_systeme', true), '') = 'on';
  p public.pv_reception;
begin
  if tg_op = 'UPDATE' and new.pv_id is distinct from old.pv_id then
    raise exception 'PV de réception immuable' using errcode = 'check_violation';
  end if;
  select * into p from public.pv_reception where id = coalesce(new.pv_id, old.pv_id) for update;
  if p.id is null then
    return coalesce(new, old);  -- suppression en cascade
  end if;
  if tg_op = 'UPDATE' and v_systeme then
    return new;  -- levée par lever_reserve()
  end if;
  if public.pv_reception_fige(p.id) then
    raise exception 'PV signé ou refusé : réserves non modifiables (levez-les une à une)'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if p.organization_id <> new.organization_id then
    raise exception 'PV invalide pour cette organisation' using errcode = 'check_violation';
  end if;
  new.dossier_id := p.dossier_id;
  new.date_limite := coalesce(new.date_limite, p.date_limite_reserves);
  new.statut := 'ouverte'; new.levee_le := null; new.levee_par := null; new.commentaire_levee := null;
  return new;
end;
$$;

create trigger reserves_guard before insert or update or delete on public.reserves
  for each row execute function public.tg_reserves_guard();
