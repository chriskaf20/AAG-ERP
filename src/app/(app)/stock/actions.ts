"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { messageErreur, texte } from "@/lib/actions"
import { autoriser } from "@/lib/contexte"

export async function ajouterArticle(fd: FormData) {
  const { ctx, refus } = await autoriser("achats.write")
  if (refus) return refus
  const v = z.object({
    code: z.string().trim().min(1).max(50), nom: z.string().trim().min(1).max(200),
    unite: z.string().trim().min(1).max(30),
  }).safeParse({ code: fd.get("code"), nom: fd.get("nom"), unite: fd.get("unite") })
  if (!v.success) return { message: "Renseignez le code, le nom et l’unité." }
  const { error } = await ctx.supabase.from("stock_articles").insert({ ...v.data, organization_id: ctx.organisation.id })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/stock")
  revalidatePath("/achats")
  return { ok: true, message: "Article créé" }
}

export async function ajouterEmplacement(fd: FormData) {
  const { ctx, refus } = await autoriser("achats.write")
  if (refus) return refus
  const v = z.string().trim().min(1).max(120).safeParse(fd.get("nom"))
  if (!v.success) return { message: "Renseignez le nom de l’emplacement." }
  const { error } = await ctx.supabase.from("stock_emplacements").insert({ nom: v.data, organization_id: ctx.organisation.id })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/stock")
  revalidatePath("/achats")
  return { ok: true, message: "Emplacement créé" }
}

export async function definirDefaut(fd: FormData) {
  const { ctx, refus } = await autoriser("achats.write")
  if (refus || !ctx.roles.includes("gerant")) return { message: "Choix de l’emplacement par défaut réservé au gérant." }
  const v = z.uuid().safeParse(fd.get("emplacement"))
  if (!v.success) return { message: "Choisissez un emplacement." }
  const { error } = await ctx.supabase.rpc("stock_choisir_emplacement_defaut", { p_org: ctx.organisation.id, p_emplacement: v.data })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/stock")
  revalidatePath("/achats")
  return { ok: true, message: "Emplacement par défaut mis à jour" }
}

export async function mouvementStock(type: "sortie" | "ajustement", operation: string, fd: FormData) {
  const { ctx, refus } = await autoriser("achats.write")
  if (refus) return refus
  const v = z.object({
    type: z.enum(["sortie", "ajustement"]), operation: z.uuid(), article: z.uuid(), emplacement: z.uuid(),
    quantite: z.coerce.number().refine(n => Math.abs(n) >= 0.001 && Math.abs(n) <= 999_999_999_999),
    motif: z.string().max(500).nullable(),
  }).safeParse({
    type, operation, article: fd.get("article"), emplacement: fd.get("emplacement"),
    quantite: fd.get("quantite"), motif: texte(fd, "motif"),
  })
  if (!v.success || (type === "sortie" && v.data.quantite < 0) || (type === "ajustement" && !v.data.motif)) {
    return { message: "Vérifiez l’article, l’emplacement et la quantité. Tout ajustement exige un motif." }
  }
  const { error } = await ctx.supabase.rpc("stock_mouvement", {
    p_org: ctx.organisation.id, p_operation: v.data.operation, p_article: v.data.article, p_emplacement: v.data.emplacement,
    p_type: v.data.type, p_quantite: type === "sortie" ? -v.data.quantite : v.data.quantite, p_motif: v.data.motif,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/stock")
  return { ok: true, message: "Mouvement enregistré" }
}
