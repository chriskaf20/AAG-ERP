"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { PencilIcon, PlusIcon } from "lucide-react"

import { colonnes, DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import { formatMontant } from "@/lib/format"
import { enregistrerService } from "./actions"

type Service = {
  id: string
  nom: string
  description: string | null
  unite: "forfait" | "jour" | "mois" | "m2" | "course"
  prix_base_usd: number
  actif: boolean
  department_id: string | null
  departement: string
}

const col = colonnes<Service>()
const UNITES = ["forfait", "jour", "mois", "m2", "course"] as const

export function CatalogueServices({
  services,
  departements,
  modifiable,
}: {
  services: Service[]
  departements: { id: string; code: string; nom: string }[]
  modifiable: boolean
}) {
  const t = useTranslations("unites")
  const { enCours, run } = useAction()
  const [edition, setEdition] = React.useState<Service | "nouveau" | null>(null)

  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("nom", {
          header: "Service",
          cell: ({ row }) => (
            <div>
              <p className="font-medium">{row.original.nom}</p>
              {row.original.description && <p className="text-xs text-muted-foreground">{row.original.description}</p>}
            </div>
          ),
        }),
        col.accessor("departement", { header: "Dépt." }),
        col.accessor("unite", { header: "Unité", cell: ({ getValue }) => t(getValue()) }),
        col.accessor("prix_base_usd", {
          header: "Prix de base",
          cell: ({ getValue }) => <span className="tabular-nums">{formatMontant(getValue(), "USD")}</span>,
        }),
        col.accessor("actif", {
          header: "État",
          cell: ({ getValue }) => (getValue() ? <Badge variant="outline">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>),
        }),
        ...(modifiable
          ? [
              col.display({
                id: "actions",
                header: () => <span className="sr-only">Actions</span>,
                cell: ({ row }) => (
                  <Button variant="ghost" size="icon-sm" onClick={() => setEdition(row.original)}>
                    <PencilIcon />
                    <span className="sr-only">Modifier {row.original.nom}</span>
                  </Button>
                ),
              }),
            ]
          : []),
      ]),
    [modifiable, t]
  )

  const s = edition === "nouveau" ? null : edition

  return (
    <div className="flex flex-col gap-3">
      {modifiable && (
        <div>
          <Button onClick={() => setEdition("nouveau")}>
            <PlusIcon /> Nouveau service
          </Button>
        </div>
      )}
      <DataTable data={services} columns={columns} getRowId={(x) => x.id} vide="Aucun service." />
      <Dialog open={edition !== null} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent>
          {edition !== null && (
            <form
              key={s?.id ?? "nouveau"}
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                run(
                  () =>
                    enregistrerService(s?.id ?? null, {
                      nom: String(fd.get("nom") ?? ""),
                      description: String(fd.get("description") ?? "").trim() || null,
                      department_id: (fd.get("department_id") as string) || null,
                      unite: fd.get("unite") as Service["unite"],
                      prix_base_usd: Number(fd.get("prix_base_usd")),
                      actif: fd.get("actif") === "on",
                    }),
                  () => setEdition(null)
                )
              }}
            >
              <DialogHeader>
                <DialogTitle>{s ? "Modifier le service" : "Nouveau service"}</DialogTitle>
              </DialogHeader>
              <FieldGroup className="py-4">
                <Field>
                  <FieldLabel htmlFor="s-nom">Nom</FieldLabel>
                  <Input id="s-nom" name="nom" defaultValue={s?.nom} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="s-desc">Description</FieldLabel>
                  <Textarea id="s-desc" name="description" defaultValue={s?.description ?? ""} rows={2} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="s-dept">Département</FieldLabel>
                    <NativeSelect id="s-dept" name="department_id" className="w-full" defaultValue={s?.department_id ?? ""}>
                      <NativeSelectOption value="">—</NativeSelectOption>
                      {departements.map((d) => (
                        <NativeSelectOption key={d.id} value={d.id}>
                          {d.code}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="s-unite">Unité</FieldLabel>
                    <NativeSelect id="s-unite" name="unite" className="w-full" defaultValue={s?.unite ?? "forfait"}>
                      {UNITES.map((u) => (
                        <NativeSelectOption key={u} value={u}>
                          {t(u)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="s-prix">Prix USD</FieldLabel>
                    <Input id="s-prix" name="prix_base_usd" type="number" min={0} step="0.01" defaultValue={s?.prix_base_usd ?? 0} />
                  </Field>
                </div>
                <Field orientation="horizontal">
                  <Checkbox id="s-actif" name="actif" defaultChecked={s?.actif ?? true} />
                  <FieldLabel htmlFor="s-actif">Actif</FieldLabel>
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button type="submit" disabled={enCours}>
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
