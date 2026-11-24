"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { messageErreur, type EtatAction } from "@/lib/actions"
import { getContexte } from "@/lib/contexte"
import type { Enums } from "@/lib/database.types"
import { dossierSchema, POINTS, verificationSchema } from "@/lib/schemas"

const CHAMPS_F01 = [
  "date_reception",
  "canal",
  "client_id",
  "client_type",
  "client_raison_sociale",
  "client_adresse",
  "client_telephone",
  "client_email",
  "contact_id",
  "contact_nom",
  "contact_fonction",
  "contact_telephone",
  "contact_email",
  "service",
  "besoin",
  "delai_souhaite",
  "budget_indicatif",
  "budget_devise",
  "department_id",
  "responsable_id",
  "pieces_autres",
] as const

export async function creerDossier(_: EtatAction, fd: FormData): Promise<EtatAction> {
  const parsed = dossierSchema.safeParse({
    ...Object.fromEntries(CHAMPS_F01.map((k) => [k, fd.get(k) ?? undefined])),
    nouveau_client: fd.get("nouveau_client") === "1",
    pieces_recues: fd.getAll("pieces_recues"),
    accuse_reception_envoye: fd.get("accuse_reception_envoye") === "on",
  })
  if (!parsed.success) {
    return {
      message: "Vérifiez les champs signalés",
      erreurs: z.flattenError(parsed.error).fieldErrors,
    }
  }
  const d = parsed.data
  const { supabase, organisation } = await getContexte()
  const org = organisation.id

  let clientId = d.client_id
  if (d.nouveau_client) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        organization_id: org,
        type: d.client_type,
        raison_sociale: d.client_raison_sociale!,
        adresse: d.client_adresse,
        telephone: d.client_telephone,
        email: d.client_email,
      })
      .select("id")
      .single()
    if (error) return { message: messageErreur(error) }
    clientId = data.id
  }

  let contactId = d.contact_id
  if (!contactId) {
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        organization_id: org,
        client_id: clientId!,
        nom: d.contact_nom!,
        fonction: d.contact_fonction,
        telephone: d.contact_telephone,
        email: d.contact_email,
        est_signataire: d.pieces_recues.includes("piece_identite"),
      })
      .select("id")
      .single()
    if (error) return { message: messageErreur(error) }
    contactId = data.id
  }

  const { data: dossier, error } = await supabase
    .from("dossiers")
    .insert({
      organization_id: org,
      date_reception: d.date_reception,
      canal: d.canal,
      client_id: clientId!,
      contact_id: contactId,
      service: d.service,
      besoin: d.besoin,
      delai_souhaite: d.delai_souhaite,
      budget_indicatif: d.budget_indicatif,
      budget_devise: d.budget_devise,
      department_id: d.department_id,
      responsable_id: d.responsable_id,
      pieces_recues: d.pieces_recues,
      pieces_autres: d.pieces_autres,
      accuse_reception_envoye: d.accuse_reception_envoye,
    })
    .select("id")
    .single()
  if (error) return { message: messageErreur(error) }

  revalidatePath("/dossiers")
  redirect(`/dossiers/${dossier.id}`)
}

export async function changerStatut(
  dossierId: string,
  statut: Enums<"dossier_statut">,
  motif?: string | null
): Promise<EtatAction> {
  const { supabase } = await getContexte()
  const { error } = await supabase.rpc("change_dossier_status", {
    p_dossier_id: dossierId,
    p_nouveau_statut: statut,
    p_motif: motif ?? undefined,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/dossiers")
  revalidatePath(`/dossiers/${dossierId}`)
  return { ok: true, message: "Statut mis à jour" }
}

export async function enregistrerVerification(
  dossierId: string,
  verificationId: string | null,
  _: EtatAction,
  fd: FormData
): Promise<EtatAction> {
  const brut: Record<string, FormDataEntryValue | null> = {}
  for (const p of POINTS) {
    brut[p] = fd.get(p)
    brut[`${p}_obs`] = fd.get(`${p}_obs`)
  }
  for (const k of ["observations", "decision", "pieces_demandees", "motif"]) brut[k] = fd.get(k)

  const parsed = verificationSchema.safeParse(brut)
  if (!parsed.success) return { erreurs: z.flattenError(parsed.error).fieldErrors }

  const { supabase, organisation } = await getContexte()
  const v = {
    ...parsed.data,
    pieces_demandees: parsed.data.decision === "complement_requis" ? parsed.data.pieces_demandees : null,
    motif: parsed.data.decision === "refuse" ? parsed.data.motif : null,
  }
  const { error } = verificationId
    ? await supabase.from("verifications").update(v).eq("id", verificationId)
    : await supabase
        .from("verifications")
        .insert({ ...v, dossier_id: dossierId, organization_id: organisation.id })
  if (error) return { message: messageErreur(error) }

  revalidatePath(`/dossiers/${dossierId}`)
  return { ok: true, message: "Fiche F-02 enregistrée" }
}

export async function validerVerification(
  dossierId: string,
  verificationId: string
): Promise<EtatAction> {
  const { supabase } = await getContexte()
  const { error } = await supabase.rpc("valider_verification", {
    p_verification_id: verificationId,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/dossiers")
  revalidatePath(`/dossiers/${dossierId}`)
  return { ok: true, message: "F-02 validée, décision appliquée au dossier" }
}

export async function affecter(dossierId: string, userId: string): Promise<EtatAction> {
  const { supabase, organisation } = await getContexte()
  const { error } = await supabase
    .from("dossier_affectations")
    .insert({ dossier_id: dossierId, user_id: userId, organization_id: organisation.id })
  if (error) return { message: messageErreur(error) }
  revalidatePath(`/dossiers/${dossierId}`)
  return { ok: true, message: "Affectation ajoutée" }
}

export async function retirerAffectation(dossierId: string, affectationId: string): Promise<EtatAction> {
  const { supabase } = await getContexte()
  const { error } = await supabase.from("dossier_affectations").delete().eq("id", affectationId)
  if (error) return { message: messageErreur(error) }
  revalidatePath(`/dossiers/${dossierId}`)
  return { ok: true, message: "Affectation retirée" }
}
