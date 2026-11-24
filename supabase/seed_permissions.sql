-- Données de test — comptes multi-rôles (mot de passe : AtlasTest2026!)
with u(id, email, nom) as (values
  ('10000000-0000-4000-8000-000000000013'::uuid, 'multi@atlas-erp.test', 'Multi Rôles Test'),
  ('10000000-0000-4000-8000-000000000014'::uuid, 'multi.direction@atlas-erp.test', 'Gérant Admin Test')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('AtlasTest2026!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nom_complet', u.nom), now(), now(),
  '', '', '', '', '', '', '', ''
from u
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users where email in ('multi@atlas-erp.test', 'multi.direction@atlas-erp.test')
on conflict do nothing;

update public.profiles set organization_id = 'a0000000-0000-4000-8000-000000000001'
 where email in ('multi@atlas-erp.test', 'multi.direction@atlas-erp.test');

insert into public.user_roles (organization_id, user_id, role, department_id) values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000013', 'responsable_dossier', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000013', 'acheteur', 'd0000000-0000-4000-8000-00000000000b'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000014', 'gerant', null),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000014', 'admin_systeme', null)
on conflict do nothing;

-- Le compte multi est responsable du dossier 010 (AFF)
update public.dossiers set responsable_id = '10000000-0000-4000-8000-000000000013'
 where id = 'f0000000-0000-4000-8000-000000000010';

-- Scénario de test : responsable du département SUP, et dossier 005 (SUP, accepté)
-- préparé par le responsable de dossier.
with u(id, email, nom) as (values
  ('10000000-0000-4000-8000-000000000015'::uuid, 'resp.sup@atlas-erp.test', 'Responsable SUP Test')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('AtlasTest2026!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nom_complet', u.nom), now(), now(),
  '', '', '', '', '', '', '', ''
from u
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users where email = 'resp.sup@atlas-erp.test'
on conflict do nothing;

update public.profiles set organization_id = 'a0000000-0000-4000-8000-000000000001'
 where email = 'resp.sup@atlas-erp.test';

insert into public.user_roles (organization_id, user_id, role, department_id) values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000015', 'responsable_departement', 'd0000000-0000-4000-8000-00000000000b')
on conflict do nothing;

update public.dossiers set responsable_id = '10000000-0000-4000-8000-000000000008'
 where id = 'f0000000-0000-4000-8000-000000000005';
