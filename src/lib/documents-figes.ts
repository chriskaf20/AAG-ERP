import "server-only"

import { conserverArchive } from "@/lib/archivage"
import { pdfDevis } from "@/lib/pdf/documents"
import { donneesDevis } from "@/lib/pdf/donnees"
import { createAdminClient } from "@/lib/supabase/admin"

export async function archiverDevisSigne(devisId: string) {
  const admin = createAdminClient()
  const stockage = admin.storage.from("dossiers")

  return conserverArchive({
    async chercher() {
      const { data, error } = await admin.rpc("rattacher_archive_devis_existante", { p_devis: devisId })
      if (error) throw error
      return data ?? null
    },
    async preparer() {
      const donnees = await donneesDevis(admin, devisId)
      if (!donnees || donnees.devis.statut !== "signe" || !donnees.signature || !donnees.lignes.length) {
        throw new Error("Le devis signé complet est introuvable")
      }
      const d = donnees.devis
      return {
        chemin: `${d.organization_id}/${donnees.dossierNumero}/archives-devis/${devisId}.pdf`,
        nom: `${d.numero}-v${d.version}-signe.pdf`,
        pdf: await pdfDevis(donnees),
      }
    },
    async deposer(chemin, pdf) {
      const { error } = await stockage.upload(chemin, pdf, { contentType: "application/pdf", upsert: false })
      if (error) throw error
    },
    async lireTaille(chemin) {
      const { data, error } = await stockage.download(chemin)
      if (error) throw error
      if (!data?.size) throw new Error("L’archive est introuvable")
      return data.size
    },
    async consigner(chemin, nom, taille) {
      const { data, error } = await admin.rpc("consigner_archive_devis", {
        p_devis: devisId, p_chemin: chemin, p_nom: nom, p_taille: taille,
      })
      if (error) throw error
      if (!data) throw new Error("Archivage incomplet")
      return data
    },
  })
}
