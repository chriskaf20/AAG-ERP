import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { exiger } from "@/lib/contexte"
import { creerClient } from "../actions"
import { ClientForm } from "../client-form"

export const metadata: Metadata = { title: "Nouveau client" }

export default async function NouveauClient() {
  await exiger("clients.write")

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
