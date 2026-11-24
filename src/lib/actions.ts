export type EtatAction = {
  ok?: boolean
  message?: string
  erreurs?: Record<string, string[] | undefined>
} | null

type ErreurPostgrest = { message: string; code?: string } | null | undefined

/** Traduit une erreur Supabase en message lisible (les règles métier sont déjà en français). */
export function messageErreur(e: ErreurPostgrest): string {
  if (!e) return "Une erreur est survenue"
  if (e.message.includes("row-level security")) {
    return "Action non autorisée pour votre rôle"
  }
  if (e.code === "23505") return "Cet élément existe déjà"
  if (e.code === "23503") return "Élément lié introuvable ou encore utilisé"
  return e.message
}

/** Champ texte optionnel d'un FormData → string | null */
export function texte(fd: FormData, cle: string): string | null {
  const v = fd.get(cle)
  if (typeof v !== "string") return null
  const t = v.trim()
  return t === "" ? null : t
}
