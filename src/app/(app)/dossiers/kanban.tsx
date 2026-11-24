"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { GripVerticalIcon } from "lucide-react"

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
import { formatMontant } from "@/lib/format"
import { STATUTS, STATUTS_PHASE_1, type DossierStatut } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { changerStatut } from "./actions"
import type { DossierLigne } from "./dossiers-view"

const MOTIF_OBLIGATOIRE: DossierStatut[] = ["classe_sans_suite"]

export function Kanban({ dossiers }: { dossiers: DossierLigne[] }) {
  const t = useTranslations("statuts")
  const router = useRouter()
  const [local, setLocal] = React.useState(dossiers)
  const [motif, setMotif] = React.useState<{ id: string; statut: DossierStatut } | null>(null)
  const [texteMotif, setTexteMotif] = React.useState("")

  const [source, setSource] = React.useState(dossiers)
  if (source !== dossiers) {
    setSource(dossiers)
    setLocal(dossiers)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const colonnesAffichees = STATUTS.filter(
    (s) => STATUTS_PHASE_1.includes(s) || local.some((d) => d.statut === s)
  )

  async function deplacer(id: string, statut: DossierStatut, m?: string) {
    const avant = local
    setLocal((l) => l.map((d) => (d.id === id ? { ...d, statut } : d)))
    const r = await changerStatut(id, statut, m)
    if (r?.ok) {
      toast.success(`Dossier passé en « ${t(statut)} »`)
      router.refresh()
    } else {
      setLocal(avant)
      toast.error(r?.message ?? "Changement refusé")
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id)
    const cible = e.over?.id as DossierStatut | undefined
    const d = local.find((x) => x.id === id)
    if (!d || !cible || d.statut === cible) return
    if (MOTIF_OBLIGATOIRE.includes(cible)) {
      setTexteMotif("")
      setMotif({ id, statut: cible })
      return
    }
    void deplacer(id, cible)
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Glissez une carte pour changer le statut (ou utilisez Espace puis les flèches). Les
        décisions Accepté / Complément / Refusé se prennent par la validation de la fiche F-02.
      </p>
      <DndContext
        sensors={sensors}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Pour déplacer un dossier, appuyez sur Espace, utilisez les flèches puis Espace pour déposer, ou Échap pour annuler.",
          },
        }}
      >
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
          {colonnesAffichees.map((s) => (
            <Colonne
              key={s}
              statut={s}
              titre={t(s)}
              dossiers={local.filter((d) => d.statut === s)}
            />
          ))}
        </div>
      </DndContext>

      <Dialog open={motif !== null} onOpenChange={(o) => !o && setMotif(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!motif || !texteMotif.trim()) return
              void deplacer(motif.id, motif.statut, texteMotif.trim())
              setMotif(null)
            }}
          >
            <DialogHeader>
              <DialogTitle>{motif && t(motif.statut)}</DialogTitle>
              <DialogDescription>Le motif est obligatoire et sera tracé dans l&apos;historique.</DialogDescription>
            </DialogHeader>
            <Field className="py-4">
              <FieldLabel htmlFor="motif-kanban">Motif</FieldLabel>
              <Textarea
                id="motif-kanban"
                value={texteMotif}
                onChange={(e) => setTexteMotif(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMotif(null)}>
                Annuler
              </Button>
              <Button type="submit" disabled={!texteMotif.trim()}>
                Confirmer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Colonne({
  statut,
  titre,
  dossiers,
}: {
  statut: DossierStatut
  titre: string
  dossiers: DossierLigne[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statut })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${titre} : ${dossiers.length} dossier(s)`}
      className={cn(
        "flex w-72 shrink-0 snap-start flex-col gap-2 rounded-xl border bg-muted/50 p-2 transition-colors",
        isOver && "border-accent bg-accent/10"
      )}
    >
      <header className="flex items-center justify-between px-1 py-1">
        <h2 className="text-sm font-semibold">{titre}</h2>
        <span className="rounded-full bg-background px-2 text-xs font-medium tabular-nums">
          {dossiers.length}
        </span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {dossiers.map((d) => (
          <Carte key={d.id} dossier={d} />
        ))}
      </div>
    </section>
  )
}

function Carte({ dossier }: { dossier: DossierLigne }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dossier.id,
  })
  return (
    <article
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "flex gap-1 rounded-lg border bg-card p-2 text-sm shadow-xs",
        isDragging && "z-10 opacity-80 shadow-md ring-2 ring-accent"
      )}
    >
      <button
        type="button"
        className="mt-0.5 h-fit cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
        aria-label={`Déplacer le dossier ${dossier.numero}`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <Link href={`/dossiers/${dossier.id}`} className="font-semibold text-primary hover:underline dark:text-foreground">
          {dossier.numero}
        </Link>
        <p className="truncate">{dossier.client}</p>
        <p className="truncate text-xs text-muted-foreground">{dossier.service}</p>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{dossier.departement}</span>
          <span className="tabular-nums">{formatMontant(dossier.budget_indicatif, dossier.budget_devise)}</span>
        </div>
      </div>
    </article>
  )
}
