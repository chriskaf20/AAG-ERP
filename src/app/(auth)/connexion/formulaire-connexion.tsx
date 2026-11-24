"use client"

import { useActionState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { seConnecter } from "./actions"

export function FormulaireConnexion({ suivant }: { suivant?: string }) {
  const [etat, action, enCours] = useActionState(seConnecter, null)
  return (
    <form action={action} noValidate>
      <input type="hidden" name="suivant" value={suivant ?? ""} />
      <FieldGroup>
        {etat?.message && (
          <Alert variant="destructive">
            <AlertDescription>{etat.message}</AlertDescription>
          </Alert>
        )}
        <Field data-invalid={!!etat?.erreurs?.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={!!etat?.erreurs?.email}
          />
          <FieldError>{etat?.erreurs?.email?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!etat?.erreurs?.password}>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={!!etat?.erreurs?.password}
          />
          <FieldError>{etat?.erreurs?.password?.[0]}</FieldError>
        </Field>
        <Button type="submit" size="lg" disabled={enCours} className="w-full">
          {enCours ? "Connexion…" : "Se connecter"}
        </Button>
      </FieldGroup>
    </form>
  )
}
