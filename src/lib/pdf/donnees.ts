import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import type { ClientPdf, DevisPdfProps, FacturePdfProps, OrgPdf, RecuPdfProps, TotauxPdf } from "./documents"

type Db = SupabaseClient<Database>

const UNITES: Record<string, string> = { forfait: "forfait", jour: "j", mois: "mois", m2: "m²", course: "course" }
const MODES: Record<string, string> = {
  banque: "Banque",
  mpesa: "M-Pesa",
  airtel_money: "Airtel Money",
  orange_money: "Orange Money",
  especes: "Espèces",
}

async function contexteDossier(db: Db, dossierId: string) {
  const { data: d } = await db
    .from("dossiers")
    .select("numero, organizations(nom, sigle, rccm, nif, id_nat, adresse, telephone, email), clients(*), contacts(nom, fonction)")
    .eq("id", dossierId)
    .single()
  if (!d?.organizations || !d.clients) throw new Error("Dossier introuvable")
  const org: OrgPdf = d.organizations
  const c = d.clients
  const client: ClientPdf = {
    raison_sociale: c.raison_sociale,
    adresse: [c.adresse, c.ville].filter(Boolean).join(", ") || null,
    rccm: c.rccm,
    nif: c.nif,
    id_nat: c.id_nat,
    telephone: c.telephone,
    email: c.email,
    contact: d.contacts ? [d.contacts.nom, d.contacts.fonction].filter(Boolean).join(", ") : null,
  }
  return { org, client, dossierNumero: d.numero }
}

function taxes(v: unknown): TotauxPdf["taxes"] {
  return Array.isArray(v) ? (v as TotauxPdf["taxes"]) : []
}

export async function donneesDevis(db: Db, devisId: string): Promise<DevisPdfProps | null> {
  const { data: d } = await db.from("devis").select("*").eq("id", devisId).maybeSingle()
  if (!d) return null
  const [ctx, { data: lignes }, { data: sig }] = await Promise.all([
    contexteDossier(db, d.dossier_id),
    db.from("devis_lignes").select("*").eq("devis_id", d.id).order("ordre").order("created_at"),
    d.signature_id
      ? db.from("signatures").select("nom_signataire, signe_le, image_png, ip").eq("id", d.signature_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    ...ctx,
    devis: d,
    totaux: { ...d, devise: d.devise, taxes: taxes(d.taxes) },
    lignes: (lignes ?? []).map((l) => ({ ...l, montant_ht: l.montant_ht ?? 0, unite: UNITES[l.unite] ?? l.unite })),
    signature: sig ? { nom: sig.nom_signataire, signe_le: sig.signe_le, image_png: sig.image_png, ip: sig.ip as string | null } : null,
  }
}

export async function donneesFacture(db: Db, factureId: string): Promise<FacturePdfProps | null> {
  const { data: f } = await db.from("factures").select("*, devis(numero, version)").eq("id", factureId).maybeSingle()
  if (!f) return null
  const [ctx, { data: lignes }] = await Promise.all([
    contexteDossier(db, f.dossier_id),
    db.from("facture_lignes").select("*").eq("facture_id", f.id).order("ordre").order("created_at"),
  ])
  return {
    ...ctx,
    facture: { ...f, solde_du: f.solde_du ?? 0, devis_numero: f.devis ? `${f.devis.numero} v${f.devis.version}` : null },
    totaux: { ...f, taxes: taxes(f.taxes) },
    lignes: (lignes ?? []).map((l) => ({ ...l, montant_ht: l.montant_ht ?? 0, unite: UNITES[l.unite] ?? l.unite })),
  }
}

export async function donneesRecu(db: Db, paiementId: string): Promise<RecuPdfProps | null> {
  const { data: p } = await db
    .from("paiements")
    .select("*, factures(numero, total_ttc, solde_du, dossier_id)")
    .eq("id", paiementId)
    .maybeSingle()
  if (!p?.factures) return null
  const ctx = await contexteDossier(db, p.factures.dossier_id)
  return {
    ...ctx,
    paiement: { ...p, mode: MODES[p.mode] ?? p.mode },
    facture: { ...p.factures, solde_du: p.factures.solde_du ?? 0 },
  }
}
