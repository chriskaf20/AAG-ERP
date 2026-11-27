import assert from "node:assert/strict"
import { test } from "node:test"
import { deposerPhotoTerrain } from "../src/lib/photos-terrain"

const jpeg = { blob: new Blob(["jpeg"], { type: "image/jpeg" }), largeur: 100, hauteur: 100 }

test("une rupture avant le dépôt permet de reprendre avec le même chemin", async () => {
  let accessible = false
  const objets = new Set<string>()
  const lignes = new Set<string>()
  const erreur = new Error("Réseau coupé")
  const depot = {
    televerser: async (chemin: string) => {
      if (!accessible) return { error: erreur }
      objets.add(chemin)
      return { error: null }
    },
    verifierObjet: async () => ({ error: erreur }),
    consigner: async (chemin: string) => {
      lignes.add(chemin)
      return { error: null }
    },
  }
  await assert.rejects(() => deposerPhotoTerrain(depot, "photo.jpg", jpeg), erreur)
  assert.equal(lignes.size, 0)

  accessible = true
  await deposerPhotoTerrain(depot, "photo.jpg", jpeg)
  assert.deepEqual([...objets], ["photo.jpg"])
  assert.deepEqual([...lignes], ["photo.jpg"])
})

test("une réponse perdue après le dépôt ou la consignation ne crée pas de doublon", async () => {
  const objets = new Set<string>()
  const lignes = new Set<string>()
  let tentatives = 0
  const depot = {
    televerser: async (chemin: string) => {
      objets.add(chemin)
      return { error: new Error("Réponse perdue ou objet existant") }
    },
    verifierObjet: async (chemin: string) => ({ error: objets.has(chemin) ? null : new Error("Objet absent") }),
    consigner: async (chemin: string) => {
      lignes.add(chemin)
      return { error: ++tentatives === 1 ? new Error("Réponse perdue après insertion") : null }
    },
  }

  await assert.rejects(() => deposerPhotoTerrain(depot, "photo.jpg", jpeg), /après insertion/)
  await deposerPhotoTerrain(depot, "photo.jpg", jpeg)
  assert.deepEqual([...objets], ["photo.jpg"])
  assert.deepEqual([...lignes], ["photo.jpg"])
})
