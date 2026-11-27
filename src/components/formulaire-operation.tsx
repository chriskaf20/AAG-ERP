"use client"

import { useAction } from "@/hooks/use-action"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"

type Resultat = { ok?: boolean; message?: string } | null

export function FormulaireOperation({ enregistrer, bouton, children, disabled = false, reinitialiser = true }: {
  enregistrer: (fd: FormData) => Promise<Resultat>
  bouton: string
  children?: React.ReactNode
  disabled?: boolean
  reinitialiser?: boolean
}) {
  const { enCours, run } = useAction()
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      run(() => enregistrer(fd), () => { if (reinitialiser) form.reset() })
    }}>
      {children}
      <Button type="submit" size="sm" variant="outline" className="self-start" disabled={disabled || enCours}>{bouton}</Button>
    </form>
  )
}

export function Champ({ nom, children }: { nom: string; children: React.ReactNode }) {
  return <Field><FieldLabel className="w-full flex-col items-start">{nom}{children}</FieldLabel></Field>
}
