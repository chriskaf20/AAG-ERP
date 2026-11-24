"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useFormAction } from "@/hooks/use-form-action"
import { modifierMonProfil } from "./actions"

export function FormulaireProfil({ valeurs }: { valeurs: { nom_complet: string; fonction: string; telephone: string } }) {
  const [etat, onSubmit, enCours] = useFormAction(modifierMonProfil)
  React.useEffect(() => {
    if (etat?.ok) toast.success(etat.message)
    else if (etat?.message) toast.error(etat.message)
  }, [etat])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!etat?.erreurs?.nom_complet}>
              <FieldLabel htmlFor="pr-nom">Nom complet</FieldLabel>
              <Input id="pr-nom" name="nom_complet" defaultValue={valeurs.nom_complet} autoComplete="name" />
              <FieldError>{etat?.erreurs?.nom_complet?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="pr-fonction">Fonction</FieldLabel>
              <Input id="pr-fonction" name="fonction" defaultValue={valeurs.fonction} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pr-tel">Téléphone</FieldLabel>
              <Input id="pr-tel" name="telephone" type="tel" defaultValue={valeurs.telephone} autoComplete="tel" />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={enCours}>
                Enregistrer
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
