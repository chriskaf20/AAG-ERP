import "server-only"

import { cookies } from "next/headers"
import { forbidden, redirect } from "next/navigation"
import { cache } from "react"

import type { Tables } from "@/lib/database.types"
import { PERMISSIONS, ROLES, type AppRole, type Permission } from "@/lib/permissions"
import { ORG_COOKIE } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export type Contexte = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  email: string
  profil: Tables<"profiles"> | null
  organisation: Tables<"organizations">
  organisations: { id: string; nom: string; sigle: string | null }[]
  roles: AppRole[]
  /** Union des permissions de tous les rôles de l'utilisateur (lue en base) */
  permissions: Permission[]
  /** Départements rattachés aux rôles de l'utilisateur */
  departements: string[]
  /** Départements de l'organisation */
  departementsOrg: { id: string; code: string; nom: string }[]
}

/** Client Supabase de la requête (partagé par le layout et la page). */
export const getSupabase = cache(createClient)

/** Organisation active (cookie). L'appartenance est vérifiée par getContexte et la RLS. */
export const getOrgId = cache(async () => (await cookies()).get(ORG_COOKIE)?.value ?? "")

/** Utilisateur vérifié localement (JWT signé, sans aller-retour réseau). */
export const getUserId = cache(async () => {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) redirect("/connexion")
  return { id: claims.sub, email: (claims.email as string | undefined) ?? "" }
})

/** Contexte de la requête : utilisateur, organisation active, rôles (un seul aller-retour). */
export const getContexte = cache(async (): Promise<Contexte> => {
  const [supabase, user, orgId] = await Promise.all([getSupabase(), getUserId(), getOrgId()])
  if (!orgId) redirect("/choisir-organisation")

  const { data } = await supabase.rpc("contexte_utilisateur", { p_org: orgId })
  const c = (data ?? {}) as unknown as {
    roles: { role: AppRole; department_id: string | null; organization_id: string; organizations: { id: string; nom: string; sigle: string | null } | null }[]
    profil: Tables<"profiles"> | null
    organisation: Tables<"organizations"> | null
    permissions: string[] | null
    departements: { id: string; code: string; nom: string }[]
  }
  const roles = c.roles ?? []
  const profil = c.profil
  const organisation = c.organisation
  const perms = c.permissions

  const organisations = new Map<string, { id: string; nom: string; sigle: string | null }>()
  for (const r of roles ?? []) {
    if (r.organizations) organisations.set(r.organizations.id, r.organizations)
  }
  const rolesOrg = (roles ?? []).filter((r) => r.organization_id === orgId)
  if (rolesOrg.length === 0 || !organisation) redirect("/choisir-organisation")

  return {
    supabase,
    userId: user.id,
    email: user.email,
    profil,
    organisation,
    organisations: [...organisations.values()],
    roles: ROLES.filter((r) => rolesOrg.some((x) => x.role === r)),
    permissions: PERMISSIONS.filter((p) => (perms ?? []).includes(p)),
    departements: rolesOrg.map((r) => r.department_id).filter((d): d is string => !!d),
    departementsOrg: c.departements ?? [],
  }
})

/** Page protégée : 403 si aucune des permissions n'est détenue. */
export async function exiger(...perms: Permission[]) {
  const ctx = await getContexte()
  if (!perms.some((p) => ctx.permissions.includes(p))) forbidden()
  return ctx
}

/** Server Action protégée : renvoie un message d'erreur si la permission manque. */
export async function autoriser(...perms: Permission[]) {
  const ctx = await getContexte()
  const ok = perms.some((p) => ctx.permissions.includes(p))
  return { ctx, refus: ok ? null : { message: "Action non autorisée pour vos rôles" } }
}
