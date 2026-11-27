import type { Enums } from "@/lib/database.types"

export type AppRole = Enums<"app_role">
export type DossierStatut = Enums<"dossier_statut">

export const ROLES: AppRole[] = [
  "admin_systeme",
  "gerant",
  "associe",
  "directeur_commercial",
  "directeur_operations",
  "daf",
  "responsable_departement",
  "responsable_dossier",
  "acheteur",
  "responsable_rh",
  "agent_terrain",
  "client",
]

/** Rôles rattachés à un département */
export const ROLES_DEPARTEMENT: AppRole[] = ["responsable_departement", "acheteur", "responsable_rh"]

export const PERMISSIONS = [
  "dossiers.read_all",
  "dossiers.read_dept",
  "dossiers.read_own",
  "dossiers.read_assigned",
  "dossiers.create",
  "dossiers.verify",
  "dossiers.decide",
  "clients.read",
  "clients.write",
  "devis.read",
  "devis.write",
  "devis.validate",
  "devis.send",
  "factures.read",
  "factures.write",
  "paiements.write",
  "normalisation.write",
  "marges.read",
  "services.manage",
  "admin.users",
  "admin.settings",
  "audit.read",
  "reports.read",
  "missions.read_assigned",
  "missions.report",
  "execution.write",
  "reception.write",
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * Matrice rôle → permissions (validée). Elle est aussi en base (role_permissions,
 * migration générée depuis ce fichier) : la base reste l'autorité pour la RLS.
 */
const PERMISSIONS_MISSION = ["missions.read_assigned", "missions.report"] as const
const PERMISSIONS_EXECUTION = [...PERMISSIONS_MISSION, "execution.write", "reception.write"] as const

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  admin_systeme: ["admin.users", "admin.settings", "audit.read", ...PERMISSIONS_MISSION],
  gerant: [
    ...PERMISSIONS_EXECUTION,
    "dossiers.read_all", "dossiers.create", "dossiers.verify", "dossiers.decide",
    "clients.read", "clients.write",
    "devis.read", "devis.write", "devis.validate", "devis.send",
    "factures.read", "factures.write", "paiements.write", "normalisation.write",
    "marges.read", "services.manage",
    "admin.users", "admin.settings", "audit.read", "reports.read",
  ],
  associe: ["marges.read", "reports.read", ...PERMISSIONS_MISSION],
  directeur_commercial: [
    ...PERMISSIONS_MISSION,
    "dossiers.read_all", "dossiers.create", "dossiers.verify",
    "clients.read", "clients.write", "devis.read", "devis.write",
    "factures.read", "marges.read", "services.manage", "reports.read",
  ],
  directeur_operations: [
    ...PERMISSIONS_EXECUTION,
    "dossiers.read_all", "dossiers.create", "dossiers.verify",
    "clients.read", "clients.write", "devis.read", "devis.write",
    "marges.read", "reports.read",
  ],
  daf: [
    ...PERMISSIONS_MISSION,
    "dossiers.read_all", "clients.read", "devis.read",
    "factures.read", "factures.write", "paiements.write", "normalisation.write",
    "marges.read", "audit.read", "reports.read",
  ],
  responsable_departement: [
    ...PERMISSIONS_EXECUTION,
    "dossiers.read_dept", "dossiers.create", "dossiers.verify",
    "clients.read", "clients.write", "devis.read", "devis.write", "devis.send",
    "factures.read", "marges.read",
  ],
  responsable_dossier: [
    ...PERMISSIONS_EXECUTION,
    "dossiers.read_own", "dossiers.create", "dossiers.verify",
    "clients.read", "clients.write", "devis.read", "devis.write",
    "factures.read", "marges.read",
  ],
  acheteur: ["dossiers.read_dept", "clients.read", ...PERMISSIONS_MISSION],
  responsable_rh: ["dossiers.read_dept", "clients.read", ...PERMISSIONS_MISSION],
  agent_terrain: ["dossiers.read_assigned", ...PERMISSIONS_MISSION],
  client: [],
}

/** Union des permissions de plusieurs rôles, dans l'ordre de PERMISSIONS. */
export function permissionsDe(roles: readonly AppRole[]): Permission[] {
  const set = new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []))
  return PERMISSIONS.filter((p) => set.has(p))
}

export const a = (perms: readonly Permission[], p: Permission) => perms.includes(p)
export const aUne = (perms: readonly Permission[], ...ps: Permission[]) => ps.some((p) => perms.includes(p))

export const LECTURE_DOSSIERS: Permission[] = ["dossiers.read_all", "dossiers.read_dept", "dossiers.read_own"]

/** Droits d'un utilisateur sur UN dossier, calculés en base (portée incluse) par droits_dossier(). */
export type DroitsDossier = {
  voir: boolean
  verify: boolean
  decide: boolean
  devis_read: boolean
  devis_write: boolean
  devis_validate: boolean
  devis_send: boolean
  factures_read: boolean
  factures_write: boolean
  paiements_write: boolean
  normalisation_write: boolean
  marges_read: boolean
  clients_write: boolean
  execution_write: boolean
  reception_write: boolean
  suivi_read: boolean
}

/** Statuts du circuit, dans l'ordre (sorties en fin de liste) */
export const STATUTS: DossierStatut[] = [
  "nouveau",
  "en_verification",
  "complement_requis",
  "accepte",
  "devis_envoye",
  "en_lancement",
  "en_cours",
  "livre",
  "reserves",
  "receptionne_a_facturer",
  "cloture",
  "refuse",
  "classe_sans_suite",
]

/** Statuts gérés en phase 1 (colonnes kanban toujours affichées) */
export const STATUTS_PHASE_1: DossierStatut[] = [
  "nouveau",
  "en_verification",
  "complement_requis",
  "accepte",
  "refuse",
  "classe_sans_suite",
]

export const STATUTS_TERMINAUX: DossierStatut[] = ["cloture", "refuse", "classe_sans_suite"]

/** Transitions manuelles possibles (hors décisions F-02 qui passent par la validation) */
export function transitionsManuelles(statut: DossierStatut, d: Pick<DroitsDossier, "verify" | "decide" | "execution_write" | "reception_write">) {
  const t: DossierStatut[] = []
  if (d.verify && (statut === "nouveau" || statut === "complement_requis")) t.push("en_verification")
  if (d.verify && statut === "accepte") t.push("devis_envoye")
  if (d.verify && statut === "devis_envoye") t.push("en_lancement")
  if (d.execution_write && statut === "en_lancement") t.push("en_cours")
  if (d.execution_write && statut === "en_cours") t.push("livre")
  if (d.reception_write && statut === "livre") t.push("reserves", "receptionne_a_facturer")
  if (d.reception_write && statut === "reserves") t.push("receptionne_a_facturer")
  if (d.verify && statut === "receptionne_a_facturer") t.push("cloture")
  if (d.decide && ["nouveau", "en_verification", "complement_requis"].includes(statut)) {
    t.push("classe_sans_suite")
  }
  return t
}

export const POINTS_VERIFICATION = [
  "identite_verifiee",
  "documents_valides",
  "coordonnees_confirmees",
  "signataire_habilite",
  "activite_legale",
  "capacite_atlas",
  "capacite_paiement",
  "absence_conflit",
] as const

export type PointVerification = (typeof POINTS_VERIFICATION)[number]
