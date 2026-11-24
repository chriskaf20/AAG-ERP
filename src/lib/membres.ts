import "server-only"

import type { Contexte } from "@/lib/contexte"
import type { AppRole } from "@/lib/permissions"

export type Membre = { id: string; nom: string; roles: AppRole[] }

/** Membres internes de l'organisation active (visibles via la RLS). */
export async function membresOrganisation(ctx: Contexte, filtre?: AppRole[]): Promise<Membre[]> {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("user_id, role, profiles(nom_complet, email)")
    .eq("organization_id", ctx.organisation.id)
    .neq("role", "client")

  const parId = new Map<string, Membre>()
  for (const r of data ?? []) {
    const m = parId.get(r.user_id) ?? {
      id: r.user_id,
      nom: r.profiles?.nom_complet || r.profiles?.email || "—",
      roles: [],
    }
    m.roles.push(r.role)
    parId.set(r.user_id, m)
  }
  return [...parId.values()]
    .filter((m) => !filtre || m.roles.some((r) => filtre.includes(r)))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
}
