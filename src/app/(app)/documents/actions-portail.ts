"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { messageErreur } from "@/lib/actions"
import { getContexte } from "@/lib/contexte"

async function lier(client: string, compte: FormDataEntryValue | null, actif: boolean) {
  const ctx = await getContexte()
  if (!ctx.roles.includes("gerant")) return { message: "Gestion réservée au gérant." }
  const v = z.object({ client: z.uuid(), compte: z.uuid() }).safeParse({ client, compte })
  if (!v.success) return { message: "Choisissez un compte client." }
  const { error } = await ctx.supabase.rpc("portail_lier_compte", {
    p_org: ctx.organisation.id, p_client: v.data.client, p_user: v.data.compte, p_actif: actif,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/clients/" + v.data.client)
  revalidatePath("/portail", "layout")
  return { ok: true, message: actif ? "Compte rattaché" : "Accès retiré" }
}

export async function rattacherCompte(client: string, fd: FormData) {
  return lier(client, fd.get("compte"), true)
}

export async function retirerCompte(client: string, compte: string) {
  return lier(client, compte, false)
}

export async function partagerDocumentPortail(document: string, actif: boolean) {
  const ctx = await getContexte()
  if (!ctx.roles.includes("gerant")) return { message: "Partage réservé au gérant." }
  const id = z.uuid().safeParse(document)
  if (!id.success) return { message: "Document invalide." }
  const { error } = await ctx.supabase.rpc("portail_partager_document", {
    p_org: ctx.organisation.id, p_document: id.data, p_actif: actif === true,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/dossiers/[id]", "page")
  revalidatePath("/clients/[id]", "page")
  revalidatePath("/portail", "layout")
  return { ok: true, message: actif ? "Document partagé avec le client" : "Partage révoqué" }
}
