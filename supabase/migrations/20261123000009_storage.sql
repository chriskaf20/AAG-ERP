-- Phase 1 — Storage : buckets privés « dossiers » et « clients »
--   dossiers : {organization_id}/{numero AAG-AAAA-NNN}/{type}/v{n}-{fichier}
--   clients  : {organization_id}/{client_id}/{type}/v{n}-{fichier}
-- Pas de mise à jour d'objet (une nouvelle version = un nouveau fichier).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dossiers', 'dossiers', false, 20971520, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('clients', 'clients', false, 20971520, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
  ])
on conflict (id) do nothing;

create function public.storage_dossier_acces(p_name text, p_ecriture boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dossiers d
    where d.organization_id::text = (storage.foldername(p_name))[1]
      and d.numero = (storage.foldername(p_name))[2]
      and case when p_ecriture then public.can_edit_dossier(d.id)
               else public.can_see_dossier(d.id) end
  );
$$;

create function public.storage_client_acces(p_name text, p_ecriture boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clients c
    where c.organization_id::text = (storage.foldername(p_name))[1]
      and c.id::text = (storage.foldername(p_name))[2]
      and case when p_ecriture then public.can_write_clients(c.organization_id)
               else public.can_see_client(c.id) end
  );
$$;

revoke execute on function public.storage_dossier_acces(text, boolean) from public, anon;
revoke execute on function public.storage_client_acces(text, boolean) from public, anon;
grant execute on function public.storage_dossier_acces(text, boolean) to authenticated;
grant execute on function public.storage_client_acces(text, boolean) to authenticated;

create policy "dossiers_lecture" on storage.objects
  for select to authenticated
  using (bucket_id = 'dossiers' and public.storage_dossier_acces(name, false));

create policy "dossiers_depot" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dossiers' and public.storage_dossier_acces(name, true));

create policy "dossiers_suppression" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'dossiers'
    and public.storage_dossier_acces(name, false)
    and public.has_role(((storage.foldername(name))[1])::uuid,
                        array['admin_systeme', 'gerant']::public.app_role[])
  );

create policy "clients_lecture" on storage.objects
  for select to authenticated
  using (bucket_id = 'clients' and public.storage_client_acces(name, false));

create policy "clients_depot" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'clients' and public.storage_client_acces(name, true));

create policy "clients_suppression" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'clients'
    and public.storage_client_acces(name, false)
    and public.has_role(((storage.foldername(name))[1])::uuid,
                        array['admin_systeme', 'gerant']::public.app_role[])
  );
