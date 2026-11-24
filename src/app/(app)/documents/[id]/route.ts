import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/** Téléchargement d'un document : contrôle RLS puis URL signée de courte durée. */
export async function GET(request: NextRequest, { params }: RouteContext<"/documents/[id]">) {
  const { id } = await params
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from("documents")
    .select("bucket, chemin, nom_fichier")
    .eq("id", id)
    .maybeSingle()
  if (!doc) return new NextResponse("Document introuvable", { status: 404 })

  const telecharger = request.nextUrl.searchParams.has("telecharger")
  const { data, error } = await supabase.storage
    .from(doc.bucket)
    .createSignedUrl(doc.chemin, 60, telecharger ? { download: doc.nom_fichier } : undefined)
  if (error || !data) return new NextResponse("Fichier indisponible", { status: 404 })

  return NextResponse.redirect(data.signedUrl)
}
