"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { messageErreur, texte } from "@/lib/actions"
import { autoriser } from "@/lib/contexte"

const ligne = z.object({ article_id: z.uuid().nullable(), description: z.string().trim().min(1).max(500), quantite: z.coerce.number().positive(), prix_unitaire: z.coerce.number().min(0) })

export async function enregistrerCommande(id: string | null, fd: FormData) {
  const { ctx, refus } = await autoriser("achats.write")
  if (refus) return refus
  const quantites = fd.getAll("quantite")
  const prix = fd.getAll("prix_unitaire")
  const articles = fd.getAll("article_id")
  const saisie = z.object({
    id: z.uuid().nullable(), fournisseur: z.uuid(), departement: z.uuid(), dossier: z.uuid().nullable(),
    objet: z.string().trim().min(1).max(300), devise: z.enum(["USD", "CDF"]), lignes: z.array(ligne).min(1),
  }).safeParse({
    id, fournisseur: texte(fd, "fournisseur"), departement: texte(fd, "departement"), dossier: texte(fd, "dossier"),
    objet: texte(fd, "objet"), devise: fd.get("devise"),
    lignes: fd.getAll("description").map((description, i) => ({ description, quantite: quantites[i], prix_unitaire: prix[i], article_id: articles[i] || null })),
  })
  if (!saisie.success) return { message: "Vérifiez le fournisseur, le département, l’objet et les lignes." }

  const v = saisie.data
  const { error } = await ctx.supabase.rpc("enregistrer_bon_commande", {
    p_org: ctx.organisation.id, p_fournisseur: v.fournisseur, p_departement: v.departement, p_dossier: v.dossier,
    p_objet: v.objet, p_devise: v.devise, p_lignes: v.lignes, p_bon: v.id ?? undefined,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/achats")
  return { ok: true, message: "Bon de commande enregistré" }
}

export async function avancerCommande(id: string, action: string, fd: FormData) {
  const { ctx, refus } = await autoriser(action === "valider" ? "achats.validate" : "achats.write")
  if (refus) return refus
  const saisie = z.object({ id: z.uuid(), action: z.enum(["soumettre", "valider", "emettre", "reprendre", "annuler"]) })
    .safeParse({ id, action })
  if (!saisie.success) return { message: "Action invalide." }
  const { error } = await ctx.supabase.rpc("transition_bon_commande", {
    p_org: ctx.organisation.id, p_bon: saisie.data.id, p_action: saisie.data.action, p_motif: texte(fd, "motif") ?? undefined,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/achats")
  return { ok: true, message: "État du bon de commande mis à jour" }
}

export async function receptionnerCommande(id: string, operation: string, fd: FormData) {
  const { ctx, refus } = await autoriser("achats.write")
  if (refus) return refus
  const quantites = [...fd.entries()].filter(([cle, valeur]) => cle.startsWith("recu-") && valeur !== "")
    .map(([cle, valeur]) => ({ ligne_id: cle.slice(5), quantite: valeur }))
  const saisie = z.object({
    id: z.uuid(), operation: z.uuid(), date: z.iso.date(), emplacement: z.uuid().nullable(),
    lignes: z.array(z.object({ ligne_id: z.uuid(), quantite: z.coerce.number().min(0) })).min(1),
  }).safeParse({ id, operation, date: fd.get("date_reception"), emplacement: texte(fd, "emplacement"), lignes: quantites })
  if (!saisie.success) return { message: "Vérifiez la date et les quantités reçues." }
  const lignes = saisie.data.lignes.filter(l => l.quantite > 0)
  if (!lignes.length) return { message: "Saisissez au moins une quantité reçue." }

  const { error } = await ctx.supabase.rpc("receptionner_achat", {
    p_org: ctx.organisation.id, p_bon: saisie.data.id, p_operation: saisie.data.operation,
    p_date: saisie.data.date, p_emplacement: saisie.data.emplacement ?? undefined, p_reference: texte(fd, "reference"), p_observations: texte(fd, "observations"), p_lignes: lignes,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/achats")
  revalidatePath("/stock")
  return { ok: true, message: "Réception enregistrée" }
}

export async function remplacerCommande(id: string, fd: FormData) {
  const { ctx, refus } = await autoriser("achats.write")
  if (refus) return refus
  const saisie = z.object({ id: z.uuid(), motif: z.string().trim().min(1).max(500) })
    .safeParse({ id, motif: fd.get("motif") })
  if (!saisie.success) return { message: "Indiquez le motif de l’annulation du reliquat." }
  const { error } = await ctx.supabase.rpc("remplacer_bon_commande", {
    p_org: ctx.organisation.id, p_bon: saisie.data.id, p_motif: saisie.data.motif,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/achats")
  return { ok: true, message: "Reliquat annulé et brouillon de remplacement créé" }
}
