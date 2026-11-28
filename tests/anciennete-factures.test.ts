import assert from "node:assert/strict"
import test from "node:test"
import { dateFacturation, trancheImpaye } from "../src/lib/anciennete-factures"

test("une facture devient échue après minuit à Lubumbashi", () => {
  const avant = dateFacturation(new Date("2026-11-27T21:59:59Z"))
  const apres = dateFacturation(new Date("2026-11-27T22:00:00Z"))
  assert.equal(avant, "2026-11-27")
  assert.equal(apres, "2026-11-28")
  assert.equal(trancheImpaye("2026-11-27", avant), "non_echu")
  assert.equal(trancheImpaye("2026-11-27", apres), "0_30")
  assert.equal(trancheImpaye("2026-11-29", apres), "non_echu")
  assert.equal(trancheImpaye(null, apres), "non_echu")
})

test("les tranches d’impayés basculent aux 31e, 61e et 91e jours civils", () => {
  const aujourdHui = "2026-11-28"
  for (const [echeance, attendue] of [
    ["2026-10-29", "0_30"],
    ["2026-10-28", "31_60"],
    ["2026-09-29", "31_60"],
    ["2026-09-28", "61_90"],
    ["2026-08-30", "61_90"],
    ["2026-08-29", "90_plus"],
  ]) assert.equal(trancheImpaye(echeance, aujourdHui), attendue)
})
