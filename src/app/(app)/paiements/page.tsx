import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exiger } from "@/lib/contexte"
import { formatDate, formatMontant } from "@/lib/format"

export const metadata: Metadata = { title: "Paiements" }

export default async function PagePaiements() {
  const { supabase, organisation } = await exiger("paiements.write", "factures.write")
  const t = await getTranslations("modesPaiement")
  const { data } = await supabase
    .from("paiements")
    .select("id, numero_recu, montant, devise, mode, reference, date_paiement, dossier_id, factures(numero), dossiers(numero, clients(raison_sociale))")
    .eq("organization_id", organisation.id)
    .order("date_paiement", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500)

  const paiements = data ?? []
  const totaux = paiements.reduce<Record<string, number>>((acc, p) => {
    acc[p.devise] = (acc[p.devise] ?? 0) + p.montant
    return acc
  }, {})

  return (
    <>
      <SiteHeader
        titre="Paiements"
        sousTitre={Object.entries(totaux).map(([d, m]) => formatMontant(m, d)).join(" · ") || "Aucun encaissement"}
      />
      <PageBody>
        <Section>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paiements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      Aucun paiement.
                    </TableCell>
                  </TableRow>
                )}
                {paiements.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <a href={`/pdf/recus/${p.id}`} target="_blank" rel="noopener" className="font-medium text-primary hover:underline dark:text-foreground">
                        {p.numero_recu}
                      </a>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(p.date_paiement)}</TableCell>
                    <TableCell className="max-w-48 truncate">{p.dossiers?.clients?.raison_sociale}</TableCell>
                    <TableCell>
                      <Link href={`/dossiers/${p.dossier_id}?onglet=factures`} className="hover:underline">
                        {p.factures?.numero}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t(p.mode)}
                      {p.reference && <span className="block text-xs text-muted-foreground">{p.reference}</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{formatMontant(p.montant, p.devise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      </PageBody>
    </>
  )
}
