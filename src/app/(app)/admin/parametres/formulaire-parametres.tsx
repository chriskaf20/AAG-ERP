"use client"

import * as React from "react"
import { toast } from "sonner"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useFormAction } from "@/hooks/use-form-action"
import type { Tables } from "@/lib/database.types"
import { enregistrerParametres } from "../actions"

export function FormulaireParametres({
  org,
  parametres,
}: {
  org: Tables<"organizations">
  parametres: { seuil_validation_usd: number; acompte_pct: number; garantie_jours: number }
}) {
  const [etat, onSubmit, enCours] = useFormAction(enregistrerParametres)
  const err = etat?.erreurs ?? {}

  React.useEffect(() => {
    if (etat?.ok) toast.success(etat.message)
    else if (etat?.message) toast.error(etat.message)
  }, [etat])

  const champ = (nom: string, libelle: string, defaut: string | number | null, props: React.ComponentProps<typeof Input> = {}) => (
    <Field data-invalid={!!err[nom]}>
      <FieldLabel htmlFor={`o-${nom}`}>{libelle}</FieldLabel>
      <Input id={`o-${nom}`} name={nom} defaultValue={defaut ?? ""} aria-invalid={!!err[nom]} {...props} />
      <FieldError>{err[nom]?.[0]}</FieldError>
    </Field>
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Entreprise</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Logo taille={28} /> Logo : public/logo.png
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {champ("nom", "Raison sociale", org.nom)}
            {champ("sigle", "Sigle", org.sigle)}
            {champ("rccm", "RCCM", org.rccm)}
            {champ("nif", "NIF", org.nif)}
            {champ("id_nat", "Id. Nat.", org.id_nat)}
            {champ("telephone", "Téléphone", org.telephone, { type: "tel" })}
            {champ("email", "Email", org.email, { type: "email" })}
            {champ("adresse", "Adresse", org.adresse)}
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Règles de gestion</CardTitle>
          <CardDescription>Utilisées par les contrôles en base (devis, acompte, garantie).</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="o-devise">Devise par défaut</FieldLabel>
              <NativeSelect id="o-devise" name="devise" defaultValue={org.devise} className="w-full">
                <NativeSelectOption value="USD">USD</NativeSelectOption>
                <NativeSelectOption value="CDF">CDF</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field data-invalid={!!err.prefixe_dossier}>
              <FieldLabel htmlFor="o-prefixe_dossier">Préfixe des dossiers</FieldLabel>
              <Input id="o-prefixe_dossier" name="prefixe_dossier" defaultValue={org.prefixe_dossier} maxLength={6} />
              <FieldDescription>Ex. AAG → AAG-2026-001</FieldDescription>
              <FieldError>{err.prefixe_dossier?.[0]}</FieldError>
            </Field>
            {champ("seuil_validation_usd", "Seuil de validation du gérant (USD)", parametres.seuil_validation_usd, {
              type: "number",
              min: 0,
              step: "0.01",
              inputMode: "decimal",
            })}
            {champ("acompte_pct", "Acompte (%)", parametres.acompte_pct, { type: "number", min: 0, max: 100 })}
            {champ("garantie_jours", "Garantie (jours)", parametres.garantie_jours, { type: "number", min: 0 })}
          </FieldGroup>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  )
}
