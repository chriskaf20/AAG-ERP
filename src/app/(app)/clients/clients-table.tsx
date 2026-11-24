"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { SearchIcon } from "lucide-react"

import { colonnes, DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type ClientLigne = {
  id: string
  type: "entreprise" | "particulier"
  raison_sociale: string
  rccm: string | null
  nif: string | null
  telephone: string | null
  email: string | null
  ville: string | null
  nb_dossiers: number
}

const col = colonnes<ClientLigne>()

export function ClientsTable({ clients }: { clients: ClientLigne[] }) {
  const t = useTranslations("clientTypes")
  const [recherche, setRecherche] = React.useState("")
  const [type, setType] = React.useState("")

  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("raison_sociale", {
          header: "Client",
          cell: ({ row }) => (
            <Link
              href={`/clients/${row.original.id}`}
              className="font-medium text-primary hover:underline dark:text-foreground"
            >
              {row.original.raison_sociale}
            </Link>
          ),
        }),
        col.accessor("type", {
          header: "Type",
          cell: ({ getValue }) => <Badge variant="outline">{t(getValue())}</Badge>,
        }),
        col.accessor("rccm", {
          header: "RCCM",
          cell: ({ getValue }) => getValue() ?? "—",
        }),
        col.accessor("telephone", {
          header: "Téléphone",
          cell: ({ getValue }) => getValue() ?? "—",
          enableSorting: false,
        }),
        col.accessor("nb_dossiers", {
          header: "Dossiers",
          cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
        }),
      ]),
    [t]
  )

  const filtres = React.useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return clients.filter(
      (c) =>
        (!type || c.type === type) &&
        (!q ||
          [c.raison_sociale, c.rccm, c.nif, c.telephone, c.email]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q)))
    )
  }, [clients, recherche, type])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            placeholder="Rechercher (nom, RCCM, NIF, téléphone…)"
            aria-label="Rechercher un client"
            className="pl-8"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Filtrer par type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full sm:w-44"
        >
          <NativeSelectOption value="">Tous les types</NativeSelectOption>
          <NativeSelectOption value="entreprise">{t("entreprise")}</NativeSelectOption>
          <NativeSelectOption value="particulier">{t("particulier")}</NativeSelectOption>
        </NativeSelect>
      </div>
      <DataTable data={filtres} columns={columns} getRowId={(c) => c.id} vide="Aucun client." />
    </div>
  )
}
