import type { Tables } from "@/lib/database.types"
import { FUSEAU_HORAIRE } from "./format"

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

const dateMission = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSEAU_HORAIRE, year: "numeric", month: "2-digit", day: "2-digit" })

export function missionsAujourdhui<T extends Pick<MissionResume, "debut" | "fin">>(missions: T[], maintenant = new Date()) {
  const jour = dateMission.format(maintenant)
  const aujourdHui: T[] = []
  const autres: T[] = []
  for (const mission of missions) {
    const debut = dateMission.format(new Date(mission.debut))
    const fin = mission.fin ? dateMission.format(new Date(mission.fin)) : debut
    const groupe = debut <= jour && jour <= fin ? aujourdHui : autres
    groupe.push(mission)
  }
  return { aujourdHui, autres }
}

export const STATUT_MISSION = { planifiee: "Planifiée", en_cours: "En cours", terminee: "Terminée", annulee: "Annulée" }
