"use client"

import * as React from "react"
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Tableau de données générique (bloc dashboard-01 adapté, TanStack Table v9).
 * Le filtrage est fait en amont par la page (recherche, filtres) ;
 * le tableau gère le tri et la pagination.
 */
export const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

export type Features = typeof features

export function colonnes<T extends RowData>() {
  return createColumnHelper<Features, T>()
}

export function DataTable<T extends RowData>({
  data,
  columns,
  getRowId,
  vide = "Aucun résultat.",
  taillePage = 20,
}: {
  data: T[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<Features, T, any>[]
  getRowId?: (row: T) => string
  vide?: string
  taillePage?: number
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: taillePage })

  // Revenir à la première page quand les données filtrées changent
  const [dataPrecedente, setDataPrecedente] = React.useState(data)
  if (dataPrecedente !== data) {
    setDataPrecedente(data)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting, pagination },
    getRowId,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  const total = table.getPageCount()

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const triable = header.column.getCanSort()
                  const sens = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        sens === "asc" ? "ascending" : sens === "desc" ? "descending" : undefined
                      }
                    >
                      {header.isPlaceholder ? null : triable ? (
                        <button
                          type="button"
                          className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <FlexRender header={header} />
                          {sens === "asc" ? (
                            <ArrowUpIcon className="size-3.5" aria-hidden />
                          ) : sens === "desc" ? (
                            <ArrowDownIcon className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        <FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {vide}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {total > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {data.length} élément{data.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-medium tabular-nums">
              Page {table.state.pagination.pageIndex + 1} / {total}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon />
              <span className="sr-only">Page précédente</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon />
              <span className="sr-only">Page suivante</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
