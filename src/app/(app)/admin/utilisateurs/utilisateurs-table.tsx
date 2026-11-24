"use client"

import * as React from "react"
import { toast } from "sonner"
import { PencilIcon, SearchIcon } from "lucide-react"

import { colonnes, DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useFormAction } from "@/hooks/use-form-action"
import { modifierProfil } from "../actions"

type Utilisateur = {
  id: string
  nom: string
  email: string
  fonction: string | null
  telephone: string | null
  roles: string[]
}

const col = colonnes<Utilisateur>()

export function UtilisateursTable({ utilisateurs }: { utilisateurs: Utilisateur[] }) {
  const [recherche, setRecherche] = React.useState("")
  const [edition, setEdition] = React.useState<Utilisateur | null>(null)

  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("nom", {
          header: "Nom",
          cell: ({ row }) => (
            <div>
              <p className="font-medium">{row.original.nom}</p>
              <p className="text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          ),
        }),
        col.accessor("fonction", { header: "Fonction", cell: ({ getValue }) => getValue() ?? "—" }),
        col.display({
          id: "roles",
          header: "Rôles",
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
              {row.original.roles.map((r) => (
                <Badge key={r} variant="outline">
                  {r}
                </Badge>
              ))}
            </div>
          ),
        }),
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
      ]),
    []
  )

  const filtres = utilisateurs.filter((u) => {
    const q = recherche.trim().toLowerCase()
    return !q || [u.nom, u.email, ...u.roles].some((v) => v.toLowerCase().includes(q))
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Nom, email, rôle…"
          aria-label="Rechercher un utilisateur"
          className="pl-8"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>
      <DataTable data={filtres} columns={columns} getRowId={(u) => u.id} />
      <Dialog open={edition !== null} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent>
          {edition && <EditionProfil key={edition.id} u={edition} onFini={() => setEdition(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditionProfil({ u, onFini }: { u: Utilisateur; onFini: () => void }) {
  const [etat, onSubmit, enCours] = useFormAction(modifierProfil.bind(null, u.id))
  React.useEffect(() => {
    if (etat?.ok) {
      toast.success(etat.message)
      onFini()
    } else if (etat?.message) toast.error(etat.message)
  }, [etat, onFini])
  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{u.email}</DialogTitle>
      </DialogHeader>
      <FieldGroup className="py-4">
        <Field data-invalid={!!etat?.erreurs?.nom_complet}>
          <FieldLabel htmlFor="p-nom">Nom complet</FieldLabel>
          <Input id="p-nom" name="nom_complet" defaultValue={u.nom} />
          <FieldError>{etat?.erreurs?.nom_complet?.[0]}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="p-fonction">Fonction</FieldLabel>
          <Input id="p-fonction" name="fonction" defaultValue={u.fonction ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor="p-tel">Téléphone</FieldLabel>
          <Input id="p-tel" name="telephone" type="tel" defaultValue={u.telephone ?? ""} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFini}>
          Annuler
        </Button>
        <Button type="submit" disabled={enCours}>
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  )
}
