import assert from "node:assert/strict"
import { test } from "node:test"

import { grouperPlanning, semainePlanning, type MissionPlanning } from "../src/lib/planning"

const dimanche = new Date("2026-11-29T21:59:59Z")

test("le lundi à Lubumbashi change la semaine dès le dimanche 22 h UTC", () => {
  const avant = semainePlanning(undefined, dimanche)
  const apres = semainePlanning(undefined, new Date("2026-11-29T22:00:00Z"))

  assert.equal(avant.jours[0].date, "2026-11-23")
  assert.equal(apres.jours[0].date, "2026-11-30")
  assert.equal(apres.jours[6].date, "2026-12-06")
  assert.equal(apres.debut, "2026-11-29T22:00:00.000Z")
  assert.equal(apres.fin, "2026-12-06T22:00:00.000Z")
  assert.equal(apres.precedente, "2026-11-23")
  assert.equal(apres.suivante, "2026-12-07")
})

test("une date de la semaine sélectionne son lundi et une date invalide revient à la semaine actuelle", () => {
  assert.equal(semainePlanning("2027-01-01", dimanche).jours[0].date, "2026-12-28")
  for (const date of ["2026-02-29", "2026-13-01", "", ["2026-11-16", "2026-11-23"]]) {
    assert.equal(semainePlanning(date, dimanche).jours[0].date, "2026-11-23")
  }
})

function mission(
  id: string,
  debut: string,
  fin: string | null,
  mission_agents: MissionPlanning["mission_agents"] = [],
): MissionPlanning {
  return { id, titre: id, type: "interne", lieu: null, statut: "planifiee", debut, fin, mission_agents }
}

test("une mission est visible pour chaque membre affecté et chaque jour chevauché", () => {
  const { jours } = semainePlanning("2026-11-30", dimanche)
  const inez = { user_id: "i", profiles: { nom_complet: "Inès" } }
  const alice = { user_id: "a", profiles: { nom_complet: "Alice" } }
  const groupes = grouperPlanning([
    mission("chantier", "2026-11-28T12:00:00Z", "2026-11-30T22:00:00Z", [inez, alice]),
    mission("réunion", "2026-12-02T08:00:00Z", null, [inez]),
    mission("sans équipe", "2026-12-06T20:00:00Z", null),
  ], jours)

  assert.deepEqual(groupes.map(g => g.nom), ["Alice", "Inès", "Sans affectation"])
  assert.deepEqual(groupes.map(g => g.jours.map(j => j.map(m => m.id))), [
    [["chantier"], [], [], [], [], [], []],
    [["chantier"], [], ["réunion"], [], [], [], []],
    [[], [], [], [], [], [], ["sans équipe"]],
  ])
})

test("les créneaux aux bornes de la semaine ne sont pas dupliqués", () => {
  const { jours, debut, fin } = semainePlanning("2026-11-30", dimanche)
  const resultats = grouperPlanning([
    mission("fin à minuit", "2026-11-29T20:00:00Z", debut),
    mission("début à minuit", debut, null),
    mission("semaine suivante", fin, null),
  ], jours)

  assert.deepEqual(resultats.flatMap(g => g.jours.flat().map(m => m.id)), ["début à minuit"])
  assert.deepEqual(grouperPlanning([mission("hors semaine", fin, null)], jours), [])
})
