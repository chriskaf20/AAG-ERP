"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2Icon, LinkIcon, PenLineIcon, PlusIcon } from "lucide-react"

import { LienSignature } from "@/components/lien-signature"
import { SignaturePad } from "@/components/signature-pad"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  creerAvenant,
  creerContrat,
  enregistrerPv,
  lienPv,
  signerContrat,
  signerPv,
  type PvSaisie,
} from "@/app/(app)/finance/actions"
import { useAction } from "@/hooks/use-action"
import type { Tables } from "@/lib/database.types"
import { formatDate, formatDateHeure, formatMontant } from "@/lib/format"

const POINTS = [
  "perimetre_confirme",
  "planning_confirme",
  "interlocuteurs_confirmes",
  "livrables_confirmes",
  "acces_site_confirme",
  "acompte_confirme",
] as const

type Contrat = Tables<"contrats"> & { avenants: Tables<"avenants">[] }

export function Contrats({
  dossierId,
  contrats,
  devisSignes,
  pilote,
}: {
  dossierId: string
  contrats: Contrat[]
  devisSignes: { id: string; libelle: string; total_ttc: number; devise: "USD" | "CDF" }[]
  pilote: boolean
}) {
  const t = useTranslations("contratStatuts")
  const { enCours, run } = useAction()
  const [ouvert, setOuvert] = React.useState(false)
  const [avenantPour, setAvenantPour] = React.useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contrats et avenants</CardTitle>
        {pilote && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setOuvert(true)}>
              <PlusIcon /> Contrat
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {contrats.length === 0 && <p className="text-sm text-muted-foreground">Aucun contrat.</p>}
        {contrats.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.numero}</span>
              <Badge variant="outline">{t(c.statut)}</Badge>
              <span className="flex-1 text-sm text-muted-foreground">
                {c.objet} · {formatDate(c.date_debut)} → {formatDate(c.date_fin)}
                {c.montant != null && ` · ${formatMontant(c.montant, c.devise)}`}
                {c.reception_tacite && " · Réception tacite prévue"}
              </span>
              {pilote && c.statut === "brouillon" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={enCours}
                  onClick={() =>
                    window.confirm("Marquer le contrat comme signé ? Il ne sera plus modifiable.") &&
                    run(() => signerContrat(c.id, dossierId, "contrats"))
                  }
                >
                  Marquer signé
                </Button>
              )}
              {pilote && c.statut === "signe" && (
                <Button size="sm" variant="ghost" onClick={() => setAvenantPour(c.id)}>
                  <PlusIcon /> Avenant
                </Button>
              )}
            </div>
            {c.avenants.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 pl-4 text-sm">
                <span className="font-medium">{a.numero}</span>
                <Badge variant="outline">{t(a.statut)}</Badge>
                <span className="flex-1 text-muted-foreground">
                  {a.objet} · {formatMontant(a.montant_delta, c.devise)} · effet {formatDate(a.date_effet)}
                </span>
                {pilote && a.statut === "brouillon" && (
                  <Button size="sm" variant="ghost" disabled={enCours} onClick={() => run(() => signerContrat(a.id, dossierId, "avenants"))}>
                    Marquer signé
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))}
      </CardContent>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const devisId = (fd.get("devis_id") as string) || null
              const devis = devisSignes.find((x) => x.id === devisId)
              run(
                () =>
                  creerContrat(dossierId, {
                    objet: String(fd.get("objet") ?? ""),
                    devis_id: devisId,
                    date_debut: (fd.get("date_debut") as string) || null,
                    date_fin: (fd.get("date_fin") as string) || null,
                    montant: devis ? devis.total_ttc : Number(fd.get("montant")) || null,
                    devise: devis?.devise ?? "USD",
                    reception_tacite: fd.get("reception_tacite") === "on",
                  }),
                () => setOuvert(false)
              )
            }}
          >
            <DialogHeader>
              <DialogTitle>Nouveau contrat</DialogTitle>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="ct-objet">Objet</FieldLabel>
                <Input id="ct-objet" name="objet" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="ct-devis">Devis de référence</FieldLabel>
                <NativeSelect id="ct-devis" name="devis_id" className="w-full">
                  <NativeSelectOption value="">— Aucun —</NativeSelectOption>
                  {devisSignes.map((d) => (
                    <NativeSelectOption key={d.id} value={d.id}>
                      {d.libelle}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ct-debut">Début</FieldLabel>
                  <Input id="ct-debut" name="date_debut" type="date" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ct-fin">Fin</FieldLabel>
                  <Input id="ct-fin" name="date_fin" type="date" />
                </Field>
              </div>
              <Field orientation="horizontal">
                <Checkbox id="ct-reception-tacite" name="reception_tacite" />
                <FieldLabel htmlFor="ct-reception-tacite">Clause de réception tacite prévue au contrat</FieldLabel>
              </Field>
              <Field>
                <FieldLabel htmlFor="ct-montant">Montant (si sans devis)</FieldLabel>
                <Input id="ct-montant" name="montant" type="number" min={0} step="0.01" />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={enCours}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={avenantPour !== null} onOpenChange={(o) => !o && setAvenantPour(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              run(
                () =>
                  creerAvenant(avenantPour!, dossierId, {
                    objet: String(fd.get("objet") ?? ""),
                    montant_delta: Number(fd.get("montant_delta")) || 0,
                    date_effet: (fd.get("date_effet") as string) || null,
                  }),
                () => setAvenantPour(null)
              )
            }}
          >
            <DialogHeader>
              <DialogTitle>Nouvel avenant</DialogTitle>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="av-objet">Objet</FieldLabel>
                <Textarea id="av-objet" name="objet" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="av-montant">Variation de montant</FieldLabel>
                  <Input id="av-montant" name="montant_delta" type="number" step="0.01" defaultValue={0} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="av-date">Date d&apos;effet</FieldLabel>
                  <Input id="av-date" name="date_effet" type="date" />
                </Field>
              </div>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={enCours}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

type Pv = Tables<"pv_lancement">

export function PvLancement({
  dossierId,
  pv,
  signatures,
  devisSignes,
  pilote,
  emailClient,
  disponible,
}: {
  dossierId: string
  pv: Pv | null
  signatures: { atlas: { nom: string; le: string } | null; client: { nom: string; le: string } | null }
  devisSignes: { id: string; libelle: string }[]
  pilote: boolean
  emailClient: string | null
  disponible: boolean
}) {
  const t = useTranslations("pv")
  const { enCours, run } = useAction()
  const verrouille = Boolean(pv?.signature_atlas_id || pv?.signature_client_id)
  const [v, setV] = React.useState<PvSaisie>(() => ({
    devis_id: pv?.devis_id ?? devisSignes[0]?.id ?? null,
    date_lancement: pv?.date_lancement ?? new Date().toISOString().slice(0, 10),
    lieu: pv?.lieu ?? "",
    perimetre_confirme: pv?.perimetre_confirme ?? false,
    planning_confirme: pv?.planning_confirme ?? false,
    interlocuteurs_confirmes: pv?.interlocuteurs_confirmes ?? false,
    livrables_confirmes: pv?.livrables_confirmes ?? false,
    acces_site_confirme: pv?.acces_site_confirme ?? false,
    acompte_confirme: pv?.acompte_confirme ?? false,
    observations: pv?.observations ?? "",
  }))
  const [signer, setSigner] = React.useState<"atlas" | "client" | null>(null)
  const [nom, setNom] = React.useState("")
  const [image, setImage] = React.useState<string | null>(null)
  const [lien, setLien] = React.useState<string | null>(null)
  const tousConfirmes = POINTS.every((p) => v[p])
  const lecture = !pilote || verrouille

  if (!disponible && !pv) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PV de lancement F-04</CardTitle>
          <CardDescription>Disponible une fois le devis signé.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          PV de lancement F-04
          {pv?.signe_le && (
            <Badge variant="outline" className="border-success/40 text-success">
              Signé le {formatDateHeure(pv.signe_le)}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Points confirmés et signature des deux parties.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(() => enregistrerPv(dossierId, pv?.id ?? null, { ...v, lieu: v.lieu || null, observations: v.observations || null }))
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="pv-date">Date de lancement</FieldLabel>
                <Input id="pv-date" type="date" value={v.date_lancement} disabled={lecture}
                  onChange={(e) => setV({ ...v, date_lancement: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pv-lieu">Lieu</FieldLabel>
                <Input id="pv-lieu" value={v.lieu ?? ""} disabled={lecture} onChange={(e) => setV({ ...v, lieu: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pv-devis">Devis</FieldLabel>
                <NativeSelect id="pv-devis" className="w-full" value={v.devis_id ?? ""} disabled={lecture}
                  onChange={(e) => setV({ ...v, devis_id: e.target.value || null })}>
                  <NativeSelectOption value="">—</NativeSelectOption>
                  {devisSignes.map((d) => (
                    <NativeSelectOption key={d.id} value={d.id}>
                      {d.libelle}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {POINTS.map((p) => (
                <Field key={p} orientation="horizontal">
                  <Checkbox id={`pv-${p}`} checked={Boolean(v[p])} disabled={lecture}
                    onCheckedChange={(c) => setV({ ...v, [p]: Boolean(c) })} />
                  <FieldLabel htmlFor={`pv-${p}`} className="font-normal">
                    {t(p)}
                  </FieldLabel>
                </Field>
              ))}
            </div>
            <Field>
              <FieldLabel htmlFor="pv-obs">Observations</FieldLabel>
              <Textarea id="pv-obs" value={v.observations ?? ""} disabled={lecture}
                onChange={(e) => setV({ ...v, observations: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["atlas", "client"] as const).map((partie) => {
                const s = signatures[partie]
                return (
                  <div key={partie} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{partie === "atlas" ? "Pour Atlas" : "Pour le client"}</p>
                    {s ? (
                      <p className="mt-1 flex items-center gap-1.5 text-success">
                        <CheckCircle2Icon className="size-4" aria-hidden /> {s.nom} — {formatDateHeure(s.le)}
                      </p>
                    ) : pv && pilote ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={!tousConfirmes || enCours}
                          onClick={() => { setNom(""); setImage(null); setSigner(partie) }}>
                          <PenLineIcon /> Signer ici
                        </Button>
                        {partie === "client" && (
                          <Button type="button" size="sm" variant="ghost" disabled={!tousConfirmes || enCours}
                            onClick={() => run(() => lienPv(pv.id, dossierId), (r) => setLien(r.data ?? null))}>
                            <LinkIcon /> Lien à distance
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-muted-foreground">Non signé</p>
                    )}
                  </div>
                )
              })}
            </div>
            {!lecture && (
              <div className="flex items-center justify-end gap-3">
                {!tousConfirmes && <span className="text-xs text-muted-foreground">Tous les points doivent être confirmés pour signer.</span>}
                <Button type="submit" variant="outline" disabled={enCours}>
                  Enregistrer le PV
                </Button>
              </div>
            )}
          </FieldGroup>
        </form>
      </CardContent>

      <Dialog open={signer !== null} onOpenChange={(o) => !o && setSigner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signature {signer === "atlas" ? "Atlas" : "du client"}</DialogTitle>
            <DialogDescription>Signature sur place (tablette ou téléphone). Elle sera horodatée.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-2">
            <Field>
              <FieldLabel htmlFor="pv-nom">Nom du signataire</FieldLabel>
              <Input id="pv-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
            </Field>
            <SignaturePad onChange={setImage} />
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={enCours || !image || nom.trim().length < 2}
              onClick={() => run(() => signerPv(pv!.id, dossierId, signer!, nom, image!), () => setSigner(null))}
            >
              Valider la signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LienSignature
        url={lien}
        titre="PV de lancement à signer"
        message="Bonjour, voici le PV de lancement à signer en ligne :"
        email={emailClient}
        onClose={() => setLien(null)}
      />
    </Card>
  )
}
