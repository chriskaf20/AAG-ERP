"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ROLES, ROLES_DEPARTEMENT, type AppRole } from "@/lib/permissions"
import { ajouterRole, retirerRole } from "../actions"

type Utilisateur = {
  id: string
  nom: string
  email: string
  roles: { id: string; role: string; dept: string | null }[]
}

export function MatriceRoles({
  utilisateurs,
  departements,
  peutAdmin,
  moi,
}: {
  utilisateurs: Utilisateur[]
  departements: { id: string; code: string; nom: string }[]
  peutAdmin: boolean
  moi: string
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {utilisateurs.map((u) => (
        <CarteUtilisateur key={u.id} u={u} departements={departements} peutAdmin={peutAdmin} estMoi={u.id === moi} />
      ))}
    </div>
  )
}

function CarteUtilisateur({
  u,
  departements,
  peutAdmin,
  estMoi,
}: {
  u: Utilisateur
  departements: { id: string; code: string; nom: string }[]
  peutAdmin: boolean
  estMoi: boolean
}) {
  const t = useTranslations("roles")
  const [role, setRole] = React.useState<AppRole | "">("")
  const [dept, setDept] = React.useState("")
  const [enCours, setEnCours] = React.useState(false)
  const avecDept = role !== "" && ROLES_DEPARTEMENT.includes(role)

  const notifier = (r: { ok?: boolean; message?: string } | null) =>
    r?.ok ? toast.success(r.message) : toast.error(r?.message ?? "Erreur")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {u.nom} {estMoi && <span className="text-xs font-normal text-muted-foreground">(vous)</span>}
        </CardTitle>
        <CardDescription>{u.email}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-1.5">
          {u.roles.map((r) => {
            const protege = r.role === "admin_systeme" && !peutAdmin
            return (
              <li key={r.id} className="flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
                {t(r.role)}
                {r.dept && <span className="text-muted-foreground">· {r.dept}</span>}
                {!protege && (
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-background"
                    aria-label={`Retirer le rôle ${t(r.role)}`}
                    onClick={async () => notifier(await retirerRole(r.id))}
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <NativeSelect
            aria-label={`Rôle à ajouter pour ${u.nom}`}
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole | "")}
            size="sm"
            className="min-w-0 flex-1"
          >
            <NativeSelectOption value="">Ajouter un rôle…</NativeSelectOption>
            {ROLES.filter((r) => peutAdmin || r !== "admin_systeme").map((r) => (
              <NativeSelectOption key={r} value={r}>
                {t(r)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {avecDept && (
            <NativeSelect
              aria-label="Département"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              size="sm"
            >
              <NativeSelectOption value="">Département…</NativeSelectOption>
              {departements.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.code}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!role || enCours}
            onClick={async () => {
              if (!role) return
              setEnCours(true)
              notifier(await ajouterRole(u.id, role, dept || null))
              setEnCours(false)
              setRole("")
              setDept("")
            }}
          >
            <PlusIcon /> Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
