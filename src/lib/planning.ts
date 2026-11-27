import type { Tables } from "./database.types"
import { FUSEAU_HORAIRE } from "./format"

export type MissionPlanning = Pick<Tables<"missions">, "id" | "titre" | "type" | "lieu" | "statut" | "debut" | "fin"> & {
  mission_agents: { user_id: string; profiles: { nom_complet: string | null } | null }[]
}

const HEURES = 60 * 60 * 1000
const JOUR = 24 * HEURES
const dateLocale = new Intl.DateTimeFormat("fr-CA", {
  timeZone: FUSEAU_HORAIRE, year: "numeric", month: "2-digit", day: "2-digit",
})
const jourAffiche = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU_HORAIRE, weekday: "short", day: "numeric", month: "short",
})
const ordreNoms = new Intl.Collator("fr")

function dateCivile(ms: number) {
  return new Date(ms).toISOString().split("T")[0]
}

export function semainePlanning(choix: string | string[] | undefined, maintenant = new Date()) {
  const locale = Object.fromEntries(dateLocale.formatToParts(maintenant).map(({ type, value }) => [type, value]))
  const dateCourante = Date.UTC(Number(locale.year), Number(locale.month) - 1, Number(locale.day))
  const dateChoisie = typeof choix === "string" && /^\d{4}-\d{2}-\d{2}$/.test(choix) ? Date.parse(choix) : NaN
  const date = Number.isFinite(dateChoisie) && dateCivile(dateChoisie) === choix ? dateChoisie : dateCourante
  const lundi = date - ((new Date(date).getUTCDay() + 6) % 7) * JOUR

  // Les dates civiles servent à naviguer, les instants à interroger le planning de Lubumbashi (UTC+2).
  const jours = Array.from({ length: 7 }, (_, i) => {
    const civil = lundi + i * JOUR
    const debut = civil - 2 * HEURES
    return { date: dateCivile(civil), libelle: jourAffiche.format(debut), debut, fin: debut + JOUR }
  })

  return {
    jours,
    debut: new Date(jours[0].debut).toISOString(),
    fin: new Date(jours[6].fin).toISOString(),
    precedente: dateCivile(lundi - 7 * JOUR),
    suivante: dateCivile(lundi + 7 * JOUR),
  }
}

type JourPlanning = ReturnType<typeof semainePlanning>["jours"][number]

export function grouperPlanning(missions: MissionPlanning[], jours: JourPlanning[]) {
  const groupes = new Map<string | null, { id: string | null; nom: string; jours: MissionPlanning[][] }>()

  for (const mission of missions) {
    const debut = Date.parse(mission.debut)
    const fin = mission.fin ? Date.parse(mission.fin) : debut
    const joursOccupes = jours.flatMap((jour, index) => debut < jour.fin && (debut >= jour.debut || fin > jour.debut) ? [index] : [])
    if (!joursOccupes.length) continue
    const equipe = mission.mission_agents.map(({ user_id, profiles }) => ({
      id: user_id, nom: profiles?.nom_complet || "Membre affecté",
    }))
    const personnes = equipe.length ? equipe : [{ id: null, nom: "Sans affectation" }]

    for (const personne of personnes) {
      const groupe = groupes.get(personne.id) ?? { ...personne, jours: jours.map(() => []) }
      groupes.set(personne.id, groupe)
      for (const index of joursOccupes) groupe.jours[index].push(mission)
    }
  }

  return [...groupes.values()].sort((a, b) => {
    if (a.id === null) return 1
    if (b.id === null) return -1
    return ordreNoms.compare(a.nom, b.nom)
  })
}
