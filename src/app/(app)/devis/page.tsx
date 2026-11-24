import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { ListeFinance } from "../finance/liste-finance"

export const metadata: Metadata = { title: "Devis" }

export default async function PageDevis() {
  const { supabase, organisation } = await exiger("devis.read")
  const { data } = await supabase
    .from("devis")
    .select("id, numero, version, statut, total_ttc, devise, date_devis, date_validite, dossier_id, dossiers(numero, clients(raison_sociale))")
    .eq("organization_id", organisation.id)
    .neq("statut", "remplace")
    .order("created_at", { ascending: false })

  const lignes = (data ?? []).map((d) => ({
    id: d.id,
    lien: `/pdf/devis/${d.id}`,
    numero: `${d.numero} v${d.version}`,
    statut: d.statut as string,
    dossier_id: d.dossier_id,
    dossier: d.dossiers?.numero ?? "—",
    client: d.dossiers?.clients?.raison_sociale ?? "—",
    date: d.date_devis,
    echeance: d.date_validite,
    montant: d.total_ttc,
    reste: null,
    devise: d.devise,
  }))

  return (
    <>
      <SiteHeader titre="Devis" sousTitre={`${lignes.length} devis`} />
      <PageBody>
        <Section>
          <ListeFinance genre="devis" lignes={lignes} />
        </Section>
      </PageBody>
    </>
  )
}
