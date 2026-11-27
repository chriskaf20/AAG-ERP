import type { Metadata } from "next"
import Link from "next/link"

import { ButtonLink } from "@/components/button-link"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { exiger } from "@/lib/contexte"
import { formatDate, formatHeure } from "@/lib/format"
import { STATUT_MISSION } from "@/lib/missions"
import { LECTURE_MISSIONS } from "@/lib/permissions"
import { grouperPlanning, semainePlanning } from "@/lib/planning"

export const metadata: Metadata = { title: "Planning" }

function horaires(debut: string, fin: string | null, jour: { debut: number; fin: number }) {
  if (!fin || Date.parse(fin) === Date.parse(debut)) return formatHeure(debut)
  const commence = Date.parse(debut) >= jour.debut
  const termine = Date.parse(fin) < jour.fin
  if (commence && termine) return formatHeure(debut) + " – " + formatHeure(fin)
  if (commence) return "À partir de " + formatHeure(debut)
  if (termine) return "Jusqu’à " + formatHeure(fin)
  return "Toute la journée"
}

export default async function PagePlanning({ searchParams }: {
  searchParams: Promise<{ semaine?: string | string[] }>
}) {
  const [{ supabase, organisation }, params] = await Promise.all([exiger(...LECTURE_MISSIONS), searchParams])
  const semaine = semainePlanning(params.semaine)
  const requete = supabase
    .from("missions")
    .select("id, titre, type, lieu, statut, debut, fin, mission_agents(user_id, profiles(nom_complet))")
    .eq("organization_id", organisation.id)
    .lt("debut", semaine.fin)
    .or("debut.gte." + semaine.debut + ",fin.gt." + semaine.debut)
    .order("debut")
    .order("id")

  const taille = 500
  const missions = []
  for (let offset = 0; ; offset += taille) {
    const { data, error } = await requete.range(offset, offset + taille - 1)
    if (error) throw error
    missions.push(...data)
    if (data.length < taille) break
  }

  const groupes = grouperPlanning(missions, semaine.jours)
  const periode = formatDate(semaine.jours[0].date) + " au " + formatDate(semaine.jours[6].date)

  return (
    <>
      <SiteHeader titre="Planning" sousTitre={periode} />
      <PageBody>
        <Section className="grid gap-4">
          <nav aria-label="Choisir la semaine" className="flex flex-wrap gap-2">
            <ButtonLink href={"/planning?semaine=" + semaine.precedente} variant="outline" size="sm">Semaine précédente</ButtonLink>
            <ButtonLink href="/planning" variant="ghost" size="sm">Cette semaine</ButtonLink>
            <ButtonLink href={"/planning?semaine=" + semaine.suivante} variant="outline" size="sm">Semaine suivante</ButtonLink>
          </nav>
          {groupes.length === 0 && <p className="text-sm text-muted-foreground">Aucune mission visible pour cette semaine.</p>}
          {groupes.map(groupe => (
            <Card key={groupe.id ?? "sans-affectation"}>
              <CardHeader><CardTitle>{groupe.nom}</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
                  {semaine.jours.map((jour, i) => (
                    <li key={jour.date} className={"min-w-0 rounded-md border p-2 " + (groupe.jours[i].length ? "" : "hidden xl:block")}>
                      <time dateTime={jour.date} className="text-xs font-medium text-muted-foreground">{jour.libelle}</time>
                      <ul className="mt-2 grid gap-2">
                        {groupe.jours[i].map(mission => (
                          <li key={mission.id} className="grid gap-1 rounded-md bg-muted/50 p-2 text-sm">
                            <span className="text-xs text-muted-foreground">{horaires(mission.debut, mission.fin, jour)}</span>
                            <Link href={"/missions/" + mission.id} className="wrap-break-word font-medium underline underline-offset-2">
                              {mission.titre}
                            </Link>
                            {mission.lieu && <span className="wrap-break-word text-xs text-muted-foreground">{mission.lieu}</span>}
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline">{mission.type === "terrain" ? "Terrain" : "Interne"}</Badge>
                              <Badge variant="outline">{STATUT_MISSION[mission.statut]}</Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </Section>
      </PageBody>
    </>
  )
}
