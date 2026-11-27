import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Tables } from "@/lib/database.types"
import type { FicheMission } from "@/lib/missions"
import type { ClientPdf, CommandePdfProps, InterventionPdfProps, ReceptionPdfProps, DevisPdfProps, FacturePdfProps, OrgPdf, RecuPdfProps, TotauxPdf } from "./documents"

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

export async function donneesDevis(db: Db, devisId: string): Promise<(DevisPdfProps & { devis: Tables<"devis"> }) | null> {
  const { data: d, error } = await db.from("devis").select("*").eq("id", devisId).maybeSingle()
  if (error) throw error
  if (!d) return null
  const [ctx, lignes, sig] = await Promise.all([
    contexteDossier(db, d.dossier_id),
    db.from("devis_lignes").select("*").eq("devis_id", d.id).order("ordre").order("created_at"),
    d.signature_id
      ? db.from("signatures").select("nom_signataire, signe_le, image_png, ip").eq("id", d.signature_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (lignes.error) throw lignes.error
  if (sig.error) throw sig.error
  return {
    ...ctx,
    devis: d,
    totaux: { ...d, devise: d.devise, taxes: taxes(d.taxes) },
    lignes: lignes.data.map((l) => ({ ...l, montant_ht: l.montant_ht ?? 0, unite: UNITES[l.unite] ?? l.unite })),
    signature: sig.data ? { nom: sig.data.nom_signataire, signe_le: sig.data.signe_le, image_png: sig.data.image_png, ip: sig.data.ip as string | null } : null,
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


export async function donneesReception(db: Db, id: string, orgId: string): Promise<ReceptionPdfProps | null> {
  const { data: pv, error } = await db.from("pv_reception").select("*")
    .eq("id", id).eq("organization_id", orgId).maybeSingle()
  if (error) throw error
  if (!pv) return null

  async function signature(id: string | null) {
    if (!id) return null
    const { data, error } = await db.from("signatures").select("nom_signataire, signe_le, image_png")
      .eq("id", id).eq("organization_id", orgId).maybeSingle()
    if (error) throw error
    return data ? { nom: data.nom_signataire, signe_le: data.signe_le, image_png: data.image_png } : null
  }

  const [ctx, lignes, reserves, atlas, signataireClient] = await Promise.all([
    contexteDossier(db, pv.dossier_id),
    db.from("pv_reception_lignes").select("id, libelle, resultat, observation")
      .eq("pv_id", id).order("ordre").order("created_at"),
    db.from("reserves").select("id, description, date_limite, statut, levee_le, commentaire_levee")
      .eq("pv_id", id).order("created_at"),
    signature(pv.signature_atlas_id),
    signature(pv.signature_client_id),
  ])
  if (lignes.error) throw lignes.error
  if (reserves.error) throw reserves.error
  return { ...ctx, pv, lignes: lignes.data, reserves: reserves.data, atlas, signataireClient }
}

export async function donneesIntervention(db: Db, id: string, orgId: string): Promise<InterventionPdfProps | null> {
  const { data: ref, error } = await db.from("rapports_intervention").select("mission_id")
    .eq("id", id).eq("organization_id", orgId).maybeSingle()
  if (error) throw error
  if (!ref) return null

  const [ficheRpc, organisation] = await Promise.all([
    db.rpc("mission_detail", { p_mission: ref.mission_id }),
    db.from("organizations").select("nom, sigle, rccm, nif, id_nat, adresse, telephone, email")
      .eq("id", orgId).maybeSingle(),
  ])
  if (ficheRpc.error) throw ficheRpc.error
  if (organisation.error) throw organisation.error
  const fiche = ficheRpc.data as unknown as FicheMission | null
  if (!fiche || fiche.mission.organization_id !== orgId || !organisation.data) return null
  const rapport = fiche.rapports.find(r => r.id === id)
  if (!rapport) return null

  const photos: InterventionPdfProps["photos"] = []
  for (const photo of rapport.photos) {
    const { data } = await db.storage.from("terrain").download(photo.chemin)
    photos.push({
      id: photo.id,
      libelle: photo.legende ?? "Photo " + (photos.length + 1),
      jpeg: data ? Buffer.from(await data.arrayBuffer()) : null,
    })
  }
  return {
    org: organisation.data, dossierNumero: fiche.dossier.numero, mission: fiche.mission, rapport, photos,
    client: {
      raison_sociale: fiche.client.raison_sociale ?? "Client",
      adresse: [fiche.client.adresse, fiche.client.ville].filter(Boolean).join(", ") || null,
      telephone: fiche.client.telephone, rccm: null, nif: null, id_nat: null, email: null, contact: null,
    },
    signature: rapport.signature && {
      nom: rapport.signature.nom, signe_le: rapport.signature.signe_le, image_png: rapport.signature.image,
    },
  }
}


export async function donneesCommande(db: Db, id: string, orgId: string): Promise<CommandePdfProps | null> {
  const { data: bon, error } = await db.from("bons_commande").select("*")
    .eq("id", id).eq("organization_id", orgId).maybeSingle()
  if (error) throw error
  if (!bon?.numero || !bon.emis_le) return null
  const mentions = bon.mentions_emission as Pick<CommandePdfProps, "org" | "fournisseur" | "dossierNumero"> | null
  const [org, fournisseur, lignes, dossier] = await Promise.all([
    mentions ? null : db.from("organizations").select("nom, sigle, rccm, nif, id_nat, adresse, telephone, email").eq("id", orgId).maybeSingle(),
    mentions ? null : db.from("fournisseurs").select("nom, rccm, nif, contact, email, telephone").eq("id", bon.fournisseur_id)
      .eq("organization_id", orgId).maybeSingle(),
    db.from("bon_commande_lignes").select("id, description, quantite, prix_unitaire").eq("bon_id", bon.id)
      .eq("organization_id", orgId).order("ordre"),
    !mentions && bon.dossier_id ? db.from("dossiers").select("numero").eq("id", bon.dossier_id).eq("organization_id", orgId).maybeSingle() : null,
  ])
  for (const resultat of [org, fournisseur, lignes, dossier]) if (resultat?.error) throw resultat.error
  const f = fournisseur?.data
  const contexte = mentions ?? (org?.data && f ? {
    org: org.data, fournisseur: { ...f, raison_sociale: f.nom, adresse: null, id_nat: null },
    dossierNumero: dossier?.data?.numero ?? null,
  } : null)
  if (!contexte || !lignes.data) return null
  return {
    ...contexte, bon, lignes: lignes.data,
    totaux: { ...bon, total_brut: bon.total_ht, total_remise: 0, total_taxes: bon.total_ttc - bon.total_ht, taxes: taxes(bon.taxes) },
  }
}
