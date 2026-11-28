import assert from "node:assert/strict"
import test from "node:test"
import { conserverArchive } from "../src/lib/archivage"

function recette() {
  const etat = { fichier: false, archive: false, upload: 0, taille: 0, panneDepot: false, panneReponse: false, panneConsignation: false }
  const operations = {
    chercher: async () => etat.archive ? "archive-1" : null,
    preparer: async () => ({ chemin: "devis-stable.pdf", nom: "devis-signe.pdf", pdf: new Uint8Array(10) }),
    deposer: async (chemin: string) => {
      assert.equal(chemin, "devis-stable.pdf")
      etat.upload++
      if (etat.fichier || etat.panneDepot) throw new Error("dépôt échoué")
      etat.fichier = true
      if (etat.panneReponse) throw new Error("réponse de dépôt perdue")
    },
    lireTaille: async () => {
      if (!etat.fichier) throw new Error("fichier absent")
      return 10
    },
    consigner: async (_chemin: string, _nom: string, taille: number) => {
      if (etat.panneConsignation) throw new Error("métadonnées indisponibles")
      etat.taille = taille
      etat.archive = true
      return "archive-1"
    },
  }
  return { etat, operations }
}

test("une archive retrouvée est réutilisée sans régénération ni dépôt", async () => {
  const { operations, etat } = recette()
  const archive = await conserverArchive({
    ...operations,
    chercher: async () => "archive-historique",
    preparer: async () => assert.fail("la préparation du PDF est inutile"),
  })
  assert.equal(archive, "archive-historique")
  assert.equal(etat.upload, 0)
})

test("une panne de dépôt conserve le devis sans créer une archive vide, puis la reprise aboutit", async () => {
  const { etat, operations } = recette()
  etat.panneDepot = true
  await assert.rejects(conserverArchive(operations), /dépôt échoué/)
  assert.equal(etat.archive, false)
  etat.panneDepot = false
  assert.equal(await conserverArchive(operations), "archive-1")
  assert.equal(etat.taille, 10)
})

test("une réponse de dépôt perdue consigne le fichier existant", async () => {
  const { etat, operations } = recette()
  etat.panneReponse = true
  assert.equal(await conserverArchive(operations), "archive-1")
  assert.equal(etat.upload, 1)
})

test("une panne de consignation réutilise le fichier déjà déposé et une relance retrouve la même archive", async () => {
  const { etat, operations } = recette()
  etat.panneConsignation = true
  await assert.rejects(conserverArchive(operations), /métadonnées/)
  assert.equal(etat.fichier, true)
  etat.panneConsignation = false
  assert.equal(await conserverArchive(operations), "archive-1")
  assert.equal(await conserverArchive(operations), "archive-1")
  assert.equal(etat.upload, 2)
});
