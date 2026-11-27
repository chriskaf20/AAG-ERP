"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { messageErreur, texte } from "@/lib/actions"
import { autoriser } from "@/lib/contexte"

export async function enregistrerFournisseur(id: string | null, fd: FormData) {
  const { ctx, refus } = await autoriser("fournisseurs.manage")
  if (refus) return refus
  const email = texte(fd, "email")
  const note = texte(fd, "evaluation")
  const valeurs = z.object({
    nom: z.string().min(1).max(200), email: z.email().nullable(), evaluation: z.number().int().min(1).max(5).nullable(),
  }).safeParse({ nom: texte(fd, "nom"), email, evaluation: note ? Number(note) : null })
  if (!valeurs.success) return { message: "Vérifiez le nom, l’e-mail et l’évaluation de 1 à 5." }
  if (id && !z.uuid().safeParse(id).success) return { message: "Fournisseur introuvable." }
  const donnees = {
    ...valeurs.data, rccm: texte(fd, "rccm"), nif: texte(fd, "nif"), categorie: texte(fd, "categorie"),
    contact: texte(fd, "contact"), telephone: texte(fd, "telephone"), actif: fd.get("actif") === "on",
  }
  const requete = id
    ? ctx.supabase.from("fournisseurs").update(donnees).eq("id", id).eq("organization_id", ctx.organisation.id)
    : ctx.supabase.from("fournisseurs").insert({ ...donnees, organization_id: ctx.organisation.id })
  const { error } = await requete.select("id").single()
  if (error) return { message: messageErreur(error) }
  revalidatePath("/fournisseurs")
  revalidatePath("/achats")
  return { ok: true, message: "Fournisseur enregistré" }
}
