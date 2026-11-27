import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getOrgId } from "@/lib/contexte"

import { pdfDevis, pdfFacture, pdfRecu, pdfReception, pdfIntervention } from "@/lib/pdf/documents"
import { donneesDevis, donneesFacture, donneesRecu, donneesReception, donneesIntervention } from "@/lib/pdf/donnees"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/** Documents générés à la demande avec la session de l’utilisateur. */
export async function GET(request: NextRequest, { params }: RouteContext<"/pdf/[type]/[id]">) {
  const { type, id } = await params
  if (!z.uuid().safeParse(id).success) return new NextResponse("Document introuvable", { status: 404 })
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
  } else if (type === "receptions") {
    const orgId = await getOrgId()
    if (!z.uuid().safeParse(orgId).success) return new NextResponse("Document introuvable", { status: 404 })
    const d = await donneesReception(db, id, orgId)
    if (d) {
      pdf = await pdfReception(d)
      nom = d.pv.type + "-" + d.dossierNumero + "-v" + d.pv.version
    }
  } else if (type === "interventions") {
    const orgId = await getOrgId()
    if (!z.uuid().safeParse(orgId).success) return new NextResponse("Document introuvable", { status: 404 })
    const d = await donneesIntervention(db, id, orgId)
    if (d) {
      pdf = await pdfIntervention(d)
      nom = "Rapport-" + d.dossierNumero + "-v" + d.rapport.version
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
