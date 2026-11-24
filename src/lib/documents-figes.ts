import "server-only"

import { pdfDevis } from "@/lib/pdf/documents"
import { donneesDevis } from "@/lib/pdf/donnees"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Après signature : génère le PDF du devis signé et l'archive dans le dossier
 * (document signé = jamais modifié).
 */
export async function archiverDevisSigne(devisId: string) {
  const admin = createAdminClient()
  const donnees = await donneesDevis(admin, devisId)
  if (!donnees) return
  const { data: d } = await admin
    .from("devis")
    .select("organization_id, dossier_id, numero, version")
    .eq("id", devisId)
    .single()
  if (!d) return
  const pdf = await pdfDevis(donnees)
  const nom = `${d.numero}-v${d.version}-signe.pdf`
  const chemin = `${d.organization_id}/${donnees.dossierNumero}/devis/${Date.now()}-${nom}`
  const { error } = await admin.storage
    .from("dossiers")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: false })
  if (error) throw error
  await admin.from("documents").insert({
    organization_id: d.organization_id,
    dossier_id: d.dossier_id,
    type: "devis",
    libelle: `Devis ${d.numero} v${d.version} signé`,
    bucket: "dossiers",
    chemin,
    nom_fichier: nom,
    mime_type: "application/pdf",
    taille: pdf.length,
    est_signe: true,
  })
}
