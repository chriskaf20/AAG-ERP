import "server-only"

import type { Ligne } from "@/components/editeur-lignes"
import type { Contexte } from "@/lib/contexte"
import type { DevisVue } from "./onglet-devis"
import type { FactureVue } from "./onglet-factures"

/** Données des onglets « Devis et contrat » et « Factures et paiements » (filtrées par la RLS). */
export async function chargerFinanceDossier(ctx: Contexte, dossierId: string) {
  const { supabase, organisation } = ctx
  const [
    { data: devis },
    { data: services },
    { data: contrats },
    { data: pvs },
    { data: factures },
    { data: relances },
    archives,
  ] = await Promise.all([
    supabase
      .from("devis")
      .select("*, devis_lignes(*), signatures!devis_signature_id_fkey(nom_signataire)")
      .eq("dossier_id", dossierId)
      .order("numero", { ascending: false })
      .order("version", { ascending: false }),
    supabase
      .from("services")
      .select("id, nom, unite, prix_base_usd")
      .eq("organization_id", organisation.id)
      .eq("actif", true)
      .order("nom"),
    supabase.from("contrats").select("*, avenants(*)").eq("dossier_id", dossierId).order("created_at"),
    supabase.from("pv_lancement").select("*").eq("dossier_id", dossierId).order("created_at", { ascending: false }),
    supabase
      .from("factures")
      .select("*, facture_lignes(*), paiements(*), avoirs(*)")
      .eq("dossier_id", dossierId)
      .order("created_at"),
    supabase.from("relances").select("*").eq("dossier_id", dossierId).order("envoyee_le", { ascending: false }),
    supabase.from("documents").select("id, devis_archive_id").eq("dossier_id", dossierId).eq("type", "devis").eq("est_signe", true),
  ])

  const trierLignes = <T extends { ordre: number; created_at: string }>(l: T[]) =>
    [...l].sort((a, b) => a.ordre - b.ordre || a.created_at.localeCompare(b.created_at))

  if (archives.error) throw archives.error
  const archiveParDevis = new Map(archives.data.map(a => [a.devis_archive_id, a.id]))
  const devisVue: DevisVue[] = (devis ?? []).map(({ devis_lignes, signatures, ...d }) => ({
    ...d,
    lignes: trierLignes(devis_lignes).map((l) => ({ ...l, montant_ht: l.montant_ht ?? 0 })) as Ligne[],
    archiveId: archiveParDevis.get(d.id) ?? null,
    signataire: (signatures as { nom_signataire: string } | null)?.nom_signataire ?? null,
  }))

  const pv = pvs?.[0] ?? null
  const ids = [pv?.signature_atlas_id, pv?.signature_client_id].filter((x): x is string => !!x)
  const { data: sigs } = ids.length
    ? await supabase.from("signatures").select("id, nom_signataire, signe_le").in("id", ids)
    : { data: [] }
  const sig = (id: string | null | undefined) => {
    const s = sigs?.find((x) => x.id === id)
    return s ? { nom: s.nom_signataire, le: s.signe_le } : null
  }

  const devisSignes = devisVue
    .filter((d) => d.statut === "signe")
    .map((d) => ({
      id: d.id,
      libelle: `${d.numero} v${d.version}`,
      total_ttc: d.total_ttc,
      devise: d.devise,
      acompte_pct: d.acompte_pct,
    }))

  return {
    devis: devisVue,
    services: services ?? [],
    contrats: contrats ?? [],
    pv,
    pvSignatures: { atlas: sig(pv?.signature_atlas_id), client: sig(pv?.signature_client_id) },
    devisSignes,
    factures: (factures ?? []).map(({ facture_lignes, ...f }) => ({
      ...f,
      solde_du: f.solde_du ?? 0,
      lignes: trierLignes(facture_lignes).map((l) => ({ ...l, montant_ht: l.montant_ht ?? 0 })) as Ligne[],
    })) as FactureVue[],
    relances: relances ?? [],
    seuilUsd: Number((organisation.parametres as Record<string, unknown>)?.seuil_validation_usd ?? 0),
  }
}
