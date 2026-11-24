import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { getContexte } from "@/lib/contexte"
import { FormulaireParametres } from "./formulaire-parametres"

export const metadata: Metadata = { title: "Paramètres" }

export default async function PageParametres() {
  const { organisation } = await getContexte()
  const p = (organisation.parametres ?? {}) as Record<string, number>
  return (
    <>
      <SiteHeader titre="Paramètres" sousTitre={organisation.nom} />
      <PageBody>
        <Section className="max-w-3xl">
          <FormulaireParametres
            org={organisation}
            parametres={{
              seuil_validation_usd: p.seuil_validation_usd ?? 0,
              acompte_pct: p.acompte_pct ?? 0,
              garantie_jours: p.garantie_jours ?? 0,
            }}
          />
        </Section>
      </PageBody>
    </>
  )
}
