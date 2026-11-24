import type { Enums } from "@/lib/database.types"

export type AppRole = Enums<"app_role">
export type DossierStatut = Enums<"dossier_statut">

/** Rôles de direction : voient et pilotent toute l'organisation */
export const DIRECTION: AppRole[] = [
  "admin_systeme",
  "gerant",
  "associe",
  "directeur_commercial",
  "directeur_operations",
  "daf",
]

export const ROLES: AppRole[] = [
  ...DIRECTION,
  "responsable_departement",
  "responsable_dossier",
  "acheteur",
  "responsable_rh",
  "agent_terrain",
  "client",
]

/** Rôles rattachés à un département */
export const ROLES_DEPARTEMENT: AppRole[] = [
  "responsable_departement",
  "acheteur",
  "responsable_rh",
]

const aUn = (roles: AppRole[], liste: AppRole[]) =>
  roles.some((r) => liste.includes(r))

/**
 * Miroir côté interface des règles de la base (RLS + fonctions).
 * Sert uniquement à afficher / masquer des actions : la base reste l'autorité.
 */
export const peut = {
  direction: (r: AppRole[]) => aUn(r, DIRECTION),
  creerDossier: (r: AppRole[]) =>
    aUn(r, [...DIRECTION, "responsable_departement", "responsable_dossier"]),
  ecrireClients: (r: AppRole[]) =>
    aUn(r, [...DIRECTION, "responsable_departement", "responsable_dossier"]),
  administrer: (r: AppRole[]) => aUn(r, ["admin_systeme", "gerant"]),
  attribuerAdmin: (r: AppRole[]) => r.includes("admin_systeme"),
  decider: (r: AppRole[]) => r.includes("gerant"),
  voirAudit: (r: AppRole[]) => aUn(r, ["admin_systeme", "gerant", "daf"]),
  interne: (r: AppRole[]) => r.some((x) => x !== "client"),
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
export function transitionsManuelles(
  statut: DossierStatut,
  roles: AppRole[],
  pilote: boolean
): DossierStatut[] {
  const t: DossierStatut[] = []
  if (pilote && (statut === "nouveau" || statut === "complement_requis")) {
    t.push("en_verification")
  }
  if (
    peut.decider(roles) &&
    ["nouveau", "en_verification", "complement_requis"].includes(statut)
  ) {
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
