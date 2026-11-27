"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { messageErreur, type EtatAction } from "@/lib/actions"
import { autoriser, getContexte } from "@/lib/contexte"

const schema = z.object({
  bucket: z.enum(["dossiers", "clients"]),
  chemin: z.string().min(3),
  type: z.enum([
    "rccm",
    "id_nat",
    "nif",
    "piece_identite",
    "accuse_reception",
    "fiche_ouverture",
    "fiche_verification",
    "autre",
    "devis",
    "facture",
    "contrat",
    "pv_lancement",
    "pv_reception",
    "rapport_intervention",
    "recu",
  ]),
  libelle: z.string().trim().max(200).nullable(),
  nom_fichier: z.string().min(1).max(255),
  mime_type: z.string().nullable(),
  taille: z.number().int().nonnegative().nullable(),
  dossier_id: z.uuid().nullable(),
  client_id: z.uuid().nullable(),
  version_precedente_id: z.uuid().nullable(),
})

export type NouveauDocument = z.input<typeof schema>

/**
 * Enregistre un document après son dépôt dans Storage (le fichier est envoyé
 * directement depuis le navigateur, sous contrôle des politiques Storage).
 */
export async function enregistrerDocument(doc: NouveauDocument): Promise<EtatAction> {
  const garde = await autoriser("dossiers.verify", "clients.write", "devis.write")
  if (garde.refus) return garde.refus
  const parsed = schema.safeParse(doc)
  if (!parsed.success) return { message: "Document invalide" }

  const { supabase, organisation } = await getContexte()

  // Le chemin doit commencer par l'organisation active
  if (!parsed.data.chemin.startsWith(`${organisation.id}/`)) {
    return { message: "Chemin de stockage invalide" }
  }

  const { error } = await supabase
    .from("documents")
    .insert({ ...parsed.data, organization_id: organisation.id })
  if (error) return { message: messageErreur(error) }

  if (parsed.data.client_id) revalidatePath(`/clients/${parsed.data.client_id}`)
  if (parsed.data.dossier_id) revalidatePath(`/dossiers/${parsed.data.dossier_id}`)
  return { ok: true, message: "Document enregistré" }
}
