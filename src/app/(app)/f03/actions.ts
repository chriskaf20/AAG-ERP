"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { messageErreur, texte, type EtatAction } from "@/lib/actions"
import { getContexte } from "@/lib/contexte"
import { CHAMPS_F03 } from "@/lib/f03"

const cible = z.object({ dossier: z.uuid(), version: z.number().int().positive() })

function rafraichir(dossier: string) {
  revalidatePath("/f03")
  revalidatePath(`/f03/${dossier}`)
  revalidatePath(`/dossiers/${dossier}`)
}

export async function enregistrerF03(dossier: string, version: number, modifieLe: string | null, soumettre: boolean, fd: FormData): Promise<EtatAction> {
  if (!cible.safeParse({ dossier, version }).success) return { message: "Version F-03 introuvable" }
  const ctx = await getContexte()
  const contenu = Object.fromEntries(CHAMPS_F03.map(({ nom }) => [nom, texte(fd, nom) ?? ""]))
  const champManquant = soumettre && CHAMPS_F03.find(({ nom }) => !contenu[nom])
  if (champManquant) return { message: `Champ à renseigner avant la soumission · ${champManquant.libelle}` }
  const { error } = await ctx.supabase.rpc("enregistrer_f03", {
    p_org: ctx.organisation.id, p_dossier: dossier, p_version: version,
    p_modifie_le: modifieLe ?? undefined, p_contenu: contenu, p_soumettre: soumettre,
  })
  if (error) return { message: messageErreur(error) }
  rafraichir(dossier)
  return { ok: true, message: soumettre ? "Version soumise à Digital" : "Brouillon enregistré" }
}

export async function deciderF03(dossier: string, version: number, valide: boolean, fd: FormData): Promise<EtatAction> {
  if (!cible.safeParse({ dossier, version }).success) return { message: "Version F-03 introuvable" }
  const ctx = await getContexte()
  const { error } = await ctx.supabase.rpc("decider_f03", {
    p_org: ctx.organisation.id, p_dossier: dossier, p_version: version, p_valide: valide,
    p_motif: texte(fd, "motif") ?? undefined,
  })
  if (error) return { message: messageErreur(error) }
  rafraichir(dossier)
  return { ok: true, message: valide ? "Version validée par Digital" : "Corrections transmises" }
}

export async function consignerAccordF03(dossier: string, version: number, fd: FormData): Promise<EtatAction> {
  if (!cible.safeParse({ dossier, version }).success) return { message: "Version F-03 introuvable" }
  const date = z.iso.date().safeParse(fd.get("date"))
  const reference = texte(fd, "reference")
  if (!date.success || !reference) return { message: "Indiquez la date et la référence de l’accord client" }
  const ctx = await getContexte()
  const { error } = await ctx.supabase.rpc("consigner_accord_f03", {
    p_org: ctx.organisation.id, p_dossier: dossier, p_version: version,
    p_date: date.data, p_reference: reference,
  })
  if (error) return { message: messageErreur(error) }
  rafraichir(dossier)
  return { ok: true, message: "Accord client consigné sur cette version" }
}
