"use client"

import * as React from "react"
import { useFormAction } from "@/hooks/use-form-action"
import { toast } from "sonner"
import { MailIcon, PencilIcon, PhoneIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Tables } from "@/lib/database.types"
import { enregistrerContact, supprimerContact } from "../actions"

type Contact = Tables<"contacts">

export function Contacts({
  clientId,
  contacts,
  peutEcrire,
}: {
  clientId: string
  contacts: Contact[]
  peutEcrire: boolean
}) {
  const [edition, setEdition] = React.useState<Contact | "nouveau" | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        {peutEcrire && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setEdition("nouveau")}>
              <PlusIcon /> Ajouter
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {contacts.length === 0 && <p className="text-sm text-muted-foreground">Aucun contact.</p>}
        {contacts.map((c) => (
          <div key={c.id} className="flex flex-wrap items-start gap-2 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {c.nom}{" "}
                {c.est_signataire && (
                  <Badge variant="outline" className="ml-1 border-accent/60">
                    Signataire
                  </Badge>
                )}
              </p>
              {c.fonction && <p className="text-sm text-muted-foreground">{c.fonction}</p>}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {c.telephone && (
                  <a href={`tel:${c.telephone}`} className="inline-flex items-center gap-1 hover:underline">
                    <PhoneIcon className="size-3.5" aria-hidden /> {c.telephone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:underline">
                    <MailIcon className="size-3.5" aria-hidden /> {c.email}
                  </a>
                )}
              </div>
            </div>
            {peutEcrire && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setEdition(c)}>
                  <PencilIcon />
                  <span className="sr-only">Modifier {c.nom}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={async () => {
                    if (!window.confirm(`Supprimer le contact ${c.nom} ?`)) return
                    const r = await supprimerContact(clientId, c.id)
                    if (r?.ok) toast.success(r.message)
                    else toast.error(r?.message)
                  }}
                >
                  <Trash2Icon />
                  <span className="sr-only">Supprimer {c.nom}</span>
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
      <Dialog open={edition !== null} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent>
          {edition !== null && (
            <FormulaireContact
              key={edition === "nouveau" ? "nouveau" : edition.id}
              clientId={clientId}
              contact={edition === "nouveau" ? null : edition}
              onFini={() => setEdition(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function FormulaireContact({
  clientId,
  contact,
  onFini,
}: {
  clientId: string
  contact: Contact | null
  onFini: () => void
}) {
  const [etat, action, enCours] = useFormAction(
    enregistrerContact.bind(null, clientId, contact?.id ?? null)
  )
  const err = etat?.erreurs ?? {}

  React.useEffect(() => {
    if (etat?.ok) {
      toast.success(etat.message)
      onFini()
    } else if (etat?.message) {
      toast.error(etat.message)
    }
  }, [etat, onFini])

  return (
    <form onSubmit={action} noValidate>
      <DialogHeader>
        <DialogTitle>{contact ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
      </DialogHeader>
      <FieldGroup className="py-4">
        <Field data-invalid={!!err.nom}>
          <FieldLabel htmlFor="ct-nom">Nom</FieldLabel>
          <Input id="ct-nom" name="nom" defaultValue={contact?.nom ?? ""} aria-invalid={!!err.nom} />
          <FieldError>{err.nom?.[0]}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="ct-fonction">Fonction</FieldLabel>
          <Input id="ct-fonction" name="fonction" defaultValue={contact?.fonction ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ct-tel">Téléphone</FieldLabel>
            <Input id="ct-tel" name="telephone" type="tel" defaultValue={contact?.telephone ?? ""} />
          </Field>
          <Field data-invalid={!!err.email}>
            <FieldLabel htmlFor="ct-email">Email</FieldLabel>
            <Input id="ct-email" name="email" type="email" defaultValue={contact?.email ?? ""} aria-invalid={!!err.email} />
            <FieldError>{err.email?.[0]}</FieldError>
          </Field>
        </div>
        <Field orientation="horizontal">
          <Checkbox id="ct-sign" name="est_signataire" defaultChecked={contact?.est_signataire ?? false} />
          <FieldLabel htmlFor="ct-sign">Signataire habilité</FieldLabel>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFini}>
          Annuler
        </Button>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  )
}
