import type { Metadata } from "next"
import Link from "next/link"
import { MapPinIcon, PhoneIcon } from "lucide-react"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { StatutBadge } from "@/components/statut-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { exiger } from "@/lib/contexte"
import { formatDate } from "@/lib/format"
import { STATUTS_TERMINAUX } from "@/lib/permissions"

export const metadata: Metadata = { title: "Mes missions" }

export default async function MesMissions() {
  const { supabase, userId } = await exiger("dossiers.read_assigned")
  const { data } = await supabase
    .from("dossier_affectations")
    .select(
      "id, created_at, dossiers(id, numero, statut, service, besoin, delai_souhaite, clients(raison_sociale, adresse, ville, telephone), contacts(nom, telephone))"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  const missions = (data ?? [])
    .flatMap((a) => (a.dossiers ? [a.dossiers] : []))
    .sort((x, y) => (x.delai_souhaite ?? "9999").localeCompare(y.delai_souhaite ?? "9999"))
  const actives = missions.filter((m) => !STATUTS_TERMINAUX.includes(m.statut))

  return (
    <>
      <SiteHeader titre="Mes missions" sousTitre={`${actives.length} mission${actives.length > 1 ? "s" : ""} en cours`} />
      <PageBody>
        <Section className="grid gap-3 md:grid-cols-2">
          {missions.length === 0 && <p className="text-sm text-muted-foreground">Aucune mission ne vous est affectée.</p>}
          {missions.map((m) => {
            const tel = m.contacts?.telephone ?? m.clients?.telephone
            return (
              <Card key={m.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <Link href={`/dossiers/${m.id}`} className="hover:underline">
                      {m.numero}
                    </Link>
                    <StatutBadge statut={m.statut} />
                  </CardTitle>
                  <CardDescription>
                    {m.clients?.raison_sociale} · {m.service}
                    {m.delai_souhaite && ` · échéance ${formatDate(m.delai_souhaite)}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <p className="line-clamp-3">{m.besoin}</p>
                  {(m.clients?.adresse || m.clients?.ville) && (
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPinIcon className="size-4" aria-hidden />
                      {[m.clients?.adresse, m.clients?.ville].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {tel && (
                    <a href={`tel:${tel}`} className="flex items-center gap-1.5 text-primary hover:underline dark:text-foreground">
                      <PhoneIcon className="size-4" aria-hidden />
                      {m.contacts?.nom ? `${m.contacts.nom} — ` : ""}
                      {tel}
                    </a>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </Section>
      </PageBody>
    </>
  )
}
