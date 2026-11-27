import assert from "node:assert/strict"
import { test } from "node:test"
import { missionsAujourdhui } from "../src/lib/missions"

test("Aujourd’hui suit le jour de Lubumbashi et inclut une mission sur plusieurs jours", () => {
  const missions = [
    { id: "courte", debut: "2026-11-27T22:30:00Z", fin: null },
    { id: "etendue", debut: "2026-11-27T09:00:00Z", fin: "2026-11-29T08:00:00Z" },
    { id: "veille", debut: "2026-11-27T07:30:00Z", fin: null },
    { id: "demain", debut: "2026-11-28T22:00:00Z", fin: null },
  ]
  const groupes = missionsAujourdhui(missions, new Date("2026-11-27T22:05:00Z"))
  assert.deepEqual(groupes.aujourdHui.map(m => m.id), ["courte", "etendue"])
  assert.deepEqual(groupes.autres.map(m => m.id), ["veille", "demain"])
})
