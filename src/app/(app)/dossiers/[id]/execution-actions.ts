"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { messageErreur, texte } from "@/lib/actions"
import { getContexte } from "@/lib/contexte"
import { createAdminClient } from "@/lib/supabase/admin"

function resultat(dossier: string, error: { message: string; code?: string } | null, message: string) {
  if (error) return { message: messageErreur(error) }
  revalidatePath(`/dossiers/${dossier}`)
  revalidatePath("/missions")
  return { ok: true, message }
}

export async function planifierMission(dossier: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const titre = texte(fd, "titre")
  const type = z.enum(["terrain", "interne"]).safeParse(texte(fd, "type"))
  const debut = z.iso.datetime({ offset: true }).safeParse(texte(fd, "debut"))
  const finBrute = texte(fd, "fin")
  const fin = finBrute ? z.iso.datetime({ offset: true }).safeParse(finBrute) : null
  if (!titre || !type.success || !debut.success || fin?.success === false) {
    return { message: "Renseignez le titre, le type et les horaires de la mission." }
  }
  const { error } = await supabase.from("missions").insert({
    organization_id: organisation.id, dossier_id: dossier, titre, type: type.data, debut: debut.data,
    fin: fin?.data ?? null, consignes: texte(fd, "consignes"), lieu: texte(fd, "lieu"),
  })
  return resultat(dossier, error, "Mission planifiée")
}

export async function gererAffectationMission(dossier: string, mission: string, membre: string, retirer = false) {
  const { supabase, organisation } = await getContexte()
  const requete = retirer
    ? supabase.from("mission_agents").delete().eq("mission_id", mission).eq("user_id", membre).eq("organization_id", organisation.id)
    : supabase.from("mission_agents").insert({ organization_id: organisation.id, mission_id: mission, user_id: membre })
  const { error } = await requete.select("id").single()
  return resultat(dossier, error, retirer ? "Affectation retirée" : "Membre affecté")
}

export async function annulerMission(dossier: string, mission: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const motif = texte(fd, "motif")
  if (!motif) return { message: "Indiquez le motif d’annulation." }
  const { error } = await supabase.from("missions").update({ statut: "annulee", motif_annulation: motif })
    .eq("id", mission).eq("dossier_id", dossier).eq("organization_id", organisation.id).select("id").single()
  return resultat(dossier, error, "Mission annulée")
}

export async function gererLivrable(dossier: string, fd: FormData, id?: string) {
  const { supabase, organisation } = await getContexte()
  const libelle = texte(fd, "libelle")
  if (!id && !libelle) return { message: "Indiquez le nom du livrable." }
  const requete = id
    ? supabase.from("livrables").update({ remis_le: new Date().toISOString() }).eq("id", id).eq("dossier_id", dossier).eq("organization_id", organisation.id)
    : supabase.from("livrables").insert({ dossier_id: dossier, organization_id: organisation.id, libelle: libelle!, description: texte(fd, "description") })
  const { error } = await requete.select("id").single()
  return resultat(dossier, error, id ? "Remise consignée" : "Livrable ajouté")
}

export async function suivreIncident(dossier: string, incident: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const suivi = z.object({
    statut: z.enum(["ouvert", "en_traitement"]), responsable_id: z.uuid().nullable(),
    action_corrective: z.string().nullable(),
  }).safeParse({ statut: texte(fd, "statut"), responsable_id: texte(fd, "responsable"), action_corrective: texte(fd, "action") })
  if (!suivi.success) return { message: "Le suivi de l’incident est invalide." }
  const { error } = await supabase.from("incidents").update(suivi.data)
    .eq("id", incident).eq("dossier_id", dossier).eq("organization_id", organisation.id).select("id").single()
  return resultat(dossier, error, "Suivi de l’incident enregistré")
}

export async function cloreIncident(dossier: string, incident: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const action = texte(fd, "action")
  if (!action) return { message: "Décrivez l’action corrective." }
  const { error } = await supabase.from("incidents").update({ statut: "clos", action_corrective: action })
    .eq("id", incident).eq("dossier_id", dossier).eq("organization_id", organisation.id).select("id").single()
  return resultat(dossier, error, "Incident clos")
}

export async function consignerPoint(dossier: string, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const contenu = texte(fd, "texte")
  if (!contenu || contenu.length > 10_000) return { message: "Saisissez un point d’avancement de 1 à 10 000 caractères." }
  const { data: visible } = await supabase.from("dossiers").select("id").eq("id", dossier)
    .eq("organization_id", organisation.id).maybeSingle()
  if (!visible) return { message: "Dossier introuvable dans l’organisation active." }
  const { data, error } = await supabase.rpc("enregistrer_point_avancement", { p_dossier: dossier, p_texte: contenu })
  if (error) return resultat(dossier, error, "")
  const point = data as { id: string; email_statut: string; destinataire: string | null; dossier: string; client: string; organisation: string }
  if (point.email_statut !== "en_attente") {
    const messages: Record<string, string> = {
      consigne: "Point consigné",
      ignore: "Point consigné. Adresse de test ou adresse absente.",
      simule: "Point consigné. Envoi simulé.",
    }
    return resultat(dossier, null, messages[point.email_statut] ?? "Point consigné")
  }

  let echec: string | undefined
  try {
    const cle = process.env.RESEND_API_KEY
    if (!cle) throw new Error("Clé Resend absente")
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `point-avancement/${point.id}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "facturation@atlasafricagroup.com",
        to: [point.destinataire],
        subject: `Point d’avancement — dossier ${point.dossier}`,
        text: `Bonjour ${point.client},\n\n${contenu}\n\n${point.organisation}`,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) echec = `Resend HTTP ${response.status}`
  } catch (cause) {
    echec = cause instanceof Error ? cause.message : "Erreur d’envoi"
  }
  revalidatePath(`/dossiers/${dossier}`)
  try {
    const { error: trace } = await createAdminClient().rpc("confirmer_envoi_point", {
      p_point: point.id, p_ok: !echec, ...(echec ? { p_erreur: echec } : {}),
    })
    if (trace) return { message: "Point consigné. Le résultat de l’envoi n’a pas pu être enregistré." }
  } catch {
    return { message: "Point consigné. Le résultat de l’envoi n’a pas pu être enregistré." }
  }
  return echec ? { message: `Point consigné. Envoi échoué (${echec}).` } : { ok: true, message: "Point consigné et envoyé au client" }
}
