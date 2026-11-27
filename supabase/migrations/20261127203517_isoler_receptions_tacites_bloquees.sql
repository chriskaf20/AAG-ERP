-- Un dossier bloqué par un contrôle métier ne doit pas annuler toutes les réceptions du jour.
create or replace function public.receptions_tacites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_nb integer := 0;
begin
  for r in
    select ds.id, coalesce((o.parametres ->> 'reception_tacite_jours')::integer, 7) as jours
    from public.dossiers ds
    join public.organizations o on o.id = ds.organization_id
    where ds.statut = 'livre'
      and ds.statut_change_le <= now() - make_interval(days => coalesce((o.parametres ->> 'reception_tacite_jours')::integer, 7))
      and exists (select 1 from public.contrats c
                   where c.dossier_id = ds.id and c.statut = 'signe' and c.reception_tacite)
      and not exists (select 1 from public.pv_reception p
                       where p.dossier_id = ds.id
                         and ((p.signe_le is null and p.refuse_le is null and p.signature_client_id is not null)
                           or p.signe_le > ds.statut_change_le
                           or p.refuse_le > ds.statut_change_le))
    order by ds.id
    for update of ds skip locked
  loop
    begin
      perform public.dossier_appliquer_statut(
        r.id, 'receptionne_a_facturer',
        'Réception tacite : sans réponse du client ' || r.jours || ' jours après la livraison (clause du contrat)',
        null, true);
      v_nb := v_nb + 1;
    exception when check_violation then
      -- Le dossier reste livré. Les autres dossiers du lot restent traitables.
      raise warning 'Réception tacite bloquée pour le dossier % : %', r.id, sqlerrm;
    end;
  end loop;
  return v_nb;
end;
$$;
