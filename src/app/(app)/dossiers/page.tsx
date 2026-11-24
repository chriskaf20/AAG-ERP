import type { Metadata } from "next"

import { ButtonLink } from "@/components/button-link"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { getContexte } from "@/lib/contexte"
import { peut } from "@/lib/permissions"
import { DossiersView } from "./dossiers-view"

export const metadata: Metadata = { title: "Dossiers" }

export default async function PageDossiers({ searchParams }: PageProps<"/dossiers">) {
  const sp = await searchParams
  const ctx = await getContexte()
  const { supabase, roles, organisation } = ctx

  const [{ data }, { data: departements }] = await Promise.all([
    supabase
      .from("dossiers")
      .select(
        "id, numero, statut, service, date_reception, delai_souhaite, budget_indicatif, budget_devise, department_id, responsable_id, clients(raison_sociale), departments(code), profiles!dossiers_responsable_id_fkey(nom_complet)"
      )
      .eq("organization_id", organisation.id)
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("id, code, nom").eq("organization_id", organisation.id).order("code"),
  ])

  const dossiers = (data ?? []).map((d) => ({
    id: d.id,
    numero: d.numero,
    statut: d.statut,
    service: d.service,
    date_reception: d.date_reception,
    delai_souhaite: d.delai_souhaite,
    budget_indicatif: d.budget_indicatif,
    budget_devise: d.budget_devise,
    department_id: d.department_id,
    departement: d.departments?.code ?? "—",
    responsable_id: d.responsable_id,
    responsable: d.profiles?.nom_complet ?? "—",
    client: d.clients?.raison_sociale ?? "—",
  }))

  const val = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "")

  return (
    <>
      <SiteHeader
        titre="Dossiers"
        sousTitre={`${dossiers.length} dossier${dossiers.length > 1 ? "s" : ""} visibles`}
        actions={
          peut.creerDossier(roles) ? (
            <ButtonLink href="/dossiers/nouveau" size="sm">
              Nouveau dossier
            </ButtonLink>
          ) : null
        }
      />
      <PageBody>
        <Section>
          <DossiersView
            dossiers={dossiers}
            departements={departements ?? []}
            userId={ctx.userId}
            initial={{
              vue: val("vue") === "kanban" ? "kanban" : "liste",
              statut: val("statut"),
              departement: val("departement"),
              responsable: val("responsable"),
            }}
          />
        </Section>
      </PageBody>
    </>
  )
}
