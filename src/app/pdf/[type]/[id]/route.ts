import { NextResponse, type NextRequest } from "next/server"

import { pdfDevis, pdfFacture, pdfRecu } from "@/lib/pdf/documents"
import { donneesDevis, donneesFacture, donneesRecu } from "@/lib/pdf/donnees"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/** PDF devis / facture / reçu, générés à la demande (accès contrôlé par la RLS). */
export async function GET(request: NextRequest, { params }: RouteContext<"/pdf/[type]/[id]">) {
  const { type, id } = await params
  const db = await createClient()

  let pdf: Buffer | null = null
  let nom = "document"
  if (type === "devis") {
    const d = await donneesDevis(db, id)
    if (d) {
      pdf = await pdfDevis(d)
      nom = `${d.devis.numero}-v${d.devis.version}`
    }
  } else if (type === "factures") {
    const d = await donneesFacture(db, id)
    if (d) {
      pdf = await pdfFacture(d)
      nom = d.facture.numero ?? "facture-brouillon"
    }
  } else if (type === "recus") {
    const d = await donneesRecu(db, id)
    if (d) {
      pdf = await pdfRecu(d)
      nom = d.paiement.numero_recu
    }
  }
  if (!pdf) return new NextResponse("Document introuvable", { status: 404 })

  const telecharger = request.nextUrl.searchParams.has("telecharger")
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${telecharger ? "attachment" : "inline"}; filename="${nom}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
