import type { Metadata } from "next"
import Link from "next/link"

import { StatutBadge } from "@/components/statut-badge"
import { formatDate } from "@/lib/format"
import { exigerPortail } from "@/lib/portail"
import { DocumentsPartages } from "./documents-partages"

export const metadata: Metadata = { title: "Portail client" }

export default async function PagePortail() {
  const { supabase, organisation } = await exigerPortail()
  const [dossiers, documents] = await Promise.all([
    supabase.rpc("portail_dossiers", { p_org: organisation.id }),
    supabase.rpc("portail_documents", { p_org: organisation.id }),
  ])
  if (dossiers.error) throw dossiers.error
  if (documents.error) throw documents.error
  return <>
    <section className="grid gap-2">
      <h1 className="text-xl font-semibold">Mes dossiers</h1>
      {dossiers.data.length === 0 && <p className="text-sm text-muted-foreground">Aucun dossier disponible pour ce compte.</p>}
      <ul className="grid gap-2">
        {dossiers.data.map(d => <li key={d.id} className="rounded-md border">
          <Link href={"/portail/dossiers/" + d.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="font-medium underline">{d.numero}</span>
            <span className="flex-1">{d.service}</span>
            <span className="text-sm text-muted-foreground">{formatDate(d.date_reception)}</span>
            <StatutBadge statut={d.statut} />
          </Link>
        </li>)}
      </ul>
    </section>
    <DocumentsPartages documents={documents.data} />
  </>
}
