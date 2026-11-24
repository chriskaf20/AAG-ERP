"use client"

import * as React from "react"
import { toast } from "sonner"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { affecter, retirerAffectation } from "../actions"

export function Affectations({
  dossierId,
  affectations,
  candidats,
  peutModifier,
}: {
  dossierId: string
  affectations: { id: string; user_id: string; nom: string }[]
  candidats: { id: string; nom: string }[]
  peutModifier: boolean
}) {
  const [choix, setChoix] = React.useState("")
  const disponibles = candidats.filter((c) => !affectations.some((a) => a.user_id === c.id))

  const notifier = (r: { ok?: boolean; message?: string } | null) =>
    r?.ok ? toast.success(r.message) : toast.error(r?.message ?? "Erreur")

  return (
    <div className="flex flex-col gap-2">
      {affectations.length === 0 && <p className="text-sm text-muted-foreground">Aucune affectation.</p>}
      <ul className="flex flex-wrap gap-2">
        {affectations.map((a) => (
          <li key={a.id} className="flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm">
            {a.nom}
            {peutModifier && (
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-background"
                onClick={async () => notifier(await retirerAffectation(dossierId, a.id))}
                aria-label={`Retirer ${a.nom}`}
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {peutModifier && disponibles.length > 0 && (
        <div className="flex gap-2">
          <NativeSelect
            aria-label="Personne à affecter"
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
            className="w-full sm:w-64"
          >
            <NativeSelectOption value="">— Affecter un agent —</NativeSelectOption>
            {disponibles.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.nom}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            variant="outline"
            disabled={!choix}
            onClick={async () => {
              notifier(await affecter(dossierId, choix))
              setChoix("")
            }}
          >
            Affecter
          </Button>
        </div>
      )}
    </div>
  )
}
