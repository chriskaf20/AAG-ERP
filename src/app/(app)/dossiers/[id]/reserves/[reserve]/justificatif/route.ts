import { NextResponse } from "next/server"
import { z } from "zod"

import { getContexte } from "@/lib/contexte"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; reserve: string }> }) {
  const v = z.object({ id: z.uuid(), reserve: z.uuid() }).safeParse(await params)
  const absent = () => new NextResponse("Justificatif introuvable", { status: 404 })
  if (!v.success) return absent()
  const { supabase, organisation } = await getContexte()
  const { data: preuve } = await supabase.from("reserves").select("justificatif_chemin, justificatif_nom")
    .eq("organization_id", organisation.id).eq("dossier_id", v.data.id).eq("id", v.data.reserve).eq("statut", "levee").maybeSingle()
  if (!preuve?.justificatif_chemin || !preuve.justificatif_nom) return absent()

  const { data } = await supabase.storage.from("dossiers").download(preuve.justificatif_chemin)
  if (!data) return absent()
  const nom = encodeURIComponent(preuve.justificatif_nom).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())
  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment; filename*=UTF-8''" + nom,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
