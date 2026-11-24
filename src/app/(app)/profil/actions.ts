"use server"

import { revalidatePath } from "next/cache"

import { messageErreur, texte, type EtatAction } from "@/lib/actions"
import { getContexte } from "@/lib/contexte"

export async function modifierMonProfil(_: EtatAction, fd: FormData): Promise<EtatAction> {
  const { supabase, userId } = await getContexte()
  const nom = texte(fd, "nom_complet")
  if (!nom || nom.length < 2) return { erreurs: { nom_complet: ["Nom requis"] } }
  const { error } = await supabase
    .from("profiles")
    .update({ nom_complet: nom, fonction: texte(fd, "fonction"), telephone: texte(fd, "telephone") })
    .eq("id", userId)
  if (error) return { message: messageErreur(error) }
  revalidatePath("/", "layout")
  return { ok: true, message: "Profil enregistré" }
}
