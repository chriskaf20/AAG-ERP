export const FUSEAU_HORAIRE = "Africa/Lubumbashi"

const heure = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: FUSEAU_HORAIRE })

export function formatDate(d: string | null | undefined) {
  if (!d) return "—"
  // Les dates « AAAA-MM-JJ » sont des dates civiles : pas de décalage horaire
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`) : new Date(d)
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: FUSEAU_HORAIRE }).format(date)
}

export function formatDateHeure(d: string | null | undefined) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: FUSEAU_HORAIRE,
  }).format(new Date(d))
}

export function formatHeure(d: string) {
  return heure.format(new Date(d))
}

export function formatMontant(montant: number | null | undefined, devise = "USD") {
  if (montant == null) return "—"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise,
    maximumFractionDigits: devise === "CDF" ? 0 : 2,
  }).format(montant)
}

export function formatTaille(octets: number | null | undefined) {
  if (octets == null) return "—"
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`
}

export function initiales(nom: string | null | undefined) {
  if (!nom) return "?"
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}
