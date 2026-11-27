import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { exiger } from "@/lib/contexte"
import { formatDateHeure } from "@/lib/format"
import { STATUT_MISSION, type FicheMission } from "@/lib/missions"
import { RapportsMission } from "./rapports"

export const metadata: Metadata = { title: "Mission" }

export default async function PageMission({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const { supabase, organisation } = await exiger("missions.read_assigned", "dossiers.read_all", "dossiers.read_dept", "dossiers.read_own")
  const { data, error } = await supabase.rpc("mission_detail", { p_mission: id })
  if (error) throw error
  const fiche = data as unknown as FicheMission | null
  if (!fiche || fiche.mission.organization_id !== organisation.id) notFound()
  const { mission: m, client, dossier } = fiche
  const chemins = [...new Set(fiche.rapports.flatMap(r => r.photos.map(p => p.chemin)))]
  if (chemins.length) {
    const { data: urls } = await supabase.storage.from("terrain").createSignedUrls(chemins, 600)
    const parChemin = new Map(urls?.map(u => [u.path, u.signedUrl]))
    for (const rapport of fiche.rapports) for (const photo of rapport.photos) photo.url = parChemin.get(photo.chemin) ?? undefined
  }
  return <>
    <SiteHeader titre={m.titre} sousTitre={`${dossier.numero} · ${dossier.service}`} />
    <PageBody>
      <Section className="grid gap-4">
        <Card>
          <CardHeader><CardTitle>Détails de la mission</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex flex-wrap gap-2"><Badge variant="outline">{m.type === "terrain" ? "Terrain" : "Interne"}</Badge>
              <Badge variant="outline">{STATUT_MISSION[m.statut]}</Badge></div>
            <p>{formatDateHeure(m.debut)}{m.fin && ` → ${formatDateHeure(m.fin)}`}</p>
            {m.lieu && <p>{m.lieu}</p>}
            <p>{[client.raison_sociale, client.adresse, client.ville].filter(Boolean).join(" · ")}</p>
            {client.telephone && <a className="underline" href={`tel:${client.telephone}`}>{client.telephone}</a>}
            {m.consignes && <p className="whitespace-pre-wrap">{m.consignes}</p>}
            <p>{fiche.agents.map(a => a.nom ?? "Membre affecté").join(", ") || "Aucune personne affectée"}</p>
            {dossier.voir && <Link className="underline" href={`/dossiers/${dossier.id}?onglet=execution`}>Ouvrir le dossier</Link>}
          </CardContent>
        </Card>
        <RapportsMission fiche={fiche} />
      </Section>
    </PageBody>
  </>
}
