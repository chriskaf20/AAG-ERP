create table atlas_prive.invitations_utilisateurs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null unique,
  nom_complet text not null,
  fonction text,
  role public.app_role not null,
  department_id uuid references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '15 minutes',
  user_id uuid references auth.users(id) on delete set null
);
alter table atlas_prive.invitations_utilisateurs enable row level security;
revoke all on atlas_prive.invitations_utilisateurs from public, anon, authenticated, service_role;

create function public.preparer_invitation(
  p_org uuid, p_email text, p_nom text, p_fonction text, p_role public.app_role, p_departement uuid
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_email text := lower(trim(p_email));
  demande atlas_prive.invitations_utilisateurs;
  compte auth.users;
begin
  if not public.has_permission(p_org,'admin.users')
     or (p_role='admin_systeme' and not public.has_role(p_org,array['admin_systeme']::public.app_role[])) then
    raise exception 'Invitation non autorisée pour ce rôle' using errcode='insufficient_privilege';
  end if;
  if v_email is null or v_email !~ '^[^ @]+@[^ @]+[.][^ @]+$' or length(v_email)>254
     or p_nom is null or length(trim(p_nom)) not between 2 and 150 or p_role is null then
    raise exception 'Indiquez un email, un nom et un rôle valides' using errcode='check_violation';
  end if;
  if (p_role in ('responsable_departement','acheteur','responsable_rh')) <> (p_departement is not null)
     or (p_departement is not null and not exists (
       select 1 from public.departments where id=p_departement and organization_id=p_org
     )) then
    raise exception 'Choisissez un département de cette organisation' using errcode='check_violation';
  end if;

  delete from atlas_prive.invitations_utilisateurs where email=v_email and user_id is null and expire_le <= now();
  select * into demande from atlas_prive.invitations_utilisateurs where email=v_email for update;
  select * into compte from auth.users where email=v_email limit 1;
  if demande.id is not null and demande.organization_id=p_org and demande.role=p_role
     and demande.department_id is not distinct from p_departement
     and demande.user_id is not distinct from compte.id
     and (compte.id is null or (compte.invited_at is not null and compte.email_confirmed_at is null
       and exists(select 1 from public.user_roles u where u.user_id=compte.id and u.organization_id=p_org
          and u.role=p_role and u.department_id is not distinct from p_departement))) then
    return demande.id;
  end if;
  if compte.id is not null or demande.id is not null then
    raise exception 'Cette adresse est déjà utilisée ou fait l’objet d’une invitation' using errcode='check_violation';
  end if;
  insert into atlas_prive.invitations_utilisateurs(organization_id,email,nom_complet,fonction,role,department_id,created_by)
  values(p_org,v_email,trim(p_nom),nullif(trim(p_fonction),''),p_role,p_departement,auth.uid())
  returning id into demande.id;
  return demande.id;
end;
$$;
revoke execute on function public.preparer_invitation(uuid,text,text,text,public.app_role,uuid) from public, anon, service_role;
grant execute on function public.preparer_invitation(uuid,text,text,text,public.app_role,uuid) to authenticated;

-- Auth met à jour invited_at lors de l’envoi. La demande privée est la seule source du rôle.
create function atlas_prive.tg_invitation_rattacher()
returns trigger language plpgsql security definer set search_path='' as $$
declare demande atlas_prive.invitations_utilisateurs;
begin
  select * into demande from atlas_prive.invitations_utilisateurs
  where id::text=new.raw_user_meta_data ->> 'atlas_invitation' and email=lower(new.email)
    and user_id is null and expire_le > now() for update;
  if not found then return new; end if;
  if not exists (
    select 1 from public.user_roles u
    join public.role_permissions p on p.organization_id=u.organization_id and p.role=u.role
    where u.user_id=demande.created_by and u.organization_id=demande.organization_id
      and p.permission='admin.users'
  ) or (demande.role='admin_systeme' and not exists (
    select 1 from public.user_roles where user_id=demande.created_by and organization_id=demande.organization_id and role='admin_systeme'
  )) then
    raise exception 'Invitation non autorisée' using errcode='insufficient_privilege';
  end if;
  update public.profiles set nom_complet=demande.nom_complet,fonction=demande.fonction,organization_id=demande.organization_id
  where id=new.id;
  insert into public.user_roles(organization_id,user_id,role,department_id,created_by)
  values(demande.organization_id,new.id,demande.role,demande.department_id,demande.created_by);
  update atlas_prive.invitations_utilisateurs set user_id=new.id,updated_at=clock_timestamp() where id=demande.id;
  return new;
end;
$$;
create trigger atlas_invitation_rattacher after update of invited_at on auth.users
for each row when (old.invited_at is null and new.invited_at is not null)
execute function atlas_prive.tg_invitation_rattacher();

create function public.invitation_rattachee(p_invitation uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from atlas_prive.invitations_utilisateurs i
    join public.user_roles u on u.user_id=i.user_id and u.organization_id=i.organization_id and u.role=i.role
      and u.department_id is not distinct from i.department_id
    where i.id=p_invitation and i.user_id=p_user);
$$;
revoke execute on function public.invitation_rattachee(uuid,uuid) from public, anon, authenticated;
grant execute on function public.invitation_rattachee(uuid,uuid) to service_role;
