import { FUSEAU_HORAIRE } from "./format"

export const TRANCHES_IMPAYES = [
  { cle: "non_echu", libelle: "Non échu" },
  { cle: "0_30", libelle: "1–30 j" },
  { cle: "31_60", libelle: "31–60 j" },
  { cle: "61_90", libelle: "61–90 j" },
  { cle: "90_plus", libelle: "> 90 j" },
] as const

const dateLocale = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSEAU_HORAIRE })

export function dateFacturation(maintenant = new Date()) {
  return dateLocale.format(maintenant)
}

export function trancheImpaye(echeance: string | null, aujourdHui: string): (typeof TRANCHES_IMPAYES)[number]["cle"] {
  if (!echeance || echeance >= aujourdHui) return "non_echu"
  // Les dates SQL représentent des jours civils. Le calcul à minuit UTC conserve leur écart en jours.
  const jours = (Date.parse(aujourdHui) - Date.parse(echeance)) / 86_400_000
  if (jours <= 30) return "0_30"
  if (jours <= 60) return "31_60"
  if (jours <= 90) return "61_90"
  return "90_plus"
}
