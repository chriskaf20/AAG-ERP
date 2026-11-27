"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { accepterInvitation, definirMotDePasse } from "./actions"

export function FormulaireInvitation({ jeton }: { jeton?: string }) {
  const [etat, action, enCours] = useActionState(jeton ? accepterInvitation : definirMotDePasse, null)
  return <form action={action} className="grid gap-3">
    {jeton ? <input type="hidden" name="token_hash" value={jeton} /> : <>
      <Field><FieldLabel htmlFor="password">Mot de passe</FieldLabel>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={72} required />
      </Field>
      <Field><FieldLabel htmlFor="confirmation">Confirmer le mot de passe</FieldLabel>
        <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required />
      </Field>
    </>}
    {etat?.message && <p role="alert" className="text-sm text-destructive">{etat.message}</p>}
    <Button type="submit" disabled={enCours}>{jeton ? "Accepter l’invitation" : "Définir mon mot de passe"}</Button>
  </form>
}
