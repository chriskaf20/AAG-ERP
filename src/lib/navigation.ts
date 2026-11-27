import "server-only"

import { getTranslations } from "next-intl/server"

import { aUne, LECTURE_DOSSIERS, LECTURE_FOURNISSEURS, LECTURE_MISSIONS, type Permission } from "@/lib/permissions"

export type IconeNav =
  | "tableau"
  | "missions"
  | "planning"
  | "dossiers"
  | "nouveau"
  | "clients"
  | "finance"
  | "fournisseurs"
  | "stock"
  | "portail"
  | "bons-commande"
  | "devis"
  | "factures"
  | "paiements"
  | "services"
  | "rapports"
  | "utilisateurs"
  | "roles"
  | "parametres"
  | "audit"

export type NavItem = { titre: string; url: string; icone: IconeNav }
export type NavGroupe = { titre: string; items: NavItem[] }

type Entree = NavItem & { permis: Permission[] | "tous" }

/** Seul un agent terrain (missions affectées) n'a pas de tableau de bord général. */
export function accueil(perms: readonly Permission[]) {
  const general = perms.some((p) => !["dossiers.read_assigned", "missions.read_assigned", "missions.report"].includes(p))
  return general ? "/tableau-de-bord" : aUne(perms, "missions.read_assigned", "dossiers.read_assigned") ? "/missions" : "/profil"
}

/** Menu calculé côté serveur à partir des permissions, dans un ordre fixe ; groupes vides masqués. */
export async function menuNavigation(perms: readonly Permission[], portail = false): Promise<NavGroupe[]> {
  const t = await getTranslations("nav")
  const general = perms.some((p) => !["dossiers.read_assigned", "missions.read_assigned", "missions.report"].includes(p))

  const groupes: { titre: string; items: Entree[] }[] = [
    {
      titre: "Activité",
      items: [
        ...(general ? [{ titre: t("tableauDeBord"), url: "/tableau-de-bord", icone: "tableau" as const, permis: "tous" as const }] : []),
        { titre: t("missions"), url: "/missions", icone: "missions", permis: ["missions.read_assigned", "dossiers.read_assigned"] },
        { titre: t("planning"), url: "/planning", icone: "planning", permis: LECTURE_MISSIONS },
        { titre: t("dossiers"), url: "/dossiers", icone: "dossiers", permis: LECTURE_DOSSIERS },
        { titre: t("nouveauDossier"), url: "/dossiers/nouveau", icone: "nouveau", permis: ["dossiers.create"] },
        { titre: t("clients"), url: "/clients", icone: "clients", permis: ["clients.read"] },
        ...(portail ? [{ titre: "Portail client", url: "/portail", icone: "portail" as const, permis: "tous" as const }] : []),
      ],
    },
    {
      titre: "Commercial et finance",
      items: [
        { titre: t("finance"), url: "/finance", icone: "finance", permis: ["factures.write"] },
        { titre: t("devis"), url: "/devis", icone: "devis", permis: ["devis.read"] },
        { titre: t("factures"), url: "/factures", icone: "factures", permis: ["factures.read"] },
        { titre: t("paiements"), url: "/paiements", icone: "paiements", permis: ["paiements.write"] },
        { titre: t("services"), url: "/services", icone: "services", permis: ["services.manage"] },
        { titre: t("rapports"), url: "/rapports", icone: "rapports", permis: ["reports.read"] },
      ],
    },
    {
      titre: t("achats"),
      items: [
        { titre: t("bonsCommande"), url: "/achats", icone: "bons-commande", permis: ["achats.read"] },
        { titre: t("fournisseurs"), url: "/fournisseurs", icone: "fournisseurs", permis: LECTURE_FOURNISSEURS },
        { titre: "Stock", url: "/stock", icone: "stock", permis: ["achats.read", "achats.write"] },
      ],
    },
    {
      titre: t("administration"),
      items: [
        { titre: t("utilisateurs"), url: "/admin/utilisateurs", icone: "utilisateurs", permis: ["admin.users"] },
        { titre: t("roles"), url: "/admin/roles", icone: "roles", permis: ["admin.users"] },
        { titre: t("parametres"), url: "/admin/parametres", icone: "parametres", permis: ["admin.settings"] },
        { titre: t("audit"), url: "/admin/audit", icone: "audit", permis: ["audit.read"] },
      ],
    },
  ]

  return groupes
    .map((g) => ({
      titre: g.titre,
      items: g.items
        .filter((i) => i.permis === "tous" || aUne(perms, ...i.permis))
        .map(({ titre, url, icone }) => ({ titre, url, icone })),
    }))
    .filter((g) => g.items.length > 0)
}
