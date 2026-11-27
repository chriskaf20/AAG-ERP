import type { Metadata } from "next"
import Link from "next/link"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { exiger } from "@/lib/contexte"
import { formatDateHeure } from "@/lib/format"
import { STATUT_MISSION, type MissionResume } from "@/lib/missions"

export const metadata: Metadata = { title: "Mes missions" }

export default async function MesMissions() {
  const { supabase, organisation, permissions, userId } = await exiger("missions.read_assigned", "dossiers.read_assigned")
  const [resultat, affectations] = await Promise.all([
    supabase.rpc("mes_missions", { p_org: organisation.id }),
    permissions.includes("dossiers.read_assigned")
      ? supabase.from("dossier_affectations").select("dossiers(id, numero, service)").eq("organization_id", organisation.id).eq("user_id", userId)
      : null,
  ])
  if (resultat.error) throw resultat.error
  if (affectations?.error) throw affectations.error
  const missions = resultat.data as unknown as MissionResume[]
  const dossiers = (affectations?.data ?? []).flatMap(a => a.dossiers && !missions.some(m => m.dossier_id === a.dossiers?.id) ? [a.dossiers] : [])
  return <>
    <SiteHeader titre="Mes missions" />
    <PageBody>
      <Section className="grid gap-3 md:grid-cols-2">
        {missions.length === 0 && dossiers.length === 0 && <p className="text-sm text-muted-foreground">Aucune mission ne vous est affectée.</p>}
        {missions.map(m => <Card key={m.id}>
          <CardHeader>
            <CardTitle><Link href={`/missions/${m.id}`} className="underline">{m.titre}</Link></CardTitle>
            <CardDescription>{m.dossier} · {m.client}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex gap-2"><Badge variant="outline">{m.type === "terrain" ? "Terrain" : "Interne"}</Badge>
              <Badge variant="outline">{STATUT_MISSION[m.statut]}</Badge></div>
            <p>{formatDateHeure(m.debut)}{m.lieu && ` · ${m.lieu}`}</p>
          </CardContent>
        </Card>)}
      </Section>
      {dossiers.length > 0 && <Section className="grid gap-3">
        <h2 className="font-medium">Dossiers affectés</h2>
        <ul className="grid gap-2">
          {dossiers.map(d => <li key={d.id} className="rounded-lg border p-3 text-sm">
            <Link href={`/dossiers/${d.id}`} className="font-medium underline">{d.numero}</Link> · {d.service}
          </li>)}
        </ul>
      </Section>}
    </PageBody>
  </>
}
