"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { BadgeCheckIcon, BanknoteIcon, FileDownIcon, PlusIcon, ReceiptIcon, UndoIcon } from "lucide-react"

import { EditeurLignes, type Ligne, type Service } from "@/components/editeur-lignes"
import { ActionProtegee } from "@/components/action-protegee"
import { FactureBadge } from "@/components/finance-badges"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  creerFactureDepuisDevis,
  creerFactureMensuelle,
  emettreAvoir,
  emettreFacture,
  enregistrerLigneFacture,
  enregistrerPaiement,
  marquerFactureRemise,
  normaliserFacture,
  supprimerFactureBrouillon,
  supprimerLigneFacture,
} from "@/app/(app)/finance/actions"
import { useAction } from "@/hooks/use-action"
import type { Tables } from "@/lib/database.types"
import type { DroitsDossier } from "@/lib/permissions"
import { formatDate, formatDateHeure, formatMontant } from "@/lib/format"

export type FactureVue = Omit<Tables<"factures">, "solde_du"> & {
  solde_du: number
  lignes: Ligne[]
  paiements: Tables<"paiements">[]
  avoirs: Tables<"avoirs">[]
}

type Dialogue = { type: "paiement" | "avoir" | "normaliser"; f: FactureVue } | null

const MODES = ["banque", "mpesa", "airtel_money", "orange_money", "especes"] as const

function aujourdhui() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lubumbashi" }).format(new Date())
}

export function OngletFactures({
  dossierId,
  factures,
  devisSignes,
  services,
  droits,
  relances,
}: {
  dossierId: string
  factures: FactureVue[]
  devisSignes: { id: string; libelle: string; acompte_pct: number | null }[]
  services: Service[]
  droits: DroitsDossier
  relances: Tables<"relances">[]
}) {
  const t = useTranslations()
  const { enCours, run } = useAction()
  const [dialogue, setDialogue] = React.useState<Dialogue>(null)
  const [mensuelle, setMensuelle] = React.useState(false)
  const peutCreer = droits.factures_write
  const RAISON_FINANCE = "Réservé au DAF ou au gérant"
  const existe = (devisId: string, type: string) =>
    factures.some((f) => f.devis_id === devisId && f.type === type && f.statut !== "annulee")

  return (
    <div className="flex flex-col gap-4">
      {peutCreer && (
        <div className="flex flex-wrap gap-2">
          {devisSignes.map((d) => (
            <React.Fragment key={d.id}>
              {(d.acompte_pct ?? 0) > 0 && !existe(d.id, "acompte") && (
                <Button variant="outline" disabled={enCours} onClick={() => run(() => creerFactureDepuisDevis(d.id, dossierId, "acompte"))}>
                  <PlusIcon /> Acompte {d.acompte_pct} % — {d.libelle}
                </Button>
              )}
              {!existe(d.id, "solde") && (
                <Button variant="outline" disabled={enCours} onClick={() => run(() => creerFactureDepuisDevis(d.id, dossierId, "solde"))}>
                  <PlusIcon /> Solde — {d.libelle}
                </Button>
              )}
            </React.Fragment>
          ))}
          <Button variant="outline" onClick={() => setMensuelle(true)}>
            <PlusIcon /> Facture mensuelle
          </Button>
        </div>
      )}
      {devisSignes.length === 0 && factures.length === 0 && (
        <Alert>
          <AlertDescription>Les factures d&apos;acompte et de solde se créent à partir d&apos;un devis signé.</AlertDescription>
        </Alert>
      )}

      {factures.map((f) => (
        <Card key={f.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {f.numero ?? "Brouillon"}
              <span className="text-sm font-normal text-muted-foreground">{t(`factureTypes.${f.type}`)}</span>
              <FactureBadge statut={f.statut} />
              {f.normalisee_le ? (
                <Badge variant="outline" className="border-success/40 text-success">
                  <BadgeCheckIcon /> Normalisée DGI
                </Badge>
              ) : f.statut !== "brouillon" ? (
                <Badge variant="outline" className="border-warning/40 text-warning">
                  Pro forma
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              {f.objet ?? "—"}
              {f.date_emission && ` · émise le ${formatDate(f.date_emission)} · échéance ${formatDate(f.echeance)}`}
              {f.normalisee_le && ` · n° normalisé ${f.numero_facture_normalisee} · code DEF ${f.code_authentification_def}`}
              {f.remise_client_le && ` · remise au client le ${formatDate(f.remise_client_le)}`}
            </CardDescription>
            <CardAction>
              <a href={`/pdf/factures/${f.id}`} target="_blank" rel="noopener"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline dark:text-foreground">
                <FileDownIcon className="size-4" aria-hidden /> PDF
              </a>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <EditeurLignes
              lignes={f.lignes}
              services={services}
              devise={f.devise}
              tauxCdf={f.taux_cdf}
              lectureSeule={f.statut !== "brouillon" || !peutCreer || f.type !== "mensuelle"}
              enCours={enCours}
              onAjouter={(l, reset) => run(() => enregistrerLigneFacture(f.id, dossierId, l), reset)}
              onSupprimer={(id) => run(() => supprimerLigneFacture(id, dossierId))}
            />
            <dl className="ml-auto grid w-full max-w-72 grid-cols-2 gap-y-1 text-sm">
              <dt>Total HT</dt>
              <dd className="text-right tabular-nums">{formatMontant(f.total_ht, f.devise)}</dd>
              <dt>Taxes</dt>
              <dd className="text-right tabular-nums">{formatMontant(f.total_taxes, f.devise)}</dd>
              <dt className="font-semibold">Total TTC</dt>
              <dd className="text-right font-semibold tabular-nums">{formatMontant(f.total_ttc, f.devise)}</dd>
              {f.statut !== "brouillon" && (
                <>
                  <dt>Payé</dt>
                  <dd className="text-right tabular-nums">{formatMontant(f.montant_paye, f.devise)}</dd>
                  {f.montant_avoirs > 0 && (
                    <>
                      <dt>Avoirs</dt>
                      <dd className="text-right tabular-nums">{formatMontant(f.montant_avoirs, f.devise)}</dd>
                    </>
                  )}
                  <dt className="font-semibold">Solde dû</dt>
                  <dd className="text-right font-semibold tabular-nums">{formatMontant(f.solde_du, f.devise)}</dd>
                </>
              )}
            </dl>

            {(f.paiements.length > 0 || f.avoirs.length > 0) && (
              <ul className="flex flex-col gap-1 rounded-lg border p-2 text-sm">
                {f.paiements.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2">
                    <ReceiptIcon className="size-4 text-muted-foreground" aria-hidden />
                    <a href={`/pdf/recus/${p.id}`} target="_blank" rel="noopener" className="font-medium text-primary hover:underline dark:text-foreground">
                      {p.numero_recu}
                    </a>
                    <span className="tabular-nums">{formatMontant(p.montant, p.devise)}</span>
                    <span className="text-muted-foreground">
                      {t(`modesPaiement.${p.mode}`)} {p.reference && `· ${p.reference}`} · {formatDate(p.date_paiement)}
                    </span>
                  </li>
                ))}
                {f.avoirs.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2">
                    <UndoIcon className="size-4 text-muted-foreground" aria-hidden />
                    <span className="font-medium">{a.numero}</span>
                    <span className="tabular-nums">- {formatMontant(a.montant_ttc, f.devise)}</span>
                    <span className="text-muted-foreground">{a.motif}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {f.statut === "brouillon" && peutCreer && (
                <Button variant="ghost" disabled={enCours}
                  onClick={() => window.confirm("Supprimer ce brouillon ?") && run(() => supprimerFactureBrouillon(f.id, dossierId))}>
                  Supprimer
                </Button>
              )}
              {f.statut === "brouillon" && (
                <ActionProtegee autorise={droits.factures_write} raison={RAISON_FINANCE} disabled={enCours || f.total_ttc <= 0}
                  onClick={() => window.confirm("Émettre la facture ? Elle recevra un numéro FAC définitif et ne sera plus modifiable.") &&
                    run(() => emettreFacture(f.id, dossierId))}>
                  Émettre
                </ActionProtegee>
              )}
              {!["brouillon", "annulee"].includes(f.statut) && !f.remise_client_le && (
                <ActionProtegee
                  autorise={droits.factures_write && !(f.type === "solde" && !f.normalisee_le)}
                  raison={!droits.factures_write ? RAISON_FINANCE : "Facture de solde : normalisation e-DEF requise avant la remise"}
                  variant="outline"
                  disabled={enCours}
                  onClick={() => run(() => marquerFactureRemise(f.id, dossierId))}
                >
                  Remise au client
                </ActionProtegee>
              )}
              {f.statut !== "brouillon" && !f.normalisee_le && (
                <ActionProtegee autorise={droits.normalisation_write} raison={RAISON_FINANCE} variant="outline"
                  onClick={() => setDialogue({ type: "normaliser", f })}>
                  <BadgeCheckIcon /> Saisir la normalisation e-DEF
                </ActionProtegee>
              )}
              {f.statut !== "brouillon" && f.solde_du > 0 && (
                <>
                  <ActionProtegee autorise={droits.factures_write} raison={RAISON_FINANCE} variant="outline"
                    onClick={() => setDialogue({ type: "avoir", f })}>
                    <UndoIcon /> Avoir
                  </ActionProtegee>
                  <ActionProtegee autorise={droits.paiements_write} raison={RAISON_FINANCE}
                    onClick={() => setDialogue({ type: "paiement", f })}>
                    <BanknoteIcon /> Encaisser
                  </ActionProtegee>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {relances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Relances</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {relances.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t(`relanceNiveaux.${r.niveau}`)}</Badge>
                  <span>{r.objet_type === "devis" ? "Devis" : "Facture"}</span>
                  <span className="text-muted-foreground">
                    {formatDateHeure(r.envoyee_le)} → {r.destinataire ?? "—"}
                  </span>
                  {r.statut === "echec" && <span className="text-destructive">Échec : {r.erreur}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <DialogueFacture dialogue={dialogue} dossierId={dossierId} onClose={() => setDialogue(null)} />

      <Dialog open={mensuelle} onOpenChange={setMensuelle}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              run(
                () =>
                  creerFactureMensuelle(dossierId, {
                    objet: String(fd.get("objet") ?? ""),
                    periode_debut: String(fd.get("periode_debut") ?? ""),
                    periode_fin: String(fd.get("periode_fin") ?? ""),
                    devise: fd.get("devise") as "USD" | "CDF",
                  }),
                () => setMensuelle(false)
              )
            }}
          >
            <DialogHeader>
              <DialogTitle>Facture mensuelle</DialogTitle>
              <DialogDescription>Créée en brouillon ; ajoutez ensuite les lignes.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="fm-objet">Objet</FieldLabel>
                <Input id="fm-objet" name="objet" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="fm-debut">Du</FieldLabel>
                  <Input id="fm-debut" name="periode_debut" type="date" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fm-fin">Au</FieldLabel>
                  <Input id="fm-fin" name="periode_fin" type="date" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fm-devise">Devise</FieldLabel>
                  <NativeSelect id="fm-devise" name="devise" className="w-full">
                    <NativeSelectOption value="USD">USD</NativeSelectOption>
                    <NativeSelectOption value="CDF">CDF</NativeSelectOption>
                  </NativeSelect>
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
    </div>
  )
}

function DialogueFacture({
  dialogue,
  dossierId,
  onClose,
}: {
  dialogue: Dialogue
  dossierId: string
  onClose: () => void
}) {
  const t = useTranslations("modesPaiement")
  const { enCours, run } = useAction()
  const f = dialogue?.f

  return (
    <Dialog open={dialogue !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {f && dialogue?.type === "paiement" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              run(
                () =>
                  enregistrerPaiement(f.id, dossierId, f.devise, {
                    montant: Number(fd.get("montant")),
                    mode: fd.get("mode") as (typeof MODES)[number],
                    reference: String(fd.get("reference") ?? "").trim() || null,
                    date_paiement: String(fd.get("date_paiement")),
                  }),
                (r) => {
                  onClose()
                  if (r.data) window.open(`/pdf/recus/${r.data}`, "_blank", "noopener")
                }
              )
            }}
          >
            <DialogHeader>
              <DialogTitle>Encaissement — {f.numero}</DialogTitle>
              <DialogDescription>Solde dû : {formatMontant(f.solde_du, f.devise)}. Un reçu REC sera généré.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="p-montant">Montant ({f.devise})</FieldLabel>
                  <Input id="p-montant" name="montant" type="number" step="0.01" min={0.01} max={f.solde_du} defaultValue={f.solde_du} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-date">Date</FieldLabel>
                  <Input id="p-date" name="date_paiement" type="date" defaultValue={aujourdhui()} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-mode">Mode</FieldLabel>
                  <NativeSelect id="p-mode" name="mode" className="w-full" defaultValue="banque">
                    {MODES.map((m) => (
                      <NativeSelectOption key={m} value={m}>
                        {t(m)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-ref">Référence</FieldLabel>
                  <Input id="p-ref" name="reference" placeholder="N° de virement, transaction…" />
                  <FieldDescription>Obligatoire sauf espèces.</FieldDescription>
                </Field>
              </div>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={enCours}>
                Enregistrer et imprimer le reçu
              </Button>
            </DialogFooter>
          </form>
        )}

        {f && dialogue?.type === "avoir" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              run(() => emettreAvoir(f.id, dossierId, Number(fd.get("montant")), String(fd.get("motif") ?? "")), onClose)
            }}
          >
            <DialogHeader>
              <DialogTitle>Avoir sur {f.numero}</DialogTitle>
              <DialogDescription>
                Annule ou corrige tout ou partie de la facture (solde dû : {formatMontant(f.solde_du, f.devise)}). Numéro AV attribué
                immédiatement.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="a-montant">Montant TTC ({f.devise})</FieldLabel>
                <Input id="a-montant" name="montant" type="number" step="0.01" min={0.01} max={f.solde_du} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="a-motif">Motif</FieldLabel>
                <Textarea id="a-motif" name="motif" required />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={enCours}>
                Émettre l&apos;avoir
              </Button>
            </DialogFooter>
          </form>
        )}

        {f && dialogue?.type === "normaliser" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              run(
                () =>
                  normaliserFacture(f.id, dossierId, {
                    numero: String(fd.get("numero") ?? ""),
                    code: String(fd.get("code") ?? ""),
                    qr: String(fd.get("qr") ?? ""),
                  }),
                onClose
              )
            }}
          >
            <DialogHeader>
              <DialogTitle>Normalisation DGI — {f.numero}</DialogTitle>
              <DialogDescription>Saisissez les informations obtenues après émission sur e-DEF.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="n-num">Numéro de facture normalisée</FieldLabel>
                <Input id="n-num" name="numero" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="n-code">Code d&apos;authentification DEF</FieldLabel>
                <Input id="n-code" name="code" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="n-qr">Contenu du QR code (texte)</FieldLabel>
                <Textarea id="n-qr" name="qr" rows={3} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={enCours}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
