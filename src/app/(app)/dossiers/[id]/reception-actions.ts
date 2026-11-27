"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { messageErreur, texte } from "@/lib/actions"
import { getContexte } from "@/lib/contexte"

function resultat(dossier: string, error: { message: string; code?: string } | null, message: string) {
  if (error) return { message: messageErreur(error) }
  revalidatePath(`/dossiers/${dossier}`)
  return { ok: true, message }
}

export async function creerPvReception(dossier: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const type = z.enum(["F05", "F06"]).safeParse(texte(fd, "type"))
  if (!type.success) return { message: "Sélectionnez un type de PV." }
  const { error } = await supabase.from("pv_reception").insert({
    dossier_id: dossier, organization_id: organisation.id, type: type.data,
  })
  return resultat(dossier, error, "PV de réception créé")
}

export async function enregistrerPvReception(dossier: string, pv: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const decision = z.enum(["sans_reserve", "avec_reserves"]).safeParse(texte(fd, "decision"))
  const note = texte(fd, "satisfaction")
  const satisfaction = note ? Number(note) : null
  const date = z.iso.date().safeParse(texte(fd, "date_reception"))
  if (!date.success || !decision.success || (satisfaction !== null && (!Number.isInteger(satisfaction) || satisfaction < 1 || satisfaction > 5))) {
    return { message: "Renseignez la date, la décision et une note de 1 à 5 si applicable." }
  }
  const { error } = await supabase.from("pv_reception").update({
    date_reception: date.data, decision: decision.data, satisfaction,
    lieu: texte(fd, "lieu"), observations: texte(fd, "observations"),
    date_limite_reserves: decision.data === "avec_reserves" ? texte(fd, "date_limite") : null,
  }).eq("id", pv).eq("dossier_id", dossier).eq("organization_id", organisation.id).select("id").single()
  return resultat(dossier, error, "PV enregistré")
}

export async function enregistrerLignePv(dossier: string, pv: string, ligne: string | null, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const libelle = texte(fd, "libelle")
  const valeur = {
    resultat: texte(fd, "resultat"), observation: texte(fd, "observation"),
    ...(libelle ? { libelle } : {}),
  }
  if (!ligne && !libelle) return { message: "Indiquez le libellé du point." }
  const requete = ligne
    ? supabase.from("pv_reception_lignes").update(valeur).eq("id", ligne).eq("pv_id", pv).eq("organization_id", organisation.id)
    : supabase.from("pv_reception_lignes").insert({ ...valeur, libelle: libelle!, organization_id: organisation.id, pv_id: pv })
  const { error } = await requete.select("id").single()
  return resultat(dossier, error, "Point enregistré")
}

export async function ajouterReserve(dossier: string, pv: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const description = texte(fd, "description")
  if (!description) return { message: "Décrivez la réserve." }
  const { error } = await supabase.from("reserves").insert({
    dossier_id: dossier, organization_id: organisation.id, pv_id: pv, description, date_limite: texte(fd, "date_limite"),
  })
  return resultat(dossier, error, "Réserve ajoutée")
}

export async function retirerElementPv(dossier: string, pv: string, id: string, table: "pv_reception_lignes" | "reserves") {
  if (table !== "pv_reception_lignes" && table !== "reserves") return { message: "Type d’élément invalide." }
  const { supabase, organisation } = await getContexte()
  const { error } = await supabase.from(table).delete().eq("id", id).eq("pv_id", pv)
    .eq("organization_id", organisation.id).select("id").single()
  return resultat(dossier, error, "Élément retiré")
}

export async function leverReserve(dossier: string, reserve: string, fd: FormData) {
  const { supabase } = await getContexte()
  const commentaire = texte(fd, "commentaire")
  const { error } = await supabase.rpc("lever_reserve", { p_reserve: reserve, ...(commentaire ? { p_commentaire: commentaire } : {}) })
  return resultat(dossier, error, "Réserve levée")
}

export async function signerPvReception(dossier: string, pv: string, partie: "atlas" | "client", signature: { nom: string; image: string }) {
  const { supabase } = await getContexte()
  const validation = z.object({
    nom: z.string().trim().min(2).max(150),
    image: z.string().startsWith("data:image/png;base64,").max(700_000),
  }).safeParse(signature)
  if (!validation.success) return { message: "Indiquez le nom du signataire et tracez sa signature." }
  const { error } = await supabase.rpc("signer_pv_reception", {
    p_pv: pv, p_partie: partie, p_nom: validation.data.nom, p_image: validation.data.image,
  })
  return resultat(dossier, error, "Signature enregistrée")
}

export async function lienReception(pv: string) {
  const { supabase } = await getContexte()
  const { data, error } = await supabase.rpc("creer_lien_pv_reception", { p_pv: pv })
  return error ? { message: messageErreur(error) } : { ok: true, data }
}

export async function refuserReception(dossier: string, pv: string, fd: FormData) {
  const { supabase } = await getContexte()
  const motif = texte(fd, "motif")
  if (!motif) return { message: "Indiquez le motif du refus." }
  const { error } = await supabase.rpc("refuser_reception", { p_pv: pv, p_motif: motif })
  return resultat(dossier, error, "Refus consigné. Le dossier repasse en cours.")
}

export async function enregistrerAvis(dossier: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const note = Number(texte(fd, "note"))
  if (!Number.isInteger(note) || note < 1 || note > 5) return { message: "Saisissez une note de 1 à 5." }
  const { error } = await supabase.from("avis_clients").upsert({
    organization_id: organisation.id, dossier_id: dossier, note, commentaire: texte(fd, "commentaire"),
  }, { onConflict: "dossier_id" })
  return resultat(dossier, error, "Avis du client enregistré")
}
