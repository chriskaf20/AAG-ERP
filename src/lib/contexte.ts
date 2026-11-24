import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import type { Tables } from "@/lib/database.types"
import type { AppRole } from "@/lib/permissions"
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
  /** Départements rattachés aux rôles de l'utilisateur */
  departements: string[]
}

/** Contexte de la requête : utilisateur, organisation active, rôles. */
export const getContexte = cache(async (): Promise<Contexte> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/connexion")

  const orgId = (await cookies()).get(ORG_COOKIE)?.value

  const [{ data: roles }, { data: profil }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role, department_id, organization_id, organizations(id, nom, sigle)")
      .eq("user_id", user.id),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ])

  const organisations = new Map<string, { id: string; nom: string; sigle: string | null }>()
  for (const r of roles ?? []) {
    if (r.organizations) organisations.set(r.organizations.id, r.organizations)
  }

  const rolesOrg = (roles ?? []).filter((r) => r.organization_id === orgId)
  if (!orgId || rolesOrg.length === 0) redirect("/choisir-organisation")

  const { data: organisation } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single()
  if (!organisation) redirect("/choisir-organisation")

  return {
    supabase,
    userId: user.id,
    email: user.email ?? "",
    profil,
    organisation,
    organisations: [...organisations.values()],
    roles: [...new Set(rolesOrg.map((r) => r.role))],
    departements: rolesOrg.map((r) => r.department_id).filter((d): d is string => !!d),
  }
})
