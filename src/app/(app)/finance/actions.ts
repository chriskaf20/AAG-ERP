"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { messageErreur, type EtatAction } from "@/lib/actions"
import { autoriser, getContexte } from "@/lib/contexte"
import { archiverDevisSigne } from "@/lib/documents-figes"
import type { Enums } from "@/lib/database.types"
import type { DroitsDossier } from "@/lib/permissions"

export type Resultat<T = undefined> = EtatAction & { data?: T }

const uuid = z.uuid()

function rafraichir(dossierId?: string | null) {
  if (dossierId) revalidatePath(`/dossiers/${dossierId}`)
  revalidatePath("/devis")
  revalidatePath("/factures")
  revalidatePath("/paiements")
  revalidatePath("/finance")
}

async function origine() {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  return process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
}

async function rpc<T>(nom: string, args: Record<string, unknown>, dossierId?: string): Promise<Resultat<T>> {
  const { supabase } = await getContexte()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(nom, args)
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, data: data as T }
}

// ---------------------------------------------------------------------------
// Devis
// ---------------------------------------------------------------------------
export async function reprendreArchiveDevis(devisId: string, dossierId: string): Promise<Resultat<string>> {
  const { ctx, refus } = await autoriser("devis.write")
  if (refus) return refus
  if (!uuid.safeParse(devisId).success || !uuid.safeParse(dossierId).success) return { message: "Devis introuvable." }
  const [devis, droits] = await Promise.all([
    ctx.supabase.from("devis").select("id").eq("id", devisId).eq("dossier_id", dossierId)
      .eq("organization_id", ctx.organisation.id).eq("statut", "signe").maybeSingle(),
    ctx.supabase.rpc("droits_dossier", { p_dossier: dossierId }),
  ])
  if (devis.error || droits.error || !devis.data || !(droits.data as unknown as DroitsDossier)?.devis_write) {
    return { message: "Archivage réservé aux responsables habilités pour ce devis signé." }
  }
  try {
    const id = await archiverDevisSigne(devisId)
    rafraichir(dossierId)
    return { ok: true, message: "Devis signé archivé", data: id }
  } catch {
    return { message: "Archivage indisponible. Le devis signé est conservé. Réessayez depuis cette fiche." }
  }
}

export async function creerDevis(dossierId: string): Promise<Resultat<string>> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const { supabase, organisation } = await getContexte()
  const { data, error } = await supabase
    .from("devis")
    .insert({ organization_id: organisation.id, dossier_id: uuid.parse(dossierId) })
    .select("id")
    .single()
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, data: data.id, message: "Devis créé" }
}

const enteteDevis = z.object({
  objet: z.string().trim().max(300).nullable(),
  devise: z.enum(["USD", "CDF"]),
  taux_cdf: z.coerce.number().positive(),
  acompte_pct: z.coerce.number().min(0).max(100),
  conditions_paiement: z.string().trim().max(1000).nullable(),
  date_devis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function enregistrerEnteteDevis(
  devisId: string,
  dossierId: string,
  valeurs: z.input<typeof enteteDevis>
): Promise<Resultat> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const parsed = enteteDevis.safeParse(valeurs)
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Données invalides" }
  const { supabase } = await getContexte()
  const { error } = await supabase.from("devis").update(parsed.data).eq("id", uuid.parse(devisId))
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, message: "Devis enregistré" }
}

const ligne = z.object({
  service_id: z.uuid().nullable(),
  description: z.string().trim().min(1, "Description requise").max(500),
  unite: z.enum(["forfait", "jour", "mois", "m2", "course"]),
  quantite: z.coerce.number().positive("Quantité invalide"),
  prix_unitaire: z.coerce.number().min(0, "Prix invalide"),
  remise_pct: z.coerce.number().min(0).max(100),
  cout_unitaire: z.number().min(0, "Coût invalide").nullable().optional(),
})
export type LigneSaisie = z.input<typeof ligne>

export async function enregistrerLigneDevis(
  devisId: string,
  dossierId: string,
  ligneId: string | null,
  valeurs: LigneSaisie
): Promise<Resultat> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const parsed = ligne.safeParse(valeurs)
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Ligne invalide" }
  const { supabase, organisation } = await getContexte()
  const { error } = ligneId
    ? await supabase.from("devis_lignes").update(parsed.data).eq("id", ligneId)
    : await supabase.from("devis_lignes").insert({
        ...parsed.data,
        organization_id: organisation.id,
        devis_id: uuid.parse(devisId),
        ordre: Date.now() % 1_000_000_000,
      })
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true }
}

export async function supprimerLigneDevis(ligneId: string, dossierId: string): Promise<Resultat> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const { supabase } = await getContexte()
  const { error } = await supabase.from("devis_lignes").delete().eq("id", uuid.parse(ligneId))
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true }
}

export async function supprimerDevis(devisId: string, dossierId: string): Promise<Resultat> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const { supabase } = await getContexte()
  const { error } = await supabase.from("devis").delete().eq("id", uuid.parse(devisId))
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, message: "Brouillon supprimé" }
}

export async function validerDevis(devisId: string, dossierId: string) {
  const garde = await autoriser("devis.validate")
  if (garde.refus) return garde.refus
  const r = await rpc("valider_devis", { p_devis: uuid.parse(devisId) }, dossierId)
  return r.ok ? { ...r, message: "Devis validé" } : r
}

export async function envoyerDevis(devisId: string, dossierId: string): Promise<Resultat<string>> {
  const garde = await autoriser("devis.send")
  if (garde.refus) return garde.refus
  const r = await rpc<{ token: string }>("envoyer_devis", { p_devis: uuid.parse(devisId) }, dossierId)
  if (!r.ok || !r.data) return r as Resultat<string>
  return { ok: true, message: "Devis envoyé", data: `${await origine()}/signer/${r.data.token}` }
}

export async function regenererLienDevis(devisId: string, dossierId: string): Promise<Resultat<string>> {
  const garde = await autoriser("devis.send")
  if (garde.refus) return garde.refus
  const r = await rpc<string>("regenerer_lien_devis", { p_devis: uuid.parse(devisId) }, dossierId)
  if (!r.ok || !r.data) return r
  return { ok: true, message: "Nouveau lien créé (l'ancien est désactivé)", data: `${await origine()}/signer/${r.data}` }
}

export async function nouvelleVersionDevis(devisId: string, dossierId: string) {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const r = await rpc<string>("nouvelle_version_devis", { p_devis: uuid.parse(devisId) }, dossierId)
  return r.ok ? { ...r, message: "Nouvelle version créée" } : r
}

export async function refuserDevis(devisId: string, dossierId: string, motif: string) {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const r = await rpc("refuser_devis", { p_devis: uuid.parse(devisId), p_motif: motif }, dossierId)
  return r.ok ? { ...r, message: "Devis marqué refusé" } : r
}

// ---------------------------------------------------------------------------
// Contrats et avenants
// ---------------------------------------------------------------------------
const contrat = z.object({
  objet: z.string().trim().min(2, "Objet requis"),
  devis_id: z.uuid().nullable(),
  date_debut: z.string().nullable(),
  date_fin: z.string().nullable(),
  montant: z.coerce.number().min(0).nullable(),
  reception_tacite: z.boolean().optional(),
  devise: z.enum(["USD", "CDF"]),
})

export async function creerContrat(dossierId: string, valeurs: z.input<typeof contrat>): Promise<Resultat> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const parsed = contrat.safeParse(valeurs)
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Données invalides" }
  const { supabase, organisation } = await getContexte()
  const { error } = await supabase
    .from("contrats")
    .insert({ ...parsed.data, organization_id: organisation.id, dossier_id: uuid.parse(dossierId) })
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, message: "Contrat créé" }
}

export async function signerContrat(id: string, dossierId: string, table: "contrats" | "avenants"): Promise<Resultat> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const { supabase } = await getContexte()
  const { error } = await supabase.from(table).update({ statut: "signe" }).eq("id", uuid.parse(id))
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, message: "Marqué signé" }
}

export async function creerAvenant(
  contratId: string,
  dossierId: string,
  valeurs: { objet: string; montant_delta: number; date_effet: string | null }
): Promise<Resultat> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  if (!valeurs.objet?.trim()) return { message: "Objet requis" }
  const { supabase, organisation } = await getContexte()
  const { error } = await supabase.from("avenants").insert({
    organization_id: organisation.id,
    contrat_id: uuid.parse(contratId),
    objet: valeurs.objet.trim(),
    montant_delta: Number(valeurs.montant_delta) || 0,
    date_effet: valeurs.date_effet || null,
  })
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, message: "Avenant créé" }
}

// ---------------------------------------------------------------------------
// PV de lancement F-04
// ---------------------------------------------------------------------------
const pv = z.object({
  devis_id: z.uuid().nullable(),
  date_lancement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lieu: z.string().trim().nullable(),
  perimetre_confirme: z.boolean(),
  planning_confirme: z.boolean(),
  interlocuteurs_confirmes: z.boolean(),
  livrables_confirmes: z.boolean(),
  acces_site_confirme: z.boolean(),
  acompte_confirme: z.boolean(),
  observations: z.string().trim().nullable(),
})
export type PvSaisie = z.input<typeof pv>

export async function enregistrerPv(dossierId: string, pvId: string | null, valeurs: PvSaisie): Promise<Resultat> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const parsed = pv.safeParse(valeurs)
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Données invalides" }
  const { supabase, organisation } = await getContexte()
  const { error } = pvId
    ? await supabase.from("pv_lancement").update(parsed.data).eq("id", pvId)
    : await supabase
        .from("pv_lancement")
        .insert({ ...parsed.data, organization_id: organisation.id, dossier_id: uuid.parse(dossierId) })
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, message: "PV enregistré" }
}

export async function signerPv(pvId: string, dossierId: string, partie: "atlas" | "client", nom: string, image: string) {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const r = await rpc("signer_pv", { p_pv: uuid.parse(pvId), p_partie: partie, p_nom: nom, p_image: image }, dossierId)
  return r.ok ? { ...r, message: "Signature enregistrée" } : r
}

export async function lienPv(pvId: string, dossierId: string): Promise<Resultat<string>> {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const r = await rpc<string>("creer_lien_pv", { p_pv: uuid.parse(pvId) }, dossierId)
  if (!r.ok || !r.data) return r
  return { ok: true, message: "Lien de signature créé", data: `${await origine()}/signer/${r.data}` }
}

// ---------------------------------------------------------------------------
// Factures, avoirs, paiements
// ---------------------------------------------------------------------------
export async function creerFactureDepuisDevis(devisId: string, dossierId: string, type: "acompte" | "solde") {
  const garde = await autoriser("factures.write")
  if (garde.refus) return garde.refus
  const r = await rpc<string>("creer_facture_depuis_devis", { p_devis: uuid.parse(devisId), p_type: type }, dossierId)
  return r.ok ? { ...r, message: "Facture brouillon créée" } : r
}

export async function creerFactureMensuelle(
  dossierId: string,
  valeurs: { objet: string; periode_debut: string; periode_fin: string; devise: "USD" | "CDF" }
): Promise<Resultat<string>> {
  const garde = await autoriser("factures.write")
  if (garde.refus) return garde.refus
  const { supabase, organisation } = await getContexte()
  const { data, error } = await supabase
    .from("factures")
    .insert({
      organization_id: organisation.id,
      dossier_id: uuid.parse(dossierId),
      type: "mensuelle",
      objet: valeurs.objet || null,
      periode_debut: valeurs.periode_debut || null,
      periode_fin: valeurs.periode_fin || null,
      devise: valeurs.devise,
    })
    .select("id")
    .single()
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, data: data.id, message: "Facture mensuelle brouillon créée" }
}

export async function enregistrerLigneFacture(
  factureId: string,
  dossierId: string,
  valeurs: LigneSaisie
): Promise<Resultat> {
  const garde = await autoriser("factures.write")
  if (garde.refus) return garde.refus
  const parsed = ligne.safeParse(valeurs)
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Ligne invalide" }
  const { supabase, organisation } = await getContexte()
  const { service_id, description, unite, quantite, prix_unitaire, remise_pct } = parsed.data
  const { error } = await supabase.from("facture_lignes").insert({
    service_id,
    description,
    unite,
    quantite,
    prix_unitaire,
    remise_pct,
    organization_id: organisation.id,
    facture_id: uuid.parse(factureId),
    ordre: Date.now() % 1_000_000_000,
  })
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true }
}

export async function supprimerLigneFacture(ligneId: string, dossierId: string): Promise<Resultat> {
  const garde = await autoriser("factures.write")
  if (garde.refus) return garde.refus
  const { supabase } = await getContexte()
  const { error } = await supabase.from("facture_lignes").delete().eq("id", uuid.parse(ligneId))
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true }
}

export async function supprimerFactureBrouillon(factureId: string, dossierId: string): Promise<Resultat> {
  const garde = await autoriser("factures.write")
  if (garde.refus) return garde.refus
  const { supabase } = await getContexte()
  const { error } = await supabase.from("factures").delete().eq("id", uuid.parse(factureId))
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, message: "Brouillon supprimé" }
}

export async function emettreFacture(factureId: string, dossierId: string) {
  const garde = await autoriser("factures.write")
  if (garde.refus) return garde.refus
  const r = await rpc<{ numero: string }>("emettre_facture", { p_facture: uuid.parse(factureId) }, dossierId)
  return r.ok ? { ...r, message: `Facture ${r.data?.numero} émise` } : r
}

export async function normaliserFacture(
  factureId: string,
  dossierId: string,
  v: { numero: string; code: string; qr: string }
) {
  const garde = await autoriser("normalisation.write")
  if (garde.refus) return garde.refus
  const r = await rpc(
    "normaliser_facture",
    { p_facture: uuid.parse(factureId), p_numero_normalise: v.numero, p_code_def: v.code, p_qr_code: v.qr || null },
    dossierId
  )
  return r.ok ? { ...r, message: "Normalisation enregistrée" } : r
}

export async function emettreAvoir(factureId: string, dossierId: string, montant: number, motif: string) {
  const garde = await autoriser("factures.write")
  if (garde.refus) return garde.refus
  const r = await rpc<{ numero: string }>(
    "emettre_avoir",
    { p_facture: uuid.parse(factureId), p_montant: montant, p_motif: motif },
    dossierId
  )
  return r.ok ? { ...r, message: `Avoir ${r.data?.numero} émis` } : r
}

const paiement = z.object({
  montant: z.coerce.number().positive("Montant invalide"),
  mode: z.enum(["banque", "mpesa", "airtel_money", "orange_money", "especes"]),
  reference: z.string().trim().nullable(),
  date_paiement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function enregistrerPaiement(
  factureId: string,
  dossierId: string,
  devise: Enums<"devise">,
  valeurs: z.input<typeof paiement>
): Promise<Resultat<string>> {
  const garde = await autoriser("paiements.write")
  if (garde.refus) return garde.refus
  const parsed = paiement.safeParse(valeurs)
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Données invalides" }
  if (parsed.data.mode !== "especes" && !parsed.data.reference) {
    return { message: "Référence obligatoire pour ce mode de paiement" }
  }
  const { supabase, organisation } = await getContexte()
  const { data, error } = await supabase
    .from("paiements")
    .insert({ ...parsed.data, devise, organization_id: organisation.id, facture_id: uuid.parse(factureId) })
    .select("id, numero_recu")
    .single()
  if (error) return { message: messageErreur(error) }
  rafraichir(dossierId)
  return { ok: true, data: data.id, message: `Paiement enregistré — reçu ${data.numero_recu}` }
}

export async function marquerFactureRemise(factureId: string, dossierId: string) {
  const garde = await autoriser("factures.write")
  if (garde.refus) return garde.refus
  const r = await rpc("marquer_facture_remise", { p_facture: uuid.parse(factureId) }, dossierId)
  return r.ok ? { ...r, message: "Facture marquée remise au client" } : r
}

export async function soumettreDevis(devisId: string, dossierId: string) {
  const garde = await autoriser("devis.write")
  if (garde.refus) return garde.refus
  const r = await rpc<number>("soumettre_devis", { p_devis: uuid.parse(devisId) }, dossierId)
  return r.ok
    ? { ...r, message: r.data ? `Devis soumis : ${r.data} responsable(s) notifié(s)` : "Devis soumis (aucun responsable de département à notifier)" }
    : r
}
