"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { CheckCircle2Icon, LockIcon, XCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useFormAction } from "@/hooks/use-form-action"
import type { Tables } from "@/lib/database.types"
import { formatDateHeure } from "@/lib/format"
import { POINTS_VERIFICATION } from "@/lib/permissions"
import { enregistrerVerification, validerVerification } from "../actions"

type Verification = Tables<"verifications"> & {
  verificateur?: string | null
  validateur?: string | null
}

const DECISIONS = ["accepte", "complement_requis", "refuse"] as const

export function VerificationF02({
  dossierId,
  statutDossier,
  brouillon,
  validees,
  peutRemplir,
  peutValider,
}: {
  dossierId: string
  statutDossier: string
  brouillon: Verification | null
  validees: Verification[]
  peutRemplir: boolean
  peutValider: boolean
}) {
  const enVerification = statutDossier === "en_verification"

  return (
    <div className="flex flex-col gap-4">
      {!enVerification && !brouillon && validees.length === 0 && (
        <Alert>
          <AlertDescription>
            La fiche F-02 se remplit lorsque le dossier est « en vérification ».
          </AlertDescription>
        </Alert>
      )}
      {enVerification && (peutRemplir || brouillon) && (
        <FormulaireF02
          key={brouillon?.id ?? "nouveau"}
          dossierId={dossierId}
          brouillon={brouillon}
          lectureSeule={!peutRemplir}
          peutValider={peutValider}
        />
      )}
      {validees.map((v) => (
        <F02Validee key={v.id} v={v} />
      ))}
    </div>
  )
}

function FormulaireF02({
  dossierId,
  brouillon,
  lectureSeule,
  peutValider,
}: {
  dossierId: string
  brouillon: Verification | null
  lectureSeule: boolean
  peutValider: boolean
}) {
  const t = useTranslations("verification")
  const [etat, onSubmit, enCours] = useFormAction(
    enregistrerVerification.bind(null, dossierId, brouillon?.id ?? null)
  )
  const [decision, setDecision] = React.useState<string>(brouillon?.decision ?? "")
  const [validation, setValidation] = React.useState(false)
  const err = etat?.erreurs ?? {}

  React.useEffect(() => {
    if (etat?.ok) toast.success(etat.message)
    else if (etat?.message) toast.error(etat.message)
  }, [etat])

  const valeurPoint = (p: (typeof POINTS_VERIFICATION)[number]) => {
    const v = brouillon?.[p]
    return v === true ? "conforme" : v === false ? "non_conforme" : ""
  }

  async function valider() {
    if (!brouillon) return
    if (!window.confirm("Valider et signer la fiche F-02 ? La décision sera appliquée au dossier et la fiche ne sera plus modifiable.")) return
    setValidation(true)
    const r = await validerVerification(dossierId, brouillon.id)
    setValidation(false)
    if (r?.ok) toast.success(r.message)
    else toast.error(r?.message ?? "Validation refusée")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiche de vérification F-02</CardTitle>
        <CardDescription>
          {brouillon?.verifie_le
            ? `Décision proposée par ${brouillon.verificateur ?? "—"} le ${formatDateHeure(brouillon.verifie_le)} — en attente de validation du gérant`
            : "Évaluez les 8 points puis proposez une décision."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {POINTS_VERIFICATION.map((p, i) => (
              <FieldSet key={p} className="rounded-lg border p-3">
                <FieldLegend variant="label">
                  {i + 1}. {t(p)}
                </FieldLegend>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div role="radiogroup" aria-label={t(p)} className="flex shrink-0 gap-2">
                    {(["conforme", "non_conforme"] as const).map((v) => (
                      <label
                        key={v}
                        className={
                          "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 " +
                          (v === "conforme"
                            ? "has-checked:border-success has-checked:bg-success/10 has-checked:text-success"
                            : "has-checked:border-destructive has-checked:bg-destructive/10 has-checked:text-destructive")
                        }
                      >
                        <input
                          type="radio"
                          name={p}
                          value={v}
                          defaultChecked={valeurPoint(p) === v}
                          disabled={lectureSeule}
                          className="sr-only"
                        />
                        {v === "conforme" ? (
                          <CheckCircle2Icon className="size-4" aria-hidden />
                        ) : (
                          <XCircleIcon className="size-4" aria-hidden />
                        )}
                        {v === "conforme" ? t("conforme") : t("nonConforme")}
                      </label>
                    ))}
                  </div>
                  <Input
                    name={`${p}_obs`}
                    placeholder="Observation"
                    aria-label={`Observation — ${t(p)}`}
                    defaultValue={brouillon?.[`${p}_obs`] ?? ""}
                    disabled={lectureSeule}
                  />
                </div>
              </FieldSet>
            ))}

            <Field>
              <FieldLabel htmlFor="observations">Observations générales</FieldLabel>
              <Textarea
                id="observations"
                name="observations"
                defaultValue={brouillon?.observations ?? ""}
                disabled={lectureSeule}
              />
            </Field>

            <FieldSet>
              <FieldLegend variant="label">Décision proposée</FieldLegend>
              <div role="radiogroup" aria-label="Décision" className="flex flex-wrap gap-2">
                {DECISIONS.map((d) => (
                  <label
                    key={d}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={d}
                      checked={decision === d}
                      onChange={() => setDecision(d)}
                      disabled={lectureSeule}
                      className="sr-only"
                    />
                    {t(`decisions.${d}`)}
                  </label>
                ))}
              </div>
            </FieldSet>

            {decision === "complement_requis" && (
              <Field data-invalid={!!err.pieces_demandees}>
                <FieldLabel htmlFor="pieces_demandees">Pièces demandées</FieldLabel>
                <Textarea
                  id="pieces_demandees"
                  name="pieces_demandees"
                  defaultValue={brouillon?.pieces_demandees ?? ""}
                  disabled={lectureSeule}
                />
                <FieldError>{err.pieces_demandees?.[0]}</FieldError>
              </Field>
            )}
            {decision === "refuse" && (
              <Field data-invalid={!!err.motif}>
                <FieldLabel htmlFor="motif">Motif du refus</FieldLabel>
                <Textarea id="motif" name="motif" defaultValue={brouillon?.motif ?? ""} disabled={lectureSeule} />
                <FieldError>{err.motif?.[0]}</FieldError>
              </Field>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {!lectureSeule && (
                <Button type="submit" variant="outline" disabled={enCours}>
                  {enCours ? "Enregistrement…" : "Enregistrer la fiche"}
                </Button>
              )}
              {peutValider && brouillon?.decision && (
                <Button type="button" onClick={valider} disabled={validation || enCours}>
                  <LockIcon />
                  {validation ? "Validation…" : "Valider et signer (gérant)"}
                </Button>
              )}
            </div>
            {peutValider && brouillon && !brouillon.decision && (
              <p className="text-right text-xs text-muted-foreground">
                Enregistrez une décision pour pouvoir valider.
              </p>
            )}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function F02Validee({ v }: { v: Verification }) {
  const t = useTranslations("verification")
  return (
    <Card className="border-accent/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockIcon className="size-4 text-accent" aria-hidden />
          F-02 validée — {v.decision ? t(`decisions.${v.decision}`) : "—"}
        </CardTitle>
        <CardDescription>
          Vérifiée par {v.verificateur ?? "—"} ({formatDateHeure(v.verifie_le)}) · validée par{" "}
          {v.validateur ?? "—"} ({formatDateHeure(v.valide_le)})
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {POINTS_VERIFICATION.map((p) => (
            <li key={p} className="flex items-start gap-2">
              {v[p] ? (
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" aria-label={t("conforme")} />
              ) : (
                <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-label={t("nonConforme")} />
              )}
              <span>
                {t(p)}
                {v[`${p}_obs`] && <span className="block text-muted-foreground">{v[`${p}_obs`]}</span>}
              </span>
            </li>
          ))}
        </ul>
        {v.observations && <p><span className="font-medium">Observations : </span>{v.observations}</p>}
        {v.pieces_demandees && (
          <Alert>
            <AlertTitle>Pièces demandées</AlertTitle>
            <AlertDescription>{v.pieces_demandees}</AlertDescription>
          </Alert>
        )}
        {v.motif && (
          <Alert variant="destructive">
            <AlertTitle>Motif du refus</AlertTitle>
            <AlertDescription>{v.motif}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
