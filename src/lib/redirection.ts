/** N'accepte que des chemins internes (évite les redirections ouvertes). */
export function cheminSur(suivant: string | null | undefined, defaut = "/tableau-de-bord") {
  if (
    !suivant ||
    !suivant.startsWith("/") ||
    suivant.startsWith("//") ||
    suivant.startsWith("/\\")
  ) {
    return defaut
  }
  return suivant
}
