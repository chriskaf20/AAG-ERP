"use client"

import * as React from "react"
import { useFormAction } from "@/hooks/use-form-action"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { EtatAction } from "@/lib/actions"
import type { Tables } from "@/lib/database.types"

type Valeurs = Partial<Tables<"clients">>

export function ClientForm({
  action,
  valeurs,
  libelleBouton = "Enregistrer",
  lectureSeule = false,
}: {
  action: (etat: EtatAction, fd: FormData) => Promise<EtatAction>
  valeurs?: Valeurs
  libelleBouton?: string
  lectureSeule?: boolean
}) {
  const [etat, formAction, enCours] = useFormAction(action)
  const [type, setType] = React.useState(valeurs?.type ?? "entreprise")
  const err = etat?.erreurs ?? {}

  React.useEffect(() => {
    if (etat?.ok && etat.message) toast.success(etat.message)
  }, [etat])

  const champ = (
    nom: keyof Valeurs,
    libelle: string,
    props: React.ComponentProps<typeof Input> = {}
  ) => (
    <Field data-invalid={!!err[nom]}>
      <FieldLabel htmlFor={`c-${nom}`}>{libelle}</FieldLabel>
      <Input
        id={`c-${nom}`}
        name={nom}
        defaultValue={(valeurs?.[nom] as string | null) ?? ""}
        aria-invalid={!!err[nom]}
        disabled={lectureSeule}
        {...props}
      />
      <FieldError>{err[nom]?.[0]}</FieldError>
    </Field>
  )

  return (
    <form onSubmit={formAction} noValidate>
      <FieldGroup>
        {etat?.message && !etat.ok && (
          <Alert variant="destructive">
            <AlertDescription>{etat.message}</AlertDescription>
          </Alert>
        )}
        <FieldSet>
          <FieldLegend>Identification</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="c-type">Type</FieldLabel>
              <NativeSelect
                id="c-type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                disabled={lectureSeule}
                className="w-full"
              >
                <NativeSelectOption value="entreprise">Entreprise</NativeSelectOption>
                <NativeSelectOption value="particulier">Particulier</NativeSelectOption>
              </NativeSelect>
            </Field>
            {champ("raison_sociale", type === "entreprise" ? "Raison sociale" : "Nom complet", {
              required: true,
            })}
          </div>
          {type === "entreprise" && (
            <div className="grid gap-4 sm:grid-cols-3">
              {champ("rccm", "RCCM")}
              {champ("nif", "NIF")}
              {champ("id_nat", "Id. Nat.")}
            </div>
          )}
        </FieldSet>
        <FieldSet>
          <FieldLegend>Coordonnées</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            {champ("adresse", "Adresse")}
            {champ("ville", "Ville")}
            {champ("telephone", "Téléphone", { type: "tel", inputMode: "tel" })}
            {champ("email", "Email", { type: "email", inputMode: "email" })}
          </div>
          <Field>
            <FieldLabel htmlFor="c-notes">Notes</FieldLabel>
            <Textarea id="c-notes" name="notes" defaultValue={valeurs?.notes ?? ""} disabled={lectureSeule} />
          </Field>
        </FieldSet>
        {!lectureSeule && (
          <div className="flex justify-end">
            <Button type="submit" disabled={enCours}>
              {enCours ? "Enregistrement…" : libelleBouton}
            </Button>
          </div>
        )}
      </FieldGroup>
    </form>
  )
}
