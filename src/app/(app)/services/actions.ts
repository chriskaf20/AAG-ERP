"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { messageErreur, type EtatAction } from "@/lib/actions"
import { autoriser, getContexte } from "@/lib/contexte"

const schema = z.object({
  nom: z.string().trim().min(2, "Nom requis").max(150),
  description: z.string().trim().max(1000).nullable(),
  department_id: z.uuid().nullable(),
  unite: z.enum(["forfait", "jour", "mois", "m2", "course"]),
  prix_base_usd: z.coerce.number().min(0, "Prix invalide"),
  actif: z.boolean(),
})

export async function enregistrerService(id: string | null, valeurs: z.input<typeof schema>): Promise<EtatAction> {
  const garde = await autoriser("services.manage")
  if (garde.refus) return garde.refus
  const parsed = schema.safeParse(valeurs)
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Données invalides" }
  const { supabase, organisation } = await getContexte()
  const { error } = id
    ? await supabase.from("services").update(parsed.data).eq("id", id)
    : await supabase.from("services").insert({ ...parsed.data, organization_id: organisation.id })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/services")
  return { ok: true, message: "Service enregistré" }
}
