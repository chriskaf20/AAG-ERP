"use client"

import * as React from "react"
import { AlertTriangleIcon, FileDownIcon, FilePlus2Icon, LinkIcon, LockIcon, SendIcon } from "lucide-react"

import { ActionProtegee } from "@/components/action-protegee"

import { EditeurLignes, type Ligne, type Service } from "@/components/editeur-lignes"
import { DevisBadge } from "@/components/finance-badges"
import { LienSignature } from "@/components/lien-signature"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  creerDevis,
  enregistrerEnteteDevis,
  enregistrerLigneDevis,
  envoyerDevis,
  nouvelleVersionDevis,
  refuserDevis,
  regenererLienDevis,
  soumettreDevis,
  supprimerDevis,
  supprimerLigneDevis,
  validerDevis,
} from "@/app/(app)/finance/actions"
import { useAction } from "@/hooks/use-action"
import type { Tables } from "@/lib/database.types"
import type { DroitsDossier } from "@/lib/permissions"
import { formatDate, formatDateHeure, formatMontant } from "@/lib/format"

export type DevisVue = Tables<"devis"> & { lignes: Ligne[]; signataire: string | null }

export function OngletDevis({
  dossierId,
  peutCreer,
  devis,
  services,
  droits,
  seuilUsd,
  emailClient,
}: {
  dossierId: string
  peutCreer: boolean
  devis: DevisVue[]
  services: Service[]
  droits: DroitsDossier
  seuilUsd: number
  emailClient: string | null
}) {
  const { enCours, run } = useAction()
  const pilote = droits.devis_write
  const actifs = devis.filter((d) => d.statut !== "remplace")
  const remplaces = devis.filter((d) => d.statut === "remplace")
  const brouillonExiste = devis.some((d) => d.statut === "brouillon" || d.statut === "valide")

  return (
    <div className="flex flex-col gap-4">
      {pilote && peutCreer && !brouillonExiste && (
        <div>
          <Button disabled={enCours} onClick={() => run(() => creerDevis(dossierId))}>
            <FilePlus2Icon /> Nouveau devis
          </Button>
        </div>
      )}
      {!peutCreer && devis.length === 0 && (
        <Alert>
          <AlertDescription>Un devis s&apos;établit une fois le dossier accepté.</AlertDescription>
        </Alert>
      )}
      {actifs.map((d) => (
        <CarteDevis
          key={d.id}
          d={d}
          dossierId={dossierId}
          services={services}
          droits={droits}
          seuilUsd={seuilUsd}
          emailClient={emailClient}
        />
      ))}
      {remplaces.length > 0 && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Versions remplacées ({remplaces.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {remplaces.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {d.numero} v{d.version}
                </span>
                <DevisBadge statut={d.statut} />
                <span className="tabular-nums">{formatMontant(d.total_ttc, d.devise)}</span>
                <a className="text-primary hover:underline dark:text-foreground" href={`/pdf/devis/${d.id}`} target="_blank" rel="noopener">
                  PDF
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function CarteDevis({
  d,
  dossierId,
  services,
  droits,
  seuilUsd,
  emailClient,
}: {
  d: DevisVue
  dossierId: string
  services: Service[]
  droits: DroitsDossier
  seuilUsd: number
  emailClient: string | null
}) {
  const { enCours, run } = useAction()
  const pilote = droits.devis_write
  const [lien, setLien] = React.useState<string | null>(null)
  const modifiable = pilote && (d.statut === "brouillon" || d.statut === "valide")

  const envoyer = () => run(() => envoyerDevis(d.id, dossierId), (r) => setLien(r.data ?? null))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {d.numero} <span className="text-muted-foreground">v{d.version}</span> <DevisBadge statut={d.statut} />
        </CardTitle>
        <CardDescription>
          {d.objet ?? "Sans objet"} · valable jusqu&apos;au {formatDate(d.date_validite)}
          {d.signe_le && ` · signé le ${formatDateHeure(d.signe_le)}${d.signataire ? ` par ${d.signataire}` : ""}`}
        </CardDescription>
        <CardAction>
          <a
            href={`/pdf/devis/${d.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline dark:text-foreground"
          >
            <FileDownIcon className="size-4" aria-hidden /> PDF
          </a>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {d.depasse_seuil && d.statut === "brouillon" && (
          <Alert>
            <AlertTriangleIcon />
            <AlertDescription>
              Total de {formatMontant(d.total_ttc_usd, "USD")} au-dessus du seuil de{" "}
              {formatMontant(seuilUsd, "USD")} : validation du gérant requise avant l&apos;envoi.
            </AlertDescription>
          </Alert>
        )}
        {d.statut === "valide" && (
          <Alert>
            <LockIcon />
            <AlertDescription>Validé par le gérant. Toute modification annulera la validation.</AlertDescription>
          </Alert>
        )}
        {d.statut === "refuse" && d.motif_refus && (
          <Alert variant="destructive">
            <AlertDescription>Refusé : {d.motif_refus}</AlertDescription>
          </Alert>
        )}

        {modifiable && <EnteteDevis d={d} dossierId={dossierId} />}

        <EditeurLignes
          lignes={d.lignes}
          services={services}
          devise={d.devise}
          tauxCdf={d.taux_cdf}
          lectureSeule={!modifiable}
          avecCout={droits.marges_read}
          enCours={enCours}
          onAjouter={(l, reset) => run(() => enregistrerLigneDevis(d.id, dossierId, null, l), reset)}
          onModifier={(id, l) => run(() => enregistrerLigneDevis(d.id, dossierId, id, l))}
          onSupprimer={(id) => run(() => supprimerLigneDevis(id, dossierId))}
        />

        <dl className="ml-auto grid w-full max-w-72 grid-cols-2 gap-y-1 text-sm">
          <dt>Total HT</dt>
          <dd className="text-right tabular-nums">{formatMontant(d.total_ht, d.devise)}</dd>
          <dt>Taxes</dt>
          <dd className="text-right tabular-nums">{formatMontant(d.total_taxes, d.devise)}</dd>
          <dt className="font-semibold">Total TTC</dt>
          <dd className="text-right font-semibold tabular-nums">{formatMontant(d.total_ttc, d.devise)}</dd>
          {droits.marges_read && (
            <>
              <dt className="text-muted-foreground">Marge estimée</dt>
              <dd className="text-right text-muted-foreground tabular-nums">
                {formatMontant(d.marge, d.devise)}
                {d.total_ht > 0 && ` (${Math.round((d.marge / d.total_ht) * 100)} %)`}
              </dd>
            </>
          )}
          {d.devise === "CDF" && (
            <>
              <dt className="text-muted-foreground">Contre-valeur</dt>
              <dd className="text-right text-muted-foreground tabular-nums">{formatMontant(d.total_ttc_usd, "USD")}</dd>
            </>
          )}
        </dl>

        <div className="flex flex-wrap justify-end gap-2">
          {pilote && d.statut === "brouillon" && (
            <Button
              variant="ghost"
              disabled={enCours}
              onClick={() => window.confirm("Supprimer ce brouillon ?") && run(() => supprimerDevis(d.id, dossierId))}
            >
              Supprimer
            </Button>
          )}
          {d.statut === "brouillon" && d.depasse_seuil && d.lignes.length > 0 && (
            <ActionProtegee
              autorise={droits.devis_validate}
              raison="Validation réservée au gérant"
              variant="outline"
              disabled={enCours}
              onClick={() => run(() => validerDevis(d.id, dossierId))}
            >
              <LockIcon /> Valider (gérant)
            </ActionProtegee>
          )}
          {modifiable && d.lignes.length > 0 && !droits.devis_send && (
            <Button
              variant="outline"
              disabled={enCours || Boolean(d.soumis_le)}
              onClick={() => run(() => soumettreDevis(d.id, dossierId))}
            >
              <SendIcon /> {d.soumis_le ? `Soumis le ${formatDateHeure(d.soumis_le)}` : "Soumettre au responsable de département"}
            </Button>
          )}
          {(d.statut === "brouillon" || d.statut === "valide") && d.lignes.length > 0 && (
            <ActionProtegee
              autorise={droits.devis_send && (!d.depasse_seuil || d.statut === "valide")}
              raison={
                !droits.devis_send
                  ? "Envoi réservé au responsable du département du dossier ou au gérant"
                  : "Au-dessus du seuil : validation du gérant requise avant l'envoi"
              }
              disabled={enCours}
              onClick={envoyer}
            >
              Envoyer au client
            </ActionProtegee>
          )}
          {d.statut === "envoye" && (pilote || droits.devis_send) && (
            <>
              <Button
                variant="ghost"
                disabled={enCours}
                onClick={() => {
                  const motif = window.prompt("Motif du refus du client ?")
                  if (motif?.trim()) run(() => refuserDevis(d.id, dossierId, motif))
                }}
              >
                Refusé par le client
              </Button>
              <ActionProtegee
                autorise={droits.devis_send}
                raison="Réservé au responsable du département du dossier ou au gérant"
                variant="outline"
                disabled={enCours}
                onClick={() => run(() => regenererLienDevis(d.id, dossierId), (r) => setLien(r.data ?? null))}
              >
                <LinkIcon /> Nouveau lien de signature
              </ActionProtegee>
            </>
          )}
          {pilote && ["envoye", "signe", "refuse", "expire"].includes(d.statut) && (
            <Button variant="outline" disabled={enCours} onClick={() => run(() => nouvelleVersionDevis(d.id, dossierId))}>
              Nouvelle version
            </Button>
          )}
        </div>
      </CardContent>
      <LienSignature
        url={lien}
        titre={`Devis ${d.numero} v${d.version} à signer`}
        message={`Bonjour, voici le devis ${d.numero} à consulter et signer en ligne :`}
        email={emailClient}
        onClose={() => setLien(null)}
      />
    </Card>
  )
}

function EnteteDevis({ d, dossierId }: { d: DevisVue; dossierId: string }) {
  const { enCours, run } = useAction()
  const [v, setV] = React.useState({
    objet: d.objet ?? "",
    devise: d.devise,
    taux_cdf: d.taux_cdf,
    acompte_pct: d.acompte_pct ?? 0,
    conditions_paiement: d.conditions_paiement ?? "",
    date_devis: d.date_devis,
  })
  return (
    <form
      className="grid gap-3 sm:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(() =>
          enregistrerEnteteDevis(d.id, dossierId, {
            ...v,
            objet: v.objet || null,
            conditions_paiement: v.conditions_paiement || null,
          })
        )
      }}
    >
      <Field className="sm:col-span-3">
        <FieldLabel htmlFor={`objet-${d.id}`}>Objet</FieldLabel>
        <Input id={`objet-${d.id}`} value={v.objet} onChange={(e) => setV({ ...v, objet: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`date-${d.id}`}>Date</FieldLabel>
        <Input id={`date-${d.id}`} type="date" value={v.date_devis} onChange={(e) => setV({ ...v, date_devis: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`devise-${d.id}`}>Devise</FieldLabel>
        <NativeSelect
          id={`devise-${d.id}`}
          className="w-full"
          value={v.devise}
          onChange={(e) => setV({ ...v, devise: e.target.value as "USD" | "CDF" })}
        >
          <NativeSelectOption value="USD">USD</NativeSelectOption>
          <NativeSelectOption value="CDF">CDF</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor={`acompte-${d.id}`}>Acompte %</FieldLabel>
        <Input
          id={`acompte-${d.id}`}
          type="number"
          min={0}
          max={100}
          value={v.acompte_pct}
          onChange={(e) => setV({ ...v, acompte_pct: Number(e.target.value) })}
        />
      </Field>
      {v.devise === "CDF" && (
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`taux-${d.id}`}>Taux du jour (CDF pour 1 USD)</FieldLabel>
          <Input
            id={`taux-${d.id}`}
            type="number"
            min={1}
            step="0.01"
            value={v.taux_cdf}
            onChange={(e) => setV({ ...v, taux_cdf: Number(e.target.value) })}
          />
        </Field>
      )}
      <Field className={v.devise === "CDF" ? "sm:col-span-4" : "sm:col-span-6"}>
        <FieldLabel htmlFor={`conditions-${d.id}`}>Conditions de paiement</FieldLabel>
        <Textarea
          id={`conditions-${d.id}`}
          rows={2}
          value={v.conditions_paiement}
          onChange={(e) => setV({ ...v, conditions_paiement: e.target.value })}
        />
      </Field>
      <div className="flex justify-end sm:col-span-6">
        <Button type="submit" variant="outline" size="sm" disabled={enCours}>
          Enregistrer l&apos;en-tête
        </Button>
      </div>
    </form>
  )
}
