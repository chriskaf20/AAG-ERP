-- numero / annee sont toujours calculés par tg_dossiers_before_insert :
-- valeurs par défaut pour que l'insertion côté application ne les fournisse pas.
alter table public.dossiers alter column numero set default '';
alter table public.dossiers alter column annee set default 0;
