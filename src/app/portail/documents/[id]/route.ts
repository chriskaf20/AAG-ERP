import { NextResponse } from "next/server"
import { z } from "zod"

import { getContexte } from "@/lib/contexte"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return new NextResponse("Document introuvable", { status: 404 })
  const { supabase, organisation, roles } = await getContexte()
  if (!roles.includes("client")) return new NextResponse("Document introuvable", { status: 404 })

  const { data: fichier } = await supabase.rpc("portail_document_fichier", {
    p_org: organisation.id, p_document: id,
  }).maybeSingle()
  if (!fichier) return new NextResponse("Document introuvable", { status: 404 })

  const { data } = await supabase.storage.from(fichier.bucket).download(fichier.chemin)
  if (!data) return new NextResponse("Fichier indisponible", { status: 404 })

  const nom = encodeURIComponent(fichier.nom_fichier).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())
  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment; filename*=UTF-8''" + nom,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
