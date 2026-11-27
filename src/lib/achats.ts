import type { Tables } from "./database.types"

export type ReceptionAchat = Tables<"receptions_achat"> & { lignes: Tables<"reception_achat_lignes">[] }
export type BonCommande = Tables<"bons_commande"> & { lignes: Tables<"bon_commande_lignes">[]; receptions: ReceptionAchat[] }
export const STATUTS_BON: Record<string, string> = {
  brouillon: "Brouillon", a_valider: "À valider", valide: "Prêt à émettre", emis: "Émis", annule: "Annulé",
  recu_partiel: "Reçu partiellement", recu: "Reçu en totalité",
}
