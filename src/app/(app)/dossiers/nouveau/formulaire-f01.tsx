"use client"

import * as React from "react"
import { useFormAction } from "@/hooks/use-form-action"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Membre } from "@/lib/membres"
import { creerDossier } from "../actions"

type Contact = { id: string; nom: string; fonction: string | null; telephone: string | null; email: string | null }
type Client = {
  id: string
  raison_sociale: string
  type: "entreprise" | "particulier"
  adresse: string | null
  telephone: string | null
  email: string | null
  contacts: Contact[]
}

const CANAUX = ["visite", "appel", "whatsapp", "email", "site_web"] as const
const PIECES = ["rccm", "id_nat", "nif", "piece_identite", "autre"] as const

function aujourdhui() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lubumbashi" }).format(new Date())
}

export function FormulaireF01({
  clients,
  departements,
  responsables,
  userId,
  devise,
}: {
  clients: Client[]
  departements: { id: string; code: string; nom: string }[]
  responsables: Membre[]
  userId: string
  devise: "USD" | "CDF"
}) {
  const t = useTranslations()
  const [etat, action, enCours] = useFormAction(creerDossier)
  const err = etat?.erreurs ?? {}

  const [nouveauClient, setNouveauClient] = React.useState(clients.length === 0)
  const [clientId, setClientId] = React.useState("")
  const [contactId, setContactId] = React.useState("")
  const [pieces, setPieces] = React.useState<string[]>([])

  const client = clients.find((c) => c.id === clientId)
  const contact = client?.contacts.find((c) => c.id === contactId)
  const nouveauContact = nouveauClient || !contactId

  const e = (k: string) => err[k]?.[0]
  const invalide = (k: string) => !!err[k]

  return (
    <form onSubmit={action} noValidate className="flex flex-col gap-4">
      {etat?.message && !etat.ok && (
        <Alert variant="destructive">
          <AlertDescription>{etat.message}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="nouveau_client" value={nouveauClient ? "1" : "0"} />

      <Card>
        <CardHeader>
          <CardTitle>Réception de la demande</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Numéro</FieldLabel>
              <Input value="Attribué automatiquement (AAG-AAAA-NNN)" disabled readOnly />
            </Field>
            <Field data-invalid={invalide("date_reception")}>
              <FieldLabel htmlFor="date_reception">Date de réception</FieldLabel>
              <Input id="date_reception" name="date_reception" type="date" defaultValue={aujourdhui()} required />
              <FieldError>{e("date_reception")}</FieldError>
            </Field>
            <FieldSet className="sm:col-span-2" data-invalid={invalide("canal")}>
              <FieldLegend variant="label">Canal</FieldLegend>
              <div className="flex flex-wrap gap-2">
                {CANAUX.map((c) => (
                  <label
                    key={c}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  >
                    <input type="radio" name="canal" value={c} className="sr-only" required />
                    {t(`canaux.${c}`)}
                  </label>
                ))}
              </div>
              <FieldError>{e("canal")}</FieldError>
            </FieldSet>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client et contact</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <Switch
                id="nouveau-client"
                checked={nouveauClient}
                onCheckedChange={(v) => {
                  setNouveauClient(v)
                  setContactId("")
                }}
              />
              <FieldLabel htmlFor="nouveau-client">Nouveau client</FieldLabel>
            </Field>

            {!nouveauClient ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={invalide("client_id")}>
                  <FieldLabel htmlFor="client_id">Client (raison sociale ou nom)</FieldLabel>
                  <NativeSelect
                    id="client_id"
                    name="client_id"
                    value={clientId}
                    onChange={(ev) => {
                      setClientId(ev.target.value)
                      setContactId("")
                    }}
                    className="w-full"
                    aria-invalid={invalide("client_id")}
                  >
                    <NativeSelectOption value="">— Choisir —</NativeSelectOption>
                    {clients.map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.raison_sociale}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError>{e("client_id")}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact_id">Personne de contact</FieldLabel>
                  <NativeSelect
                    id="contact_id"
                    name="contact_id"
                    value={contactId}
                    onChange={(ev) => setContactId(ev.target.value)}
                    disabled={!client}
                    className="w-full"
                  >
                    <NativeSelectOption value="">+ Nouveau contact</NativeSelectOption>
                    {client?.contacts.map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.nom}
                        {c.fonction ? ` — ${c.fonction}` : ""}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                {client && (
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    {[client.adresse, contact?.telephone ?? client.telephone, contact?.email ?? client.email]
                      .filter(Boolean)
                      .join(" · ") || "Coordonnées non renseignées"}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="client_type">Type</FieldLabel>
                  <NativeSelect id="client_type" name="client_type" className="w-full" defaultValue="entreprise">
                    <NativeSelectOption value="entreprise">Entreprise</NativeSelectOption>
                    <NativeSelectOption value="particulier">Particulier</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field data-invalid={invalide("client_raison_sociale")}>
                  <FieldLabel htmlFor="client_raison_sociale">Raison sociale ou nom</FieldLabel>
                  <Input id="client_raison_sociale" name="client_raison_sociale" aria-invalid={invalide("client_raison_sociale")} />
                  <FieldError>{e("client_raison_sociale")}</FieldError>
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="client_adresse">Adresse</FieldLabel>
                  <Input id="client_adresse" name="client_adresse" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="client_telephone">Téléphone (société)</FieldLabel>
                  <Input id="client_telephone" name="client_telephone" type="tel" inputMode="tel" />
                </Field>
                <Field data-invalid={invalide("client_email")}>
                  <FieldLabel htmlFor="client_email">Email (société)</FieldLabel>
                  <Input id="client_email" name="client_email" type="email" inputMode="email" />
                  <FieldError>{e("client_email")}</FieldError>
                </Field>
              </div>
            )}

            {nouveauContact && (
              <FieldSet>
                <FieldLegend variant="label">Personne de contact</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={invalide("contact_nom")}>
                    <FieldLabel htmlFor="contact_nom">Nom</FieldLabel>
                    <Input id="contact_nom" name="contact_nom" aria-invalid={invalide("contact_nom")} />
                    <FieldError>{e("contact_nom")}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="contact_fonction">Fonction</FieldLabel>
                    <Input id="contact_fonction" name="contact_fonction" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="contact_telephone">Téléphone</FieldLabel>
                    <Input id="contact_telephone" name="contact_telephone" type="tel" inputMode="tel" />
                  </Field>
                  <Field data-invalid={invalide("contact_email")}>
                    <FieldLabel htmlFor="contact_email">Email</FieldLabel>
                    <Input id="contact_email" name="contact_email" type="email" inputMode="email" />
                    <FieldError>{e("contact_email")}</FieldError>
                  </Field>
                </div>
              </FieldSet>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demande</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" data-invalid={invalide("service")}>
              <FieldLabel htmlFor="service">Service demandé</FieldLabel>
              <Input id="service" name="service" aria-invalid={invalide("service")} />
              <FieldError>{e("service")}</FieldError>
            </Field>
            <Field className="sm:col-span-2" data-invalid={invalide("besoin")}>
              <FieldLabel htmlFor="besoin">Description du besoin</FieldLabel>
              <Textarea id="besoin" name="besoin" rows={4} aria-invalid={invalide("besoin")} />
              <FieldError>{e("besoin")}</FieldError>
            </Field>
            <Field data-invalid={invalide("delai_souhaite")}>
              <FieldLabel htmlFor="delai_souhaite">Délai souhaité</FieldLabel>
              <Input id="delai_souhaite" name="delai_souhaite" type="date" />
              <FieldError>{e("delai_souhaite")}</FieldError>
            </Field>
            <Field data-invalid={invalide("budget_indicatif")}>
              <FieldLabel htmlFor="budget_indicatif">Budget indicatif</FieldLabel>
              <div className="flex gap-2">
                <Input id="budget_indicatif" name="budget_indicatif" inputMode="decimal" className="flex-1" />
                <NativeSelect name="budget_devise" defaultValue={devise} aria-label="Devise">
                  <NativeSelectOption value="USD">USD</NativeSelectOption>
                  <NativeSelectOption value="CDF">CDF</NativeSelectOption>
                </NativeSelect>
              </div>
              <FieldError>{e("budget_indicatif")}</FieldError>
            </Field>
            <Field data-invalid={invalide("department_id")}>
              <FieldLabel htmlFor="department_id">Département affecté</FieldLabel>
              <NativeSelect id="department_id" name="department_id" className="w-full" defaultValue="">
                <NativeSelectOption value="">— Choisir —</NativeSelectOption>
                {departements.map((d) => (
                  <NativeSelectOption key={d.id} value={d.id}>
                    {d.code} — {d.nom}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{e("department_id")}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="responsable_id">Responsable de dossier</FieldLabel>
              <NativeSelect
                id="responsable_id"
                name="responsable_id"
                className="w-full"
                defaultValue={responsables.length === 1 ? responsables[0]!.id : ""}
              >
                {responsables.length > 1 && <NativeSelectOption value="">— À désigner —</NativeSelectOption>}
                {responsables.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.nom}
                    {m.id === userId ? " (moi)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pièces et accusé de réception</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Pièces reçues</FieldLegend>
              <FieldDescription>Les fichiers se déposent ensuite dans la fiche du client ou du dossier.</FieldDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {PIECES.map((p) => (
                  <Field key={p} orientation="horizontal">
                    <Checkbox
                      id={`piece-${p}`}
                      name="pieces_recues"
                      value={p}
                      checked={pieces.includes(p)}
                      onCheckedChange={(v) =>
                        setPieces((l) => (v ? [...l, p] : l.filter((x) => x !== p)))
                      }
                    />
                    <FieldLabel htmlFor={`piece-${p}`} className="font-normal">
                      {t(`pieces.${p}`)}
                    </FieldLabel>
                  </Field>
                ))}
              </div>
            </FieldSet>
            {pieces.includes("autre") && (
              <Field data-invalid={invalide("pieces_autres")}>
                <FieldLabel htmlFor="pieces_autres">Autres pièces (préciser)</FieldLabel>
                <Input id="pieces_autres" name="pieces_autres" />
                <FieldError>{e("pieces_autres")}</FieldError>
              </Field>
            )}
            <Field orientation="horizontal">
              <Switch id="accuse_reception_envoye" name="accuse_reception_envoye" />
              <FieldLabel htmlFor="accuse_reception_envoye">Accusé de réception envoyé</FieldLabel>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Ouvrir le dossier"}
        </Button>
      </div>
    </form>
  )
}
