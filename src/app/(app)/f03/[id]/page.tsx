import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { ButtonLink } from "@/components/button-link"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getContexte } from "@/lib/contexte"
import type { Tables } from "@/lib/database.types"
import { CHAMPS_F03, type ContenuF03 } from "@/lib/f03"
import { formatDate, formatDateHeure, FUSEAU_HORAIRE } from "@/lib/format"

import { ConsignationAccord, DecisionDigital, EditeurF03 } from "./formulaires"

export const metadata: Metadata = { title: "Cahier des charges F-03" }

const ETATS: Record<string, string> = {
  brouillon: "Brouillon", soumis: "Soumis à Digital", a_corriger: "Corrections demandées", valide: "Validé par Digital",
}
const dateLocale = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSEAU_HORAIRE })

function VersionF03({ fiche }: { fiche: Tables<"f03_versions"> }) {
  const contenu = fiche.contenu as ContenuF03
  return <div className="grid gap-4">
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{ETATS[fiche.etat]}</Badge>
      <Badge variant="outline">{fiche.accord_enregistre_le ? "Accord client consigné" : "Accord client à consigner"}</Badge>
    </div>
    {fiche.devis_reference && <p className="text-sm text-muted-foreground">Devis signé de référence · {fiche.devis_reference}</p>}
    {fiche.decision_le && <p className="text-sm">Décision Digital le {formatDateHeure(fiche.decision_le)}</p>}
    {fiche.motif && <p className="whitespace-pre-wrap text-sm">{fiche.motif}</p>}
    {fiche.accord_enregistre_le && <p className="whitespace-pre-wrap text-sm">
      Accord du {formatDate(fiche.accord_date)} · {fiche.accord_reference}
    </p>}
    <dl className="grid gap-3 sm:grid-cols-2">
      {CHAMPS_F03.map(({ nom, libelle }) => <div key={nom} className="min-w-0 border-t pt-2 text-sm">
        <dt className="text-muted-foreground">{libelle}</dt>
        <dd className="whitespace-pre-wrap break-words">
          {nom === "date_mise_en_ligne" ? formatDate(contenu[nom]) : contenu[nom] || "—"}
        </dd>
      </div>)}
    </dl>
  </div>
}

export default async function FicheF03({ params }: PageProps<"/f03/[id]">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const { supabase, organisation } = await getContexte()
  const [dossiers, versions] = await Promise.all([
    supabase.rpc("dossiers_f03", { p_org: organisation.id, p_dossier: id }),
    supabase.from("f03_versions").select("*").eq("organization_id", organisation.id).eq("dossier_id", id)
      .order("version", { ascending: false }),
  ])
  if (dossiers.error) throw dossiers.error
  if (versions.error) throw versions.error
  const dossier = dossiers.data?.[0]
  if (!dossier) notFound()
  const [courante, ...historique] = versions.data ?? []
  const brouillon = courante?.etat === "brouillon"
  const peutReviser = courante && (courante.etat === "a_corriger" || courante.etat === "valide")
  const attendAccord = courante && ["soumis", "valide"].includes(courante.etat) && !courante.accord_enregistre_le

  return <>
    <SiteHeader titre={`Cahier des charges F-03 · ${dossier.numero}`}
      sousTitre={`${dossier.client} · ${dossier.type_site_web === "refonte" ? "Refonte" : "Création"} de site web`}
      actions={<ButtonLink href="/f03" variant="outline" size="sm">Tous les F-03</ButtonLink>} />
    <PageBody>
      <Section>
        <Card>
          <CardHeader>
            <CardTitle>{courante ? `Version courante · v${courante.version}` : "Premier cahier des charges"}</CardTitle>
            <CardDescription>Le passage en cours exige la validation Digital et l’accord du client sur la version courante.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {courante && (!brouillon || !dossier.peut_rediger) && <VersionF03 fiche={courante} />}
            {!courante && !dossier.peut_rediger && <p className="text-sm text-muted-foreground">Le responsable du dossier doit préparer la première version.</p>}
            {dossier.peut_rediger && (!courante || brouillon) &&
              <EditeurF03 key={courante?.updated_at ?? "nouveau"} dossier={id} version={courante?.version ?? 1}
                modifieLe={courante?.updated_at ?? null} contenu={(courante?.contenu ?? {}) as ContenuF03} />}
            {dossier.peut_valider && courante?.etat === "soumis" && <DecisionDigital dossier={id} version={courante.version} />}
            {dossier.peut_rediger && attendAccord && <ConsignationAccord dossier={id} version={courante.version}
              aujourdHui={dateLocale.format(new Date())} />}
            {dossier.peut_rediger && peutReviser && <details className="rounded-md border p-3">
              <summary className="cursor-pointer font-medium">Préparer la version {courante.version + 1}</summary>
              <div className="mt-3 grid gap-3">
                <p className="text-sm text-muted-foreground">Dès son enregistrement, cette version devient courante et doit être approuvée à son tour.</p>
                <EditeurF03 dossier={id} version={courante.version + 1} modifieLe={null} contenu={courante.contenu as ContenuF03} />
              </div>
            </details>}
          </CardContent>
        </Card>
      </Section>
      {historique.length > 0 && <Section>
        <Card>
          <CardHeader><CardTitle>Versions précédentes</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {historique.map(fiche => <details key={fiche.id} className="rounded-md border p-3">
              <summary className="cursor-pointer font-medium">v{fiche.version} · {ETATS[fiche.etat]}</summary>
              <div className="mt-3"><VersionF03 fiche={fiche} /></div>
            </details>)}
          </CardContent>
        </Card>
      </Section>}
    </PageBody>
  </>
}
