import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getContexte } from "@/lib/contexte"
import { FormulaireProfil } from "./formulaire-profil"

export const metadata: Metadata = { title: "Mon profil" }

export default async function MonProfil() {
  const ctx = await getContexte()
  const t = await getTranslations("roles")
  return (
    <>
      <SiteHeader titre="Mon profil" sousTitre={ctx.email} />
      <PageBody>
        <Section className="flex max-w-2xl flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Rôles</CardTitle>
              <CardDescription>Vos droits sont l&apos;union des permissions de ces rôles.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {ctx.roles.map((r) => (
                <Badge key={r} variant="outline">
                  {t(r)}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <FormulaireProfil
            valeurs={{
              nom_complet: ctx.profil?.nom_complet ?? "",
              fonction: ctx.profil?.fonction ?? "",
              telephone: ctx.profil?.telephone ?? "",
            }}
          />
        </Section>
      </PageBody>
    </>
  )
}
