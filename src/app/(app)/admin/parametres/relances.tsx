"use client"

import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { useAction } from "@/hooks/use-action"
import { enregistrerRelances } from "../actions"

export function ParametresRelances({
  actives: activesInitial,
  mode: modeInitial,
  gerant,
}: {
  actives: boolean
  mode: "simulation" | "reel"
  gerant: boolean
}) {
  const { enCours, run } = useAction()
  const [actives, setActives] = React.useState(activesInitial)
  const [mode, setMode] = React.useState(modeInitial)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relances automatiques</CardTitle>
        <CardDescription>
          Devis non signés à J+7, factures impayées à J+7, J+15 et J+30 après échéance (chaque jour à 07:00).
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
            <Switch id="relances-actives" checked={actives} onCheckedChange={setActives} disabled={!gerant} />
            <FieldLabel htmlFor="relances-actives">Relances activées</FieldLabel>
          </Field>
          <Field>
            <FieldLabel htmlFor="relances-mode">Mode</FieldLabel>
            <NativeSelect
              id="relances-mode"
              className="w-full sm:w-72"
              value={mode}
              onChange={(e) => setMode(e.target.value as "simulation" | "reel")}
              disabled={!gerant}
            >
              <NativeSelectOption value="simulation">Simulation (tracées, aucun email envoyé)</NativeSelectOption>
              <NativeSelectOption value="reel">Réel (emails envoyés aux clients)</NativeSelectOption>
            </NativeSelect>
            <FieldDescription>Les adresses se terminant par .test ne sont jamais relancées.</FieldDescription>
          </Field>
          {gerant && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                disabled={enCours || (actives === activesInitial && mode === modeInitial)}
                onClick={() => run(() => enregistrerRelances(actives, mode))}
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
