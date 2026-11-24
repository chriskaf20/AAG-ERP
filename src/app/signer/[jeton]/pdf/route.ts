import { NextResponse } from "next/server"

import { pdfDevis } from "@/lib/pdf/documents"
import { donneesDevis } from "@/lib/pdf/donnees"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

/** PDF du devis consultable depuis un lien de signature valide. */
export async function GET(_: Request, { params }: RouteContext<"/signer/[jeton]/pdf">) {
  const { jeton } = await params
  if (!/^[0-9a-f]{64}$/.test(jeton)) return new NextResponse("Lien invalide", { status: 404 })
  const admin = createAdminClient()
  const { data } = await admin.rpc("lien_signature_info", { p_token: jeton })
  const info = data as { valide: boolean; objet_type: string; objet_id: string } | null
  if (!info?.valide || info.objet_type !== "devis") return new NextResponse("Lien invalide", { status: 404 })
  const d = await donneesDevis(admin, info.objet_id)
  if (!d) return new NextResponse("Devis introuvable", { status: 404 })
  const pdf = await pdfDevis(d)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${d.devis.numero}-v${d.devis.version}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  })
}
