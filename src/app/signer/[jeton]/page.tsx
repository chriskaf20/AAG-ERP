import type { Metadata } from "next"
import { FileTextIcon } from "lucide-react"

import { Logo } from "@/components/logo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatMontant } from "@/lib/format"
import { donneesDevis } from "@/lib/pdf/donnees"
import { createAdminClient } from "@/lib/supabase/admin"
import { FormulaireSignature } from "./formulaire-signature"

export const metadata: Metadata = { title: "Signature", robots: { index: false, follow: false } }

type Info = {
  valide: boolean
  raison: string | null
  objet_type: "devis" | "pv_lancement"
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
