import assert from "node:assert/strict"
import { test } from "node:test"

import { a, permissionsDe, PERMISSIONS, ROLE_PERMISSIONS, ROLES, transitionsManuelles } from "../src/lib/permissions"

test("chaque permission de la matrice existe", () => {
  for (const r of ROLES) for (const p of ROLE_PERMISSIONS[r]) assert.ok(PERMISSIONS.includes(p), `${r} → ${p}`)
})

test("admin_systeme : administration et missions affectées", () => {
  assert.deepEqual(permissionsDe(["admin_systeme"]), ["admin.users", "admin.settings", "audit.read", "missions.read_assigned", "missions.report"])
})

test("devis.send : gérant et responsable de département uniquement", () => {
  const avec = ROLES.filter((r) => ROLE_PERMISSIONS[r].includes("devis.send"))
  assert.deepEqual(avec, ["gerant", "responsable_departement"])
})

test("décision et validation : gérant uniquement", () => {
  for (const perm of ["dossiers.decide", "devis.validate"] as const) {
    assert.deepEqual(ROLES.filter((r) => ROLE_PERMISSIONS[r].includes(perm)), ["gerant"])
  }
})

test("agent terrain : périmètre affecté ; client : aucun accès interne", () => {
  assert.deepEqual(permissionsDe(["agent_terrain"]), ["dossiers.read_assigned", "missions.read_assigned", "missions.report"])
  assert.deepEqual(permissionsDe(["client"]), [])
})

test("associé : rapports agrégés, marges et missions affectées", () => {
  assert.deepEqual(permissionsDe(["associe"]), ["marges.read", "reports.read", "missions.read_assigned", "missions.report"])
})

test("DAF : lit tous les dossiers sans les modifier", () => {
  const p = permissionsDe(["daf"])
  assert.ok(a(p, "dossiers.read_all") && a(p, "paiements.write") && a(p, "normalisation.write"))
  assert.ok(!a(p, "dossiers.create") && !a(p, "dossiers.verify") && !a(p, "devis.write"))
})

test("union multi-rôle : responsable de dossier + acheteur", () => {
  const p = permissionsDe(["responsable_dossier", "acheteur"])
  assert.equal(p.length, 14)
  assert.ok(a(p, "dossiers.read_own") && a(p, "dossiers.read_dept"))
  assert.ok(!a(p, "devis.send"))
})

test("union multi-rôle : gérant + admin_systeme = permissions du gérant", () => {
  assert.deepEqual(permissionsDe(["gerant", "admin_systeme"]), permissionsDe(["gerant"]))
  assert.equal(permissionsDe(["gerant", "admin_systeme"]).length, 24)
})

test("union : ordre stable et sans doublon", () => {
  const p = permissionsDe(["acheteur", "responsable_dossier", "acheteur"])
  assert.equal(new Set(p).size, p.length)
  assert.deepEqual(p, PERMISSIONS.filter((x) => p.includes(x)))
})

test("transitions manuelles selon les droits sur le dossier", () => {
  const aucun = { verify: false, decide: false, execution_write: false, reception_write: false }
  assert.deepEqual(transitionsManuelles("nouveau", { ...aucun, verify: true }), ["en_verification"])
  assert.deepEqual(transitionsManuelles("nouveau", { ...aucun, decide: true }), ["classe_sans_suite"])
  assert.deepEqual(transitionsManuelles("devis_envoye", aucun), [])
  assert.deepEqual(transitionsManuelles("en_lancement", { ...aucun, execution_write: true }), ["en_cours"])
  assert.deepEqual(transitionsManuelles("en_cours", { ...aucun, execution_write: true }), ["livre"])
  assert.deepEqual(transitionsManuelles("livre", { ...aucun, reception_write: true }), ["reserves", "receptionne_a_facturer"])
  assert.deepEqual(transitionsManuelles("livre", { ...aucun, execution_write: true }), [])
})
