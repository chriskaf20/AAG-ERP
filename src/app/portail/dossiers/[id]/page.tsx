import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { StatutBadge } from "@/components/statut-badge"
import { formatDate } from "@/lib/format"
import { exigerPortail } from "@/lib/portail"
import { DocumentsPartages } from "../../documents-partages"

export default async function DossierPortail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const { supabase, organisation } = await exigerPortail()
  const args = { p_org: organisation.id, p_dossier: id }
  const { data, error } = await supabase.rpc("portail_dossiers", args).maybeSingle()
  if (error) throw error
  if (!data) notFound()
  const documents = await supabase.rpc("portail_documents", args)
  if (documents.error) throw documents.error
  return <>
    <div className="grid gap-2">
      <Link href="/portail" className="text-sm underline">Mes dossiers</Link>
      <h1 className="text-xl font-semibold">{data.numero} · {data.service}</h1>
      <p className="flex flex-wrap items-center gap-2">{formatDate(data.date_reception)} <StatutBadge statut={data.statut} /></p>
    </div>
    <DocumentsPartages documents={documents.data} />
  </>
}
