# Recette finale de l’ERP Atlas

Exécuter les quatre parcours sur une copie de recette avec des organisations, comptes, fichiers et clés de test. La pile Supabase locale nécessite Docker. Dans une base de recette vierge, appliquer les migrations du dépôt puis charger `supabase/seed.sql` et, pour les comptes de la matrice, `supabase/seed_permissions.sql`. Les paramètres d’Auth et de Storage utilisés ici sont dans [supabase/config.toml](supabase/config.toml).

Renseigner l’URL et les clés Supabase de recette dans l’environnement de cette copie. Pour l’invitation, régler `auth.site_url` sur l’URL de l’application et utiliser [le modèle d’email d’invitation](supabase/templates/invitation.html). Sur une recette Supabase hébergée, installer le même modèle dans **Authentication → Email Templates → Invite user**. En local, relever les messages dans la boîte SMTP de test sur le port `54324`.

Pour chaque contrôle, noter le compte, l’identifiant du dossier ou de la pièce, l’heure, le résultat attendu et le résultat observé.

## 1. Téléphone physique en HTTPS

1. Ouvrir la copie de recette depuis un téléphone sur le même Wi‑Fi. Vérifier que le navigateur reconnaît le certificat HTTPS.
2. Se connecter comme agent affecté, ouvrir une mission terrain, créer le rapport et prendre deux photos avec la caméra. Couper puis rétablir le réseau pendant un dépôt. Vérifier que la reprise ne crée aucun doublon.
3. Faire signer le client et appuyer une seule fois sur **Enregistrer la signature**. Vérifier la confirmation à l’écran.
4. Se déconnecter, se reconnecter comme responsable désigné, puis recharger le rapport. Les deux photos et la signature doivent rester visibles. Le compte du membre non affecté du même département ne doit pas pouvoir ouvrir la mission.

## 2. Supabase Auth et Storage réels

1. Depuis **Administration → Utilisateurs**, inviter une adresse fictive avec le rôle acheteur et un département de recette. Relever le courriel. Ouvrir le lien dans un autre navigateur, accepter l’invitation, choisir le mot de passe et contrôler le rôle et le département après reconnexion. Réessayer l’ancien lien et vérifier son refus. Essayer aussi une invitation depuis un compte sans droit d’administration.
2. Rejouer le dépôt et la lecture du rapport terrain dans les buckets privés, ainsi que l’ouverture du PDF avec ses photos. Vérifier la lecture après reconnexion et le refus depuis une autre organisation.
3. Dans le portail, rattacher deux comptes à deux clients et utiliser une organisation distincte comme témoin. Partager seulement une version du F‑03. Vérifier la liste des dossiers, le téléchargement de la version partagée et le refus pour l’autre client, l’autre organisation et la version non partagée.
4. Avec le client autorisé et toujours connecté, enregistrer l’URL du téléchargement, puis demander au gérant de révoquer le partage. Rouvrir **exactement la même URL** avec une nouvelle requête. Attendre **404**, aucun octet du fichier et la disparition de la pièce de la liste après rechargement. Une copie déjà téléchargée reste sur l’appareil.

## 3. Parcours métier de bout en bout

1. Signer un devis de **7 250 USD**. En recette uniquement, rendre le dépôt de l’archive temporairement indisponible. Vérifier que la signature est enregistrée et que le devis indique une archive en attente. Rétablir le dépôt, puis utiliser **Reprendre l’archivage**. Le PDF doit contenir la signature et correspondre à une seule archive consultable.
2. Émettre et normaliser l’acompte de **2 175 USD**, puis émettre un avoir de **500 USD**. Réaliser une mission terrain avec signature client et une mission interne avec validation par le responsable. Vérifier qu’un incident de gravité élevée ouvert bloque la livraison.
3. Signer un PV F‑06 avec une réserve de gravité élevée. Tenter la levée sans fichier, puis joindre une photo ou un PDF et vérifier sa lecture depuis le dossier. Contrôler la gravité et le nom du justificatif sur le PV PDF.
4. Vérifier qu’un seul brouillon de solde de **5 575 USD** est créé. Le normaliser et le solder. La clôture doit être refusée avant l’avis client, puis autorisée après sa saisie.
5. Émettre un bon pour un article stockable de cinq unités. Réceptionner deux unités et répéter l’enregistrement. Annuler et remplacer le reliquat. Vérifier que le bon original conserve deux unités reçues. Suivre la validation habituelle du nouveau bon et réceptionner les trois unités restantes. Contrôler les cinq unités en stock et les deux entrées. Saisir une sortie, puis un ajustement avec motif.

## 4. Tâches planifiées

1. Dans la recette isolée, contrôler les tâches `relances-quotidiennes` à **05 h 00 UTC** et `receptions-tacites` à **05 h 10 UTC**. Vérifier leur exécution dans `cron.job_run_details`. Pour les relances, configurer la fonction, `CRON_SECRET` et les entrées Vault `relances_url` et `cron_secret` avec les valeurs de recette.
2. Préparer une facture échue. Commencer en mode simulation et contrôler le résultat de la fonction et l’historique. Refaire le cycle et vérifier l’absence de doublon. Si le canal d’envoi de recette est configuré, contrôler la livraison sur l’adresse de test autorisée.
3. Préparer un dossier livré depuis le délai paramétré avec clause de réception tacite, et un dossier témoin sans clause. Vérifier le passage à **Réceptionné à facturer**, son motif et le brouillon de solde pour le premier. Le témoin reste livré. Ajouter un dossier multidevise bloqué et vérifier que les autres dossiers éligibles sont traités.
