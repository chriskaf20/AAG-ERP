export type JpegTerrain = { blob: Blob; largeur: number; hauteur: number }

type Operation = Promise<{ error: unknown }>
type Depot = {
  televerser: (chemin: string, blob: Blob) => Operation
  verifierObjet: (chemin: string) => Operation
  consigner: (chemin: string, photo: JpegTerrain) => Operation
}

/** Le même chemin est conservé même si la réponse du serveur a été perdue. */
export async function deposerPhotoTerrain(depot: Depot, chemin: string, photo: JpegTerrain) {
  const { error } = await depot.televerser(chemin, photo.blob)
  if (error && (await depot.verifierObjet(chemin)).error) throw error

  const resultat = await depot.consigner(chemin, photo)
  if (resultat.error) throw resultat.error
}
