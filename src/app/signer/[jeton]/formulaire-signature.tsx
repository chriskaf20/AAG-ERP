"use client"

import * as React from "react"
import { CheckCircle2Icon } from "lucide-react"

import { SignaturePad } from "@/components/signature-pad"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signer, type EtatSignature } from "./actions"

export function FormulaireSignature({ jeton, accord }: { jeton: string; accord: string }) {
  const [nom, setNom] = React.useState("")
  const [image, setImage] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState(false)
  const [etat, setEtat] = React.useState<EtatSignature>(null)
  const [enCours, startTransition] = React.useTransition()

  if (etat?.ok) {
    return (
      <Alert>
        <CheckCircle2Icon />
        <AlertDescription>{etat.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signature</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            startTransition(async () => {
              setEtat(await signer({ jeton, nom, image: image ?? "", accord: ok as true }))
            })
          }}
        >
          <FieldGroup>
            {etat?.message && (
              <Alert variant="destructive">
                <AlertDescription>{etat.message}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="nom-signataire">Nom complet du signataire</FieldLabel>
              <Input
                id="nom-signataire"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                autoComplete="name"
                required
              />
            </Field>
            <SignaturePad onChange={setImage} />
            <Field orientation="horizontal">
              <Checkbox id="accord" checked={ok} onCheckedChange={(v) => setOk(Boolean(v))} />
              <FieldLabel htmlFor="accord" className="font-normal">
                {accord}
              </FieldLabel>
            </Field>
            <p className="text-xs text-muted-foreground">
              Votre nom, la date et l&apos;heure ainsi que votre adresse IP seront enregistrés avec la signature.
            </p>
            <Button type="submit" size="lg" disabled={enCours || !ok || !image || nom.trim().length < 2}>
              {enCours ? "Signature…" : "Signer"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
