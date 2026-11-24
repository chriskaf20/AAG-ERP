import { BanknoteIcon, FileSignatureIcon, HourglassIcon, ReceiptTextIcon, TrendingUpIcon } from "lucide-react"

import type { StatCarte } from "@/components/section-cards"
import { formatMontant } from "@/lib/format"
import type { Indicateurs } from "@/lib/indicateurs"

export function cartesIndicateurs(i: Indicateurs): StatCarte[] {
  const cartes: StatCarte[] = [
    { libelle: `CA signé ${i.annee} (HT)`, valeur: formatMontant(i.ca_signe_ht_usd, "USD"), detail: `${i.devis_signes} devis signé(s)`, icone: <FileSignatureIcon className="size-5" /> },
    { libelle: `CA facturé ${i.annee} (HT)`, valeur: formatMontant(i.ca_facture_ht_usd, "USD"), icone: <ReceiptTextIcon className="size-5" /> },
    { libelle: `Encaissé ${i.annee}`, valeur: formatMontant(i.encaisse_usd, "USD"), icone: <BanknoteIcon className="size-5" /> },
    { libelle: "Impayés", valeur: formatMontant(i.impayes_usd, "USD"), detail: "Reste dû sur factures émises", icone: <HourglassIcon className="size-5" /> },
  ]
  if (i.marge_signee_usd != null) {
    cartes.push({
      libelle: "Marge estimée (devis signés)",
      valeur: formatMontant(i.marge_signee_usd, "USD"),
      icone: <TrendingUpIcon className="size-5" />,
      accent: true,
    })
  }
  return cartes
}

