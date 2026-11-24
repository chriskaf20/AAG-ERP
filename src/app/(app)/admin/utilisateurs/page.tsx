import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { getContexte } from "@/lib/contexte"
import { peut } from "@/lib/permissions"
import { NouvelUtilisateur } from "./nouvel-utilisateur"
import { UtilisateursTable } from "./utilisateurs-table"

export const metadata: Metadata = { title: "Utilisateurs" }

export default async function PageUtilisateurs() {
  const ctx = await getContexte()
  const t = await getTranslations("roles")
  const [{ data: roles }, { data: departements }] = await Promise.all([
    ctx.supabase
      .from("user_roles")
      .select("user_id, role, departments(code), profiles(id, nom_complet, email, fonction, telephone)")
      .eq("organization_id", ctx.organisation.id),
    ctx.supabase.from("departments").select("id, code, nom").eq("organization_id", ctx.organisation.id).order("code"),
  ])

  const parId = new Map<
    string,
    { id: string; nom: string; email: string; fonction: string | null; telephone: string | null; roles: string[] }
  >()
  for (const r of roles ?? []) {
    if (!r.profiles) continue
    const u = parId.get(r.user_id) ?? {
      id: r.profiles.id,
      nom: r.profiles.nom_complet,
      email: r.profiles.email ?? "",
      fonction: r.profiles.fonction,
      telephone: r.profiles.telephone,
      roles: [],
    }
    u.roles.push(r.departments ? `${t(r.role)} (${r.departments.code})` : t(r.role))
    parId.set(r.user_id, u)
  }
  const utilisateurs = [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))

  return (
    <>
      <SiteHeader
        titre="Utilisateurs"
        sousTitre={`${utilisateurs.length} membre${utilisateurs.length > 1 ? "s" : ""} de ${ctx.organisation.nom}`}
        actions={
          <NouvelUtilisateur
            departements={departements ?? []}
            peutAdmin={peut.attribuerAdmin(ctx.roles)}
            serviceRoleOk={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
          />
        }
      />
      <PageBody>
        <Section>
          <UtilisateursTable utilisateurs={utilisateurs} />
        </Section>
      </PageBody>
    </>
  )
}
