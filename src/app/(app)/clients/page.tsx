import type { Metadata } from "next"

import { ButtonLink } from "@/components/button-link"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { a } from "@/lib/permissions"
import { ClientsTable } from "./clients-table"

export const metadata: Metadata = { title: "Clients" }

export default async function PageClients() {
  const { supabase, permissions, organisation } = await exiger("clients.read")
  const { data } = await supabase
    .from("clients")
    .select("id, type, raison_sociale, rccm, nif, telephone, email, ville, dossiers(count)")
    .eq("organization_id", organisation.id)
    .order("raison_sociale")

  const clients = (data ?? []).map((c) => ({
    ...c,
    nb_dossiers: c.dossiers[0]?.count ?? 0,
  }))

  return (
    <>
      <SiteHeader
        titre="Clients"
        sousTitre={`${clients.length} client${clients.length > 1 ? "s" : ""}`}
        actions={
          a(permissions, "clients.write") ? (
            <ButtonLink href="/clients/nouveau" size="sm">
              Nouveau client
            </ButtonLink>
          ) : null
        }
      />
      <PageBody>
        <Section>
          <ClientsTable clients={clients} />
        </Section>
      </PageBody>
    </>
  )
}
