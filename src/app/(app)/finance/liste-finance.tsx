"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { SearchIcon } from "lucide-react"

import { colonnes, DataTable } from "@/components/data-table"
import { DevisBadge, FactureBadge } from "@/components/finance-badges"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { Enums } from "@/lib/database.types"
import { formatDate, formatMontant } from "@/lib/format"

export type LigneFinance = {
  id: string
  lien: string
  numero: string
  statut: string
  type?: string
  normalisee?: boolean
  dossier_id: string
  dossier: string
  client: string
  date: string | null
  echeance: string | null
  montant: number
  reste: number | null
  devise: "USD" | "CDF"
}

const col = colonnes<LigneFinance>()

export function ListeFinance({ genre, lignes }: { genre: "devis" | "factures"; lignes: LigneFinance[] }) {
  const t = useTranslations()
  const [recherche, setRecherche] = React.useState("")
  const [statut, setStatut] = React.useState("")
  const statuts = genre === "devis" ? Object.keys(t.raw("devisStatuts")) : Object.keys(t.raw("factureStatuts"))

  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("numero", {
          header: "Numéro",
          cell: ({ row }) => (
            <a href={row.original.lien} target="_blank" rel="noopener" className="font-medium whitespace-nowrap text-primary hover:underline dark:text-foreground">
              {row.original.numero}
            </a>
          ),
        }),
        col.accessor("statut", {
          header: "Statut",
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
              {genre === "devis" ? (
                <DevisBadge statut={row.original.statut as Enums<"devis_statut">} />
              ) : (
                <FactureBadge statut={row.original.statut as Enums<"facture_statut">} />
              )}
              {genre === "factures" && row.original.statut !== "brouillon" && !row.original.normalisee && (
                <Badge variant="outline" className="border-warning/40 text-warning">Pro forma</Badge>
              )}
            </div>
          ),
        }),
        col.accessor("client", {
          header: "Client / dossier",
          cell: ({ row }) => (
            <div className="max-w-56">
              <p className="truncate">{row.original.client}</p>
              <Link href={`/dossiers/${row.original.dossier_id}?onglet=${genre === "devis" ? "devis" : "factures"}`} className="text-xs text-muted-foreground hover:underline">
                {row.original.dossier}
                {row.original.type ? ` · ${t(`factureTypes.${row.original.type}`)}` : ""}
              </Link>
            </div>
          ),
        }),
        col.accessor("date", {
          header: genre === "devis" ? "Date" : "Émise le",
          cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue())}</span>,
        }),
        col.accessor("echeance", {
          header: genre === "devis" ? "Validité" : "Échéance",
          cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue())}</span>,
        }),
        col.accessor("montant", {
          header: "TTC",
          cell: ({ row }) => (
            <span className="whitespace-nowrap tabular-nums">{formatMontant(row.original.montant, row.original.devise)}</span>
          ),
        }),
        ...(genre === "factures"
          ? [
              col.accessor("reste", {
                header: "Reste dû",
                cell: ({ row }) => (
                  <span className="whitespace-nowrap font-medium tabular-nums">
                    {row.original.statut === "brouillon" ? "—" : formatMontant(row.original.reste, row.original.devise)}
                  </span>
                ),
              }),
            ]
          : []),
      ]),
    [genre, t]
  )

  const filtres = React.useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return lignes.filter(
      (l) =>
        (!statut || l.statut === statut) &&
        (!q || [l.numero, l.client, l.dossier].some((v) => v.toLowerCase().includes(q)))
    )
  }, [lignes, recherche, statut])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" placeholder="Numéro, client, dossier…" aria-label="Rechercher" className="pl-8"
            value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <NativeSelect aria-label="Filtrer par statut" value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full sm:w-52">
          <NativeSelectOption value="">Tous les statuts</NativeSelectOption>
          {statuts.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {t(`${genre === "devis" ? "devisStatuts" : "factureStatuts"}.${s}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <DataTable data={filtres} columns={columns} getRowId={(l) => l.id} vide={genre === "devis" ? "Aucun devis." : "Aucune facture."} />
    </div>
  )
}
