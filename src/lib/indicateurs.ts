import "server-only"

import type { Contexte } from "@/lib/contexte"
import type { DossierStatut } from "@/lib/permissions"

export type Indicateurs = {
  annee: number
  dossiers_par_statut: Partial<Record<DossierStatut, number>>
  devis_signes: number
  ca_signe_ht_usd: number
  ca_facture_ht_usd: number
  encaisse_usd: number
  impayes_usd: number
  marge_signee_usd: number | null
}

/** Indicateurs agrégés de l'organisation (permission reports.read, contrôlée en base). */
export async function indicateurs(ctx: Contexte): Promise<Indicateurs | null> {
  const { data, error } = await ctx.supabase.rpc("rapport_indicateurs", { p_org: ctx.organisation.id })
  return error ? null : (data as unknown as Indicateurs)
}
