import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { getContexte } from "@/lib/contexte"
import { peut } from "@/lib/permissions"
import { creerClient } from "../actions"
import { ClientForm } from "../client-form"

export const metadata: Metadata = { title: "Nouveau client" }

export default async function NouveauClient() {
  const { roles } = await getContexte()
  if (!peut.ecrireClients(roles)) redirect("/clients")

  return (
    <>
      <SiteHeader titre="Nouveau client" />
      <PageBody>
        <Section className="max-w-3xl">
          <Card>
            <CardContent>
              <ClientForm action={creerClient} libelleBouton="Créer le client" />
            </CardContent>
          </Card>
        </Section>
      </PageBody>
    </>
  )
}
