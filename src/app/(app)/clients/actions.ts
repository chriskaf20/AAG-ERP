"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { messageErreur, type EtatAction } from "@/lib/actions"
import { autoriser, getContexte } from "@/lib/contexte"
import { clientSchema, contactSchema } from "@/lib/schemas"

const CHAMPS_CLIENT = [
  "type",
  "raison_sociale",
  "rccm",
  "nif",
  "id_nat",
  "adresse",
  "ville",
  "telephone",
  "email",
  "notes",
] as const

function lireClient(fd: FormData) {
  return clientSchema.safeParse(Object.fromEntries(CHAMPS_CLIENT.map((k) => [k, fd.get(k)])))
}

export async function creerClient(_: EtatAction, fd: FormData): Promise<EtatAction> {
  const garde = await autoriser("clients.write")
  if (garde.refus) return garde.refus
  const parsed = lireClient(fd)
  if (!parsed.success) return { erreurs: z.flattenError(parsed.error).fieldErrors }

  const { supabase, organisation } = await getContexte()
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, organization_id: organisation.id })
    .select("id")
    .single()
  if (error) return { message: messageErreur(error) }

  revalidatePath("/clients")
  redirect(`/clients/${data.id}`)
}

export async function modifierClient(id: string, _: EtatAction, fd: FormData): Promise<EtatAction> {
  const garde = await autoriser("clients.write")
  if (garde.refus) return garde.refus
  const parsed = lireClient(fd)
  if (!parsed.success) return { erreurs: z.flattenError(parsed.error).fieldErrors }

  const { supabase } = await getContexte()
  const { error, count } = await supabase
    .from("clients")
    .update(parsed.data, { count: "exact" })
    .eq("id", id)
  if (error) return { message: messageErreur(error) }
  if (!count) return { message: "Action non autorisée pour votre rôle" }

  revalidatePath(`/clients/${id}`)
  return { ok: true, message: "Client enregistré" }
}

function lireContact(fd: FormData) {
  return contactSchema.safeParse({
    nom: fd.get("nom"),
    fonction: fd.get("fonction"),
    telephone: fd.get("telephone"),
    email: fd.get("email"),
    est_signataire: fd.get("est_signataire") === "on",
  })
}

export async function enregistrerContact(
  clientId: string,
  contactId: string | null,
  _: EtatAction,
  fd: FormData
): Promise<EtatAction> {
  const garde = await autoriser("clients.write")
  if (garde.refus) return garde.refus
  const parsed = lireContact(fd)
  if (!parsed.success) return { erreurs: z.flattenError(parsed.error).fieldErrors }

  const { supabase, organisation } = await getContexte()
  const { error } = contactId
    ? await supabase.from("contacts").update(parsed.data).eq("id", contactId)
    : await supabase
        .from("contacts")
        .insert({ ...parsed.data, client_id: clientId, organization_id: organisation.id })
  if (error) return { message: messageErreur(error) }

  revalidatePath(`/clients/${clientId}`)
  return { ok: true, message: "Contact enregistré" }
}

export async function supprimerContact(clientId: string, contactId: string): Promise<EtatAction> {
  const garde = await autoriser("clients.write")
  if (garde.refus) return garde.refus
  const { supabase } = await getContexte()
  const { error } = await supabase.from("contacts").delete().eq("id", contactId)
  if (error) return { message: messageErreur(error) }
  revalidatePath(`/clients/${clientId}`)
  return { ok: true, message: "Contact supprimé" }
}
