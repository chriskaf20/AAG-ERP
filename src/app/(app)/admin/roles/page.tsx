import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { MatriceRoles } from "./matrice-roles"

export const metadata: Metadata = { title: "Rôles" }

export default async function PageRoles() {
  const ctx = await exiger("admin.users")
  const [{ data: roles }, { data: departements }] = await Promise.all([
    ctx.supabase
      .from("user_roles")
      .select("id, user_id, role, department_id, departments(code), profiles(nom_complet, email)")
      .eq("organization_id", ctx.organisation.id),
    ctx.supabase.from("departments").select("id, code, nom").eq("organization_id", ctx.organisation.id).order("code"),
  ])

  const parId = new Map<
    string,
    { id: string; nom: string; email: string; roles: { id: string; role: string; dept: string | null }[] }
  >()
  for (const r of roles ?? []) {
    const u = parId.get(r.user_id) ?? {
      id: r.user_id,
      nom: r.profiles?.nom_complet ?? "—",
      email: r.profiles?.email ?? "",
      roles: [],
    }
    u.roles.push({ id: r.id, role: r.role, dept: r.departments?.code ?? null })
    parId.set(r.user_id, u)
  }

  return (
    <>
      <SiteHeader titre="Rôles" sousTitre="Un utilisateur peut cumuler plusieurs rôles, par département le cas échéant" />
      <PageBody>
        <Section>
          <MatriceRoles
            utilisateurs={[...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))}
            departements={departements ?? []}
            peutAdmin={ctx.roles.includes("admin_systeme")}
            moi={ctx.userId}
          />
        </Section>
      </PageBody>
    </>
  )
}
