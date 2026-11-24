"use client"

import * as React from "react"
import { useActionState, startTransition } from "react"
import { useTranslations } from "next-intl"
import { CopyIcon, UserPlusIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ROLES, ROLES_DEPARTEMENT, type AppRole } from "@/lib/permissions"
import { creerUtilisateur } from "../actions"

export function NouvelUtilisateur({
  departements,
  peutAdmin,
  serviceRoleOk,
}: {
  departements: { id: string; code: string; nom: string }[]
  peutAdmin: boolean
  serviceRoleOk: boolean
}) {
  const t = useTranslations("roles")
  const [ouvert, setOuvert] = React.useState(false)
  const [role, setRole] = React.useState<AppRole>("responsable_dossier")
  const [etat, dispatch, enCours] = useActionState(creerUtilisateur, null)
  const err = etat?.erreurs ?? {}

  return (
    <>
      <Button size="sm" onClick={() => setOuvert(true)}>
        <UserPlusIcon /> Nouvel utilisateur
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent>
          {etat?.ok && etat.motDePasse ? (
            <>
              <DialogHeader>
                <DialogTitle>Compte créé</DialogTitle>
                <DialogDescription>{etat.message}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg border bg-muted p-3 font-mono text-sm">
                <span className="flex-1 select-all">{etat.motDePasse}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => navigator.clipboard.writeText(etat.motDePasse!)}
                >
                  <CopyIcon />
                  <span className="sr-only">Copier</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Ce mot de passe ne sera plus affiché.</p>
              <DialogFooter>
                <Button onClick={() => window.location.reload()}>Terminer</Button>
              </DialogFooter>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                startTransition(() => dispatch(fd))
              }}
              noValidate
            >
              <DialogHeader>
                <DialogTitle>Nouvel utilisateur</DialogTitle>
                <DialogDescription>Un mot de passe provisoire sera généré.</DialogDescription>
              </DialogHeader>
              <FieldGroup className="py-4">
                {!serviceRoleOk && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      SUPABASE_SERVICE_ROLE_KEY absente de la configuration serveur : création impossible.
                    </AlertDescription>
                  </Alert>
                )}
                {etat?.message && !etat.ok && (
                  <Alert variant="destructive">
                    <AlertDescription>{etat.message}</AlertDescription>
                  </Alert>
                )}
                <Field data-invalid={!!err.nom_complet}>
                  <FieldLabel htmlFor="u-nom">Nom complet</FieldLabel>
                  <Input id="u-nom" name="nom_complet" />
                  <FieldError>{err.nom_complet?.[0]}</FieldError>
                </Field>
                <Field data-invalid={!!err.email}>
                  <FieldLabel htmlFor="u-email">Email</FieldLabel>
                  <Input id="u-email" name="email" type="email" inputMode="email" />
                  <FieldError>{err.email?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="u-fonction">Fonction</FieldLabel>
                  <Input id="u-fonction" name="fonction" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="u-role">Rôle initial</FieldLabel>
                  <NativeSelect
                    id="u-role"
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as AppRole)}
                    className="w-full"
                  >
                    {ROLES.filter((r) => peutAdmin || r !== "admin_systeme").map((r) => (
                      <NativeSelectOption key={r} value={r}>
                        {t(r)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                {ROLES_DEPARTEMENT.includes(role) && (
                  <Field data-invalid={!!err.department_id}>
                    <FieldLabel htmlFor="u-dept">Département</FieldLabel>
                    <NativeSelect id="u-dept" name="department_id" className="w-full" defaultValue="">
                      <NativeSelectOption value="">— Choisir —</NativeSelectOption>
                      {departements.map((d) => (
                        <NativeSelectOption key={d.id} value={d.id}>
                          {d.code} — {d.nom}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldError>{err.department_id?.[0]}</FieldError>
                  </Field>
                )}
              </FieldGroup>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOuvert(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={enCours || !serviceRoleOk}>
                  {enCours ? "Création…" : "Créer le compte"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
