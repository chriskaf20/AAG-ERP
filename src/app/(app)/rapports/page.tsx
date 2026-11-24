import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageBody, Section } from "@/components/page-body"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { exiger } from "@/lib/contexte"
import { indicateurs } from "@/lib/indicateurs"
import { cartesIndicateurs } from "@/lib/indicateurs-cartes"
import { STATUTS } from "@/lib/permissions"

export const metadata: Metadata = { title: "Rapports" }

export default async function Rapports() {
  const ctx = await exiger("reports.read")
  const [i, t] = await Promise.all([indicateurs(ctx), getTranslations("statuts")])
  if (!i) return null
  const total = Object.values(i.dossiers_par_statut).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <>
      <SiteHeader titre="Rapports" sousTitre="Indicateurs agrégés de l'organisation — montants en équivalent USD (lecture seule)" />
      <PageBody>
        <SectionCards cartes={cartesIndicateurs(i)} />
        <Section>
          <Card>
            <CardHeader>
              <CardTitle>Dossiers par statut</CardTitle>
              <CardDescription>{total} dossier(s)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {STATUTS.filter((s) => i.dossiers_par_statut[s]).map((s) => (
                <div key={s} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{t(s)}</span>
                    <span className="font-medium tabular-nums">{i.dossiers_par_statut[s]}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" aria-hidden>
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${((i.dossiers_par_statut[s] ?? 0) / Math.max(1, total)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>
      </PageBody>
    </>
  )
}
