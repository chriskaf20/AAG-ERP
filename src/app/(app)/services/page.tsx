import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { a } from "@/lib/permissions"
import { CatalogueServices } from "./catalogue"

export const metadata: Metadata = { title: "Services" }

export default async function PageServices() {
  const { supabase, permissions, organisation } = await exiger("services.manage", "devis.write")
  const [{ data: services }, { data: departements }] = await Promise.all([
    supabase
      .from("services")
      .select("id, nom, description, unite, prix_base_usd, actif, department_id, departments(code)")
      .eq("organization_id", organisation.id)
      .order("nom"),
    supabase.from("departments").select("id, code, nom").eq("organization_id", organisation.id).order("code"),
  ])
  return (
    <>
      <SiteHeader titre="Catalogue de services" sousTitre="Prix de base en USD, repris dans les devis" />
      <PageBody>
        <Section>
          <CatalogueServices
            services={(services ?? []).map((s) => ({ ...s, departement: s.departments?.code ?? "—" }))}
            departements={departements ?? []}
            modifiable={a(permissions, "services.manage")}
          />
        </Section>
      </PageBody>
    </>
  )
}
