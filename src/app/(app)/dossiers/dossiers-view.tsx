"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { KanbanSquareIcon, ListIcon, SearchIcon } from "lucide-react"

import { colonnes, DataTable } from "@/components/data-table"
import { StatutBadge } from "@/components/statut-badge"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatDate, formatMontant } from "@/lib/format"
import { STATUTS, type DossierStatut } from "@/lib/permissions"
import { Kanban } from "./kanban"

export type DossierLigne = {
  id: string
  numero: string
  statut: DossierStatut
  service: string
  date_reception: string
  delai_souhaite: string | null
  budget_indicatif: number | null
  budget_devise: "USD" | "CDF"
  department_id: string
  departement: string
  responsable_id: string | null
  responsable: string
  client: string
}

type Filtres = { vue: "liste" | "kanban"; statut: string; departement: string; responsable: string }

const col = colonnes<DossierLigne>()

export function DossiersView({
  dossiers,
  departements,
  userId,
  initial,
}: {
  dossiers: DossierLigne[]
  departements: { id: string; code: string; nom: string }[]
  userId: string
  initial: Filtres
}) {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const [f, setF] = React.useState<Filtres>(initial)
  const [recherche, setRecherche] = React.useState("")

  const maj = (patch: Partial<Filtres>) => {
    const suivant = { ...f, ...patch }
    setF(suivant)
    const p = new URLSearchParams()
    if (suivant.vue === "kanban") p.set("vue", "kanban")
    if (suivant.statut) p.set("statut", suivant.statut)
    if (suivant.departement) p.set("departement", suivant.departement)
    if (suivant.responsable) p.set("responsable", suivant.responsable)
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false })
  }

  const responsables = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const d of dossiers) if (d.responsable_id) m.set(d.responsable_id, d.responsable)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"))
  }, [dossiers])

  const filtres = React.useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const resp = f.responsable === "moi" ? userId : f.responsable
    return dossiers.filter(
      (d) =>
        (!f.statut || f.vue === "kanban" || d.statut === f.statut) &&
        (!f.departement || d.department_id === f.departement) &&
        (!resp || d.responsable_id === resp) &&
        (!q || [d.numero, d.client, d.service].some((v) => v.toLowerCase().includes(q)))
    )
  }, [dossiers, f, recherche, userId])

  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("numero", {
          header: "Numéro",
          cell: ({ row }) => (
            <Link
              href={`/dossiers/${row.original.id}`}
              className="font-medium whitespace-nowrap text-primary hover:underline dark:text-foreground"
            >
              {row.original.numero}
            </Link>
          ),
        }),
        col.accessor("client", {
          header: "Client",
          cell: ({ row }) => (
            <div className="max-w-56">
              <p className="truncate">{row.original.client}</p>
              <p className="truncate text-xs text-muted-foreground">{row.original.service}</p>
            </div>
          ),
        }),
        col.accessor("statut", {
          header: "Statut",
          cell: ({ getValue }) => <StatutBadge statut={getValue()} />,
          sortFn: (a, b) => STATUTS.indexOf(a.original.statut) - STATUTS.indexOf(b.original.statut),
        }),
        col.accessor("departement", { header: "Dépt." }),
        col.accessor("responsable", {
          header: "Responsable",
          cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span>,
        }),
        col.accessor("date_reception", {
          header: "Reçu le",
          cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue())}</span>,
        }),
        col.accessor("budget_indicatif", {
          header: "Budget",
          cell: ({ row }) => (
            <span className="whitespace-nowrap tabular-nums">
              {formatMontant(row.original.budget_indicatif, row.original.budget_devise)}
            </span>
          ),
        }),
      ]),
    []
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Numéro, client, service…"
            aria-label="Rechercher un dossier"
            className="pl-8"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {f.vue === "liste" && (
            <NativeSelect
              aria-label="Filtrer par statut"
              value={f.statut}
              onChange={(e) => maj({ statut: e.target.value })}
              className="w-full sm:w-44"
            >
              <NativeSelectOption value="">Tous les statuts</NativeSelectOption>
              {STATUTS.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {t(`statuts.${s}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          <NativeSelect
            aria-label="Filtrer par département"
            value={f.departement}
            onChange={(e) => maj({ departement: e.target.value })}
            className="w-full sm:w-40"
          >
            <NativeSelectOption value="">Tous départements</NativeSelectOption>
            {departements.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.code} — {d.nom}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filtrer par responsable"
            value={f.responsable}
            onChange={(e) => maj({ responsable: e.target.value })}
            className="w-full sm:w-44"
          >
            <NativeSelectOption value="">Tous responsables</NativeSelectOption>
            <NativeSelectOption value="moi">Mes dossiers</NativeSelectOption>
            {responsables.map(([id, nom]) => (
              <NativeSelectOption key={id} value={id}>
                {nom}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <ToggleGroup
            value={[f.vue]}
            onValueChange={(v) => {
              const vue = v[0] as Filtres["vue"] | undefined
              if (vue) maj({ vue })
            }}
            variant="outline"
            aria-label="Affichage"
          >
            <ToggleGroupItem value="liste" aria-label={t("common.liste")}>
              <ListIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label={t("common.kanban")}>
              <KanbanSquareIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {f.vue === "liste" ? (
        <DataTable data={filtres} columns={columns} getRowId={(d) => d.id} vide="Aucun dossier." />
      ) : (
        <Kanban dossiers={filtres} />
      )}
    </div>
  )
}
