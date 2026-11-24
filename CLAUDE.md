# ERP Atlas Africa Group

ERP sur mesure pour ATLAS AFRICA GROUP SARL (Lubumbashi, RDC), conçu pour être
revendu plus tard à d'autres PME (multi-entreprise).

## Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase : Postgres, Auth, Storage, Edge Functions, Row Level Security
  (utiliser le MCP Supabase pour créer le projet et appliquer les migrations)
- Déploiement Vercel : erp.atlasafricagroup.com
- Interface en français (prête pour l'anglais via i18n), responsive mobile d'abord
- Couleurs : bleu marine #0B1F4B (primary), or #C9A13B (accent),
  logo dans public/logo.png

## Principes non négociables
- Toutes les tables ont organization_id, created_at, created_by, updated_at
- RLS activée sur TOUTES les tables : filtre par organization_id + rôle + département
- Les règles métier bloquantes sont dans la base (fonctions/triggers Postgres),
  pas seulement dans l'interface
- Chaque changement de statut et chaque modification sensible → table audit_log
- Un document signé n'est jamais modifié : nouvelle version
- Montants en USD par défaut, CDF possible avec taux du jour
- Migrations SQL versionnées dans supabase/migrations, jamais de changement manuel
- Types TypeScript générés depuis Supabase
- Aucune clé API ou secret dans le code : variables d'environnement uniquement

## Rôles
admin_systeme, gerant, associe, directeur_commercial, directeur_operations,
daf, responsable_departement, responsable_dossier, acheteur, responsable_rh,
agent_terrain, client (portail). Un utilisateur peut avoir plusieurs rôles.
Départements : AFF (Affaires et projets), SUP (Supply et logistique),
PEF (People et Facilities), DIG (Digital et technologies).

## Circuit d'un dossier (numéro AAG-AAAA-NNN généré automatiquement)
nouveau → en_verification → (complement_requis) → accepte → devis_envoye →
en_lancement → en_cours → livre → (reserves) → receptionne_a_facturer → cloture
Sorties possibles avec motif obligatoire : refuse, classe_sans_suite.
Règles bloquantes :
- accepte : décision de vérification signée par le gérant
- en_lancement : devis signé + acompte encaissé + PV de lancement signé
- receptionne_a_facturer : PV de réception signé, toutes réserves levées
- cloture : facture soldée
- devis ou bon de commande > seuil paramétrable → validation du gérant

## Composants UI (21st.dev)
- Avant de créer un composant d'interface (tableau de bord, carte de
  statistique, tableau de données, kanban, sidebar, formulaire, modale),
  chercher d'abord dans le catalogue 21st via le MCP.
- Me montrer les options trouvées AVANT d'installer : les installations
  sont limitées.
- Privilégier les composants sobres et denses en données, adaptés à un ERP.
  Éviter les effets marketing (hero animés, particules, gradients).
- Après installation, adapter au thème Atlas via les variables CSS shadcn,
  jamais de couleurs codées en dur.
- Ne pas installer deux composants qui font la même chose : réutiliser
  ce qui existe dans components/ui.
- Composants accessibles (vrais boutons, labels, clavier) et lisibles
  sur téléphone.
- Signaler toute dépendance lourde (ex. framer-motion) avant de l'ajouter.

## Façon de travailler
- Une phase à la fois ; ne pas anticiper les phases suivantes
- Avant de coder : présenter le plan (fichiers, tables, écrans) et attendre mon OK
- Petites modifications ciblées, pas de réécriture de fichiers entiers
- Lancer le build et les tests une fois à la fin de chaque étape, pas après
  chaque fichier
- Réponses courtes, sans résumé final