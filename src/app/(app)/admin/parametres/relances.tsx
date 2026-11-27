"use client"

import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { useAction } from "@/hooks/use-action"
import { enregistrerEmails } from "../actions"

export function ParametresEmails({
  type,
  actives: activesInitial,
  mode: modeInitial,
  gerant,
}: {
  type: "relances" | "points"
  actives: boolean
  mode: "simulation" | "reel"
  gerant: boolean
}) {
  const { enCours, run } = useAction()
  const [actives, setActives] = React.useState(activesInitial)
  const [mode, setMode] = React.useState(modeInitial)

  const points = type === "points"
  return (
    <Card>
      <CardHeader>
        <CardTitle>{points ? "Points d’avancement par email" : "Relances automatiques"}</CardTitle>
        <CardDescription>
          {points ? "Envoi au client après consignation d’un point depuis le dossier."
            : "Devis non signés à J+7, factures impayées à J+7, J+15 et J+30 après échéance (chaque jour à 07:00)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {!gerant && (
            <Alert>
              <AlertDescription>Seul le gérant peut modifier ce réglage.</AlertDescription>
            </Alert>
          )}
          <Field orientation="horizontal">
            <Switch id={`${type}-actives`} checked={actives} onCheckedChange={setActives} disabled={!gerant} />
            <FieldLabel htmlFor={`${type}-actives`}>{points ? "Envoi des points activé" : "Relances activées"}</FieldLabel>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${type}-mode`}>Mode</FieldLabel>
            <NativeSelect
              id={`${type}-mode`}
              className="w-full sm:w-72"
              value={mode}
              onChange={(e) => setMode(e.target.value as "simulation" | "reel")}
              disabled={!gerant}
            >
              <NativeSelectOption value="simulation">Simulation (envois consignés)</NativeSelectOption>
              <NativeSelectOption value="reel">Réel (emails envoyés aux clients)</NativeSelectOption>
            </NativeSelect>
            <FieldDescription>Les adresses se terminant par .test sont ignorées.</FieldDescription>
          </Field>
          {gerant && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                disabled={enCours || (actives === activesInitial && mode === modeInitial)}
                onClick={() => run(() => enregistrerEmails(type, actives, mode))}
              >
                Enregistrer
              </Button>
            </div>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
