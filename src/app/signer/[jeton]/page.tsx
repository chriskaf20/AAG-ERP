import type { Metadata } from "next"
import { FileTextIcon } from "lucide-react"

import { Logo } from "@/components/logo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatMontant } from "@/lib/format"
import { DECISIONS_PV, RESULTATS_PV } from "@/lib/reception"
import { donneesDevis } from "@/lib/pdf/donnees"
import { createAdminClient } from "@/lib/supabase/admin"
import { FormulaireSignature } from "./formulaire-signature"

export const metadata: Metadata = { title: "Signature", robots: { index: false, follow: false } }

type Info = {
  valide: boolean
  raison: string | null
  objet_type: "devis" | "pv_lancement" | "pv_reception"
  objet_id: string
  dossier_id: string
}

const POINTS_PV = [
  ["perimetre_confirme", "Périmètre des prestations confirmé"],
  ["planning_confirme", "Planning et date de démarrage confirmés"],
  ["interlocuteurs_confirmes", "Interlocuteurs désignés des deux côtés"],
  ["livrables_confirmes", "Livrables et critères de réception confirmés"],
  ["acces_site_confirme", "Accès au site et logistique confirmés"],
  ["acompte_confirme", "Acompte encaissé"],
] as const

export default async function PageSignature({ params }: PageProps<"/signer/[jeton]">) {
  const { jeton } = await params
  const admin = createAdminClient()
  const { data } = /^[0-9a-f]{64}$/.test(jeton)
    ? await admin.rpc("lien_signature_info", { p_token: jeton })
    : { data: { valide: false, raison: "Lien invalide" } }
  const info = data as Info

  let contenu: React.ReactNode
  if (!info?.valide) {
    contenu = (
      <Alert>
        <AlertTitle>Signature indisponible</AlertTitle>
        <AlertDescription>{info?.raison ?? "Lien invalide"}</AlertDescription>
      </Alert>
    )
  } else if (info.objet_type === "devis") {
    const d = await donneesDevis(admin, info.objet_id)
    if (!d) {
      contenu = <Alert><AlertDescription>Devis introuvable.</AlertDescription></Alert>
    } else {
      contenu = (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Devis {d.devis.numero} — version {d.devis.version}
              </CardTitle>
              <CardDescription>
                {d.org.nom} · dossier {d.dossierNumero} · valable jusqu&apos;au {formatDate(d.devis.date_validite)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p>
                <span className="text-muted-foreground">Client : </span>
                {d.client.raison_sociale}
              </p>
              {d.devis.objet && (
                <p>
                  <span className="text-muted-foreground">Objet : </span>
                  {d.devis.objet}
                </p>
              )}
              <ul className="divide-y rounded-lg border">
                {d.lignes.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 p-2">
                    <span>
                      {l.description}{" "}
                      <span className="text-muted-foreground">
                        × {l.quantite} {l.unite}
                      </span>
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatMontant(l.montant_ht, d.totaux.devise)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="ml-auto w-full max-w-64 space-y-1">
                <p className="flex justify-between">
                  <span>Total HT</span>
                  <span className="tabular-nums">{formatMontant(d.totaux.total_ht, d.totaux.devise)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Taxes</span>
                  <span className="tabular-nums">{formatMontant(d.totaux.total_taxes, d.totaux.devise)}</span>
                </p>
                <p className="flex justify-between rounded bg-primary px-2 py-1 font-semibold text-primary-foreground">
                  <span>Total TTC</span>
                  <span className="tabular-nums">{formatMontant(d.totaux.total_ttc, d.totaux.devise)}</span>
                </p>
              </div>
              {d.devis.conditions_paiement && (
                <p className="text-muted-foreground">Conditions : {d.devis.conditions_paiement}</p>
              )}
              <a
                href={`/signer/${jeton}/pdf`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 font-medium text-primary hover:underline dark:text-foreground"
              >
                <FileTextIcon className="size-4" aria-hidden /> Voir le devis complet (PDF)
              </a>
            </CardContent>
          </Card>
          <FormulaireSignature jeton={jeton} accord="J'ai lu le devis et je l'accepte (bon pour accord)." />
        </>
      )
    }
  } else if (info.objet_type === "pv_reception") {
    const [{ data: pv }, { data: lignes }, { data: reserves }] = await Promise.all([
      admin.from("pv_reception").select("*, dossiers(numero, organizations(nom))").eq("id", info.objet_id).maybeSingle(),
      admin.from("pv_reception_lignes").select("libelle, resultat, observation").eq("pv_id", info.objet_id).order("ordre").order("created_at"),
      admin.from("reserves").select("description, date_limite").eq("pv_id", info.objet_id).order("created_at"),
    ])
    contenu = pv && lignes && reserves ? <>
      <Card>
        <CardHeader>
          <CardTitle>PV de réception F-{pv.type.slice(1)} · version {pv.version}</CardTitle>
          <CardDescription>{pv.dossiers?.organizations?.nom} · Dossier {pv.dossiers?.numero} · {formatDate(pv.date_reception)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>{pv.decision && DECISIONS_PV[pv.decision]}{pv.lieu && ` · ${pv.lieu}`}</p>
          {pv.observations && <p className="whitespace-pre-wrap">{pv.observations}</p>}
          {pv.satisfaction != null && <p>Satisfaction {pv.satisfaction}/5</p>}
          <ul className="grid gap-2">{lignes.map((l, i) => <li key={i}>
            <strong>{l.libelle}</strong> · {l.resultat && RESULTATS_PV[l.resultat]}{l.observation && ` · ${l.observation}`}
          </li>)}</ul>
          {reserves.length > 0 && <div className="grid gap-1">
            <h2 className="font-medium">Réserves · échéance le {formatDate(pv.date_limite_reserves)}</h2>
            <ul className="list-inside list-disc">{reserves.map((r, i) => <li key={i}>
              {r.description}{r.date_limite && ` · ${formatDate(r.date_limite)}`}
            </li>)}</ul>
          </div>}
        </CardContent>
      </Card>
      <FormulaireSignature jeton={jeton} accord="J’ai lu le procès-verbal et j’accepte la réception selon la décision indiquée." />
    </> : <Alert><AlertDescription>PV de réception indisponible.</AlertDescription></Alert>
  } else {
    const { data: pv } = await admin
      .from("pv_lancement")
      .select("*, dossiers(numero, organizations(nom))")
      .eq("id", info.objet_id)
      .single()
    contenu = (
      <>
        <Card>
          <CardHeader>
            <CardTitle>PV de lancement F-04</CardTitle>
            <CardDescription>
              {pv?.dossiers?.organizations?.nom} · dossier {pv?.dossiers?.numero} · lancement le{" "}
              {formatDate(pv?.date_lancement)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <ul className="list-inside list-disc">
              {POINTS_PV.map(([k, l]) => (pv?.[k] ? <li key={k}>{l}</li> : null))}
            </ul>
            {pv?.observations && <p className="text-muted-foreground">Observations : {pv.observations}</p>}
          </CardContent>
        </Card>
        <FormulaireSignature jeton={jeton} accord="Je confirme les points ci-dessus et le lancement des prestations." />
      </>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 bg-background p-4 sm:p-6">
      <header className="flex justify-center py-2">
        <Logo taille={96} className="rounded-xl" />
      </header>
      {contenu}
    </main>
  )
}
