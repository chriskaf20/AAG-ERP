import type { Tables } from "@/lib/database.types"

export type MissionResume = Pick<Tables<"missions">, "id" | "type" | "titre" | "lieu" | "debut" | "fin" | "statut" | "dossier_id"> & {
  dossier: string
  client: string | null
}

export type PhotoRapport = Pick<Tables<"rapport_photos">, "id" | "chemin" | "legende" | "largeur" | "hauteur"> & {
  url?: string
}

export type RapportMission = Tables<"rapports_intervention"> & {
  redacteur: string | null
  valideur: string | null
  signature: { nom: string; image: string; signe_le: string } | null
  photos: PhotoRapport[]
}

export type FicheMission = {
  mission: Tables<"missions">
  dossier: { id: string; numero: string; statut: Tables<"dossiers">["statut"]; service: string; voir: boolean }
  client: { raison_sociale: string | null; adresse: string | null; ville: string | null; telephone: string | null }
  agents: { user_id: string; nom: string | null }[]
  rapports: RapportMission[]
  peut_rediger: boolean
  peut_signer: boolean
  peut_gerer: boolean
  peut_valider: boolean
}

export const STATUT_MISSION = { planifiee: "Planifiée", en_cours: "En cours", terminee: "Terminée", annulee: "Annulée" }
