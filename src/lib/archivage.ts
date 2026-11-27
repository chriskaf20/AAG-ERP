type OperationsArchive = {
  chercher: () => Promise<string | null>
  preparer: () => Promise<{ chemin: string; nom: string; pdf: Uint8Array }>
  deposer: (chemin: string, pdf: Uint8Array) => Promise<void>
  lireTaille: (chemin: string) => Promise<number>
  consigner: (chemin: string, nom: string, taille: number) => Promise<string>
}

export async function conserverArchive(operations: OperationsArchive): Promise<string> {
  const archive = await operations.chercher()
  if (archive) return archive

  const { chemin, nom, pdf } = await operations.preparer()
  let taille = pdf.length
  try {
    await operations.deposer(chemin, pdf)
  } catch (erreur) {
    // Le premier dépôt a pu aboutir avant une coupure ou un nouvel essai.
    try {
      taille = await operations.lireTaille(chemin)
    } catch {
      throw erreur
    }
  }
  return operations.consigner(chemin, nom, taille)
}
