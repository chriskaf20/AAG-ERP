import type { Tables } from "./database.types"

export type BonCommande = Tables<"bons_commande"> & { lignes: Tables<"bon_commande_lignes">[] }
export const STATUTS_BON: Record<string, string> = {
  brouillon: "Brouillon", a_valider: "À valider", valide: "Prêt à émettre", emis: "Émis", annule: "Annulé",
}
