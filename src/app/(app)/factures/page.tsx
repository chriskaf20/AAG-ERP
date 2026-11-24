import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { ListeFinance } from "../finance/liste-finance"

export const metadata: Metadata = { title: "Factures" }

export default async function PageFactures() {
  const { supabase, organisation } = await exiger("factures.read")
  const { data } = await supabase
    .from("factures")
    .select("id, numero, type, statut, total_ttc, solde_du, devise, date_emission, echeance, normalisee_le, dossier_id, dossiers(numero, clients(raison_sociale))")
    .eq("organization_id", organisation.id)
    .order("created_at", { ascending: false })

  const lignes = (data ?? []).map((f) => ({
    id: f.id,
    lien: `/pdf/factures/${f.id}`,
    numero: f.numero ?? "Brouillon",
    statut: f.statut as string,
    type: f.type as string,
    normalisee: Boolean(f.normalisee_le),
    dossier_id: f.dossier_id,
    dossier: f.dossiers?.numero ?? "—",
    client: f.dossiers?.clients?.raison_sociale ?? "—",
    date: f.date_emission,
    echeance: f.echeance,
    montant: f.total_ttc,
    reste: f.solde_du,
    devise: f.devise,
  }))

  return (
    <>
      <SiteHeader titre="Factures" sousTitre={`${lignes.length} facture${lignes.length > 1 ? "s" : ""}`} />
      <PageBody>
        <Section>
          <ListeFinance genre="factures" lignes={lignes} />
        </Section>
      </PageBody>
    </>
  )
}
