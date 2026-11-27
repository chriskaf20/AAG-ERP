import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { FormulaireParametres } from "./formulaire-parametres"
import { ParametresEmails } from "./relances"

export const metadata: Metadata = { title: "Paramètres" }

export default async function PageParametres() {
  const { organisation, roles } = await exiger("admin.settings")
  const p = (organisation.parametres ?? {}) as Record<string, unknown>
  const n = (k: string, d = 0) => Number(p[k] ?? d)
  const tva = Array.isArray(p.taxes) ? (p.taxes as { code: string; taux: number }[]).find((t) => t.code === "TVA") : undefined
  return (
    <>
      <SiteHeader titre="Paramètres" sousTitre={organisation.nom} />
      <PageBody>
        <Section className="flex max-w-3xl flex-col gap-4">
          <FormulaireParametres
            org={organisation}
            parametres={{
              seuil_validation_usd: n("seuil_validation_usd"),
              acompte_pct: n("acompte_pct"),
              garantie_jours: n("garantie_jours"),
              tva_pct: tva?.taux ?? 16,
              taux_cdf: n("taux_cdf", 2800),
              delai_paiement_jours: n("delai_paiement_jours", 15),
              devis_validite_jours: n("devis_validite_jours", 30),
              conditions_paiement: String(p.conditions_paiement ?? ""),
            }}
          />
          <ParametresEmails
            type="relances"
            actives={p.relances_actives === true}
            mode={p.relances_mode === "reel" ? "reel" : "simulation"}
            gerant={roles.includes("gerant")}
          />
          <ParametresEmails
            type="points"
            actives={p.points_avancement_email_actifs === true}
            mode={p.points_avancement_email_mode === "reel" ? "reel" : "simulation"}
            gerant={roles.includes("gerant")}
          />
        </Section>
      </PageBody>
    </>
  )
}
