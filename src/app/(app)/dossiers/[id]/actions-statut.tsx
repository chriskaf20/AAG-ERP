"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { DossierStatut } from "@/lib/permissions"
import { changerStatut } from "../actions"

export function ActionsStatut({
  dossierId,
  transitions,
}: {
  dossierId: string
  transitions: DossierStatut[]
}) {
  const t = useTranslations("statuts")
  const [enCours, setEnCours] = React.useState(false)
  const [motifPour, setMotifPour] = React.useState<DossierStatut | null>(null)
  const [motif, setMotif] = React.useState("")

  async function appliquer(statut: DossierStatut, m?: string) {
    setEnCours(true)
    const r = await changerStatut(dossierId, statut, m)
    setEnCours(false)
    if (r?.ok) toast.success(`Dossier passé en « ${t(statut)} »`)
    else toast.error(r?.message ?? "Changement refusé")
  }

  if (transitions.length === 0) return null

  return (
    <>
      {transitions.map((s) =>
        s === "classe_sans_suite" ? (
          <Button
            key={s}
            size="sm"
            variant="outline"
            disabled={enCours}
            onClick={() => {
              setMotif("")
              setMotifPour(s)
            }}
          >
            Classer sans suite
          </Button>
        ) : (
          <Button key={s} size="sm" disabled={enCours} onClick={() => appliquer(s)}>
            {s === "en_verification" ? "Lancer la vérification" : t(s)}
          </Button>
        )
      )}
      <Dialog open={motifPour !== null} onOpenChange={(o) => !o && setMotifPour(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!motifPour || !motif.trim()) return
              void appliquer(motifPour, motif.trim())
              setMotifPour(null)
            }}
          >
            <DialogHeader>
              <DialogTitle>Classer sans suite</DialogTitle>
              <DialogDescription>Le motif est obligatoire et sera tracé dans l&apos;historique.</DialogDescription>
            </DialogHeader>
            <Field className="py-4">
              <FieldLabel htmlFor="motif-statut">Motif</FieldLabel>
              <Textarea id="motif-statut" value={motif} onChange={(e) => setMotif(e.target.value)} required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMotifPour(null)}>
                Annuler
              </Button>
              <Button type="submit" variant="destructive" disabled={!motif.trim()}>
                Confirmer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
