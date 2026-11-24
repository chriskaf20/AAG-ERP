"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { LigneSaisie } from "@/app/(app)/finance/actions"
import { formatMontant } from "@/lib/format"

export type Ligne = {
  id: string
  description: string
  unite: "forfait" | "jour" | "mois" | "m2" | "course"
  quantite: number
  prix_unitaire: number
  remise_pct: number
  montant_ht: number
  service_id: string | null
  cout_unitaire?: number | null
}

export type Service = {
  id: string
  nom: string
  unite: Ligne["unite"]
  prix_base_usd: number
}

const UNITES = ["forfait", "jour", "mois", "m2", "course"] as const

const vide = (): LigneSaisie => ({
  service_id: null,
  description: "",
  unite: "forfait",
  quantite: 1,
  prix_unitaire: 0,
  remise_pct: 0,
  cout_unitaire: null,
})

export function EditeurLignes({
  lignes,
  services,
  devise,
  tauxCdf,
  lectureSeule,
  avecCout = false,
  enCours,
  onAjouter,
  onModifier,
  onSupprimer,
}: {
  lignes: Ligne[]
  services: Service[]
  devise: "USD" | "CDF"
  tauxCdf: number
  lectureSeule: boolean
  avecCout?: boolean
  enCours: boolean
  onAjouter: (l: LigneSaisie, reset: () => void) => void
  onModifier?: (id: string, l: LigneSaisie) => void
  onSupprimer: (id: string) => void
}) {
  const t = useTranslations("unites")
  const id = React.useId()
  const [nouvelle, setNouvelle] = React.useState<LigneSaisie>(vide)
  const montantNouvelle =
    Math.round((Number(nouvelle.quantite) || 0) * (Number(nouvelle.prix_unitaire) || 0) * (1 - (Number(nouvelle.remise_pct) || 0) / 100) * 100) / 100

  const choisirService = (id: string) => {
    const s = services.find((x) => x.id === id)
    if (!s) return setNouvelle((n) => ({ ...n, service_id: null }))
    setNouvelle((n) => ({
      ...n,
      service_id: s.id,
      description: s.nom,
      unite: s.unite,
      prix_unitaire: devise === "CDF" ? Math.round(s.prix_base_usd * tauxCdf) : s.prix_base_usd,
    }))
  }

  const modifier = (l: Ligne, patch: Partial<LigneSaisie>) =>
    onModifier?.(l.id, {
      service_id: l.service_id,
      description: l.description,
      unite: l.unite,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      remise_pct: l.remise_pct,
      cout_unitaire: l.cout_unitaire ?? null,
      ...patch,
    })

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="min-w-56">Désignation</TableHead>
              <TableHead className="w-24 text-right">Qté</TableHead>
              <TableHead className="w-24">Unité</TableHead>
              <TableHead className="w-32 text-right">P.U. HT</TableHead>
              <TableHead className="w-20 text-right">Remise %</TableHead>
              <TableHead className="w-32 text-right">Montant HT</TableHead>
              {avecCout && <TableHead className="w-28 text-right">Coût U.</TableHead>}
              {!lectureSeule && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                  Aucune ligne.
                </TableCell>
              </TableRow>
            )}
            {lignes.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-normal">{l.description}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {lectureSeule || !onModifier ? (
                    l.quantite
                  ) : (
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      defaultValue={l.quantite}
                      aria-label={`Quantité — ${l.description}`}
                      className="h-7 w-20 text-right"
                      onBlur={(e) => {
                        const q = Number(e.target.value)
                        if (q > 0 && q !== l.quantite) modifier(l, { quantite: q })
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>{t(l.unite)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {lectureSeule || !onModifier ? (
                    formatMontant(l.prix_unitaire, devise)
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={l.prix_unitaire}
                      aria-label={`Prix unitaire — ${l.description}`}
                      className="h-7 w-28 text-right"
                      onBlur={(e) => {
                        const p = Number(e.target.value)
                        if (p >= 0 && p !== l.prix_unitaire) modifier(l, { prix_unitaire: p })
                      }}
                    />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.remise_pct || "—"}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMontant(l.montant_ht, devise)}
                </TableCell>
                {avecCout && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {lectureSeule || !onModifier ? (
                      l.cout_unitaire != null ? formatMontant(l.cout_unitaire, devise) : "—"
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={l.cout_unitaire ?? ""}
                        aria-label={`Coût unitaire estimé — ${l.description}`}
                        className="h-7 w-24 text-right"
                        onBlur={(e) => {
                          const c = e.target.value === "" ? null : Number(e.target.value)
                          if (c !== (l.cout_unitaire ?? null) && (c === null || c >= 0)) modifier(l, { cout_unitaire: c })
                        }}
                      />
                    )}
                  </TableCell>
                )}
                {!lectureSeule && (
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" disabled={enCours} onClick={() => onSupprimer(l.id)}>
                      <Trash2Icon />
                      <span className="sr-only">Supprimer la ligne {l.description}</span>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          {!lectureSeule && (
            <TableFooter className="bg-transparent">
              <TableRow className="align-top hover:bg-transparent">
                <TableCell className="whitespace-normal">
                  <div className="flex min-w-56 flex-col gap-1.5">
                    <label htmlFor={`${id}-service`} className="text-xs font-medium text-muted-foreground">Service du catalogue</label>
                    <NativeSelect id={`${id}-service`} className="w-full" value={nouvelle.service_id ?? ""} onChange={(e) => choisirService(e.target.value)} form={`${id}-form`}>
                      <NativeSelectOption value="">Ligne libre…</NativeSelectOption>
                      {services.map((x) => (
                        <NativeSelectOption key={x.id} value={x.id}>{x.nom}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <label htmlFor={`${id}-desc`} className="text-xs font-medium text-muted-foreground">Désignation</label>
                    <Input id={`${id}-desc`} form={`${id}-form`} value={nouvelle.description} required
                      onChange={(e) => setNouvelle((n) => ({ ...n, description: e.target.value }))} />
                  </div>
                </TableCell>
                <TableCell>
                  <label htmlFor={`${id}-qte`} className="mb-1.5 block text-xs font-medium text-muted-foreground">Qté</label>
                  <Input id={`${id}-qte`} form={`${id}-form`} type="number" min={0.01} step="0.01" className="w-20 text-right"
                    value={String(nouvelle.quantite)} onChange={(e) => setNouvelle((n) => ({ ...n, quantite: e.target.value as unknown as number }))} />
                </TableCell>
                <TableCell>
                  <label htmlFor={`${id}-unite`} className="mb-1.5 block text-xs font-medium text-muted-foreground">Unité</label>
                  <NativeSelect id={`${id}-unite`} form={`${id}-form`} value={nouvelle.unite}
                    onChange={(e) => setNouvelle((n) => ({ ...n, unite: e.target.value as Ligne["unite"] }))}>
                    {UNITES.map((u) => (
                      <NativeSelectOption key={u} value={u}>{t(u)}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell>
                  <label htmlFor={`${id}-pu`} className="mb-1.5 block text-xs font-medium text-muted-foreground">P.U. HT ({devise})</label>
                  <Input id={`${id}-pu`} form={`${id}-form`} type="number" step="0.01" min={0} className="w-28 text-right"
                    value={String(nouvelle.prix_unitaire)} onChange={(e) => setNouvelle((n) => ({ ...n, prix_unitaire: e.target.value as unknown as number }))} />
                </TableCell>
                <TableCell>
                  <label htmlFor={`${id}-remise`} className="mb-1.5 block text-xs font-medium text-muted-foreground">Remise %</label>
                  <Input id={`${id}-remise`} form={`${id}-form`} type="number" min={0} max={100} step="0.01" className="w-20 text-right"
                    value={String(nouvelle.remise_pct)} onChange={(e) => setNouvelle((n) => ({ ...n, remise_pct: e.target.value as unknown as number }))} />
                </TableCell>
                <TableCell className="text-right">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Montant HT</span>
                  <output htmlFor={`${id}-qte ${id}-pu ${id}-remise`} className="block py-1.5 font-medium tabular-nums" aria-live="polite">
                    {formatMontant(montantNouvelle, devise)}
                  </output>
                </TableCell>
                {avecCout && (
                  <TableCell>
                    <label htmlFor={`${id}-cout`} className="mb-1.5 block text-xs font-medium text-muted-foreground">Coût U. estimé</label>
                    <Input id={`${id}-cout`} form={`${id}-form`} type="number" step="0.01" min={0} className="w-24 text-right"
                      value={nouvelle.cout_unitaire == null ? "" : String(nouvelle.cout_unitaire)}
                      onChange={(e) => setNouvelle((n) => ({ ...n, cout_unitaire: e.target.value === "" ? null : Number(e.target.value) }))} />
                  </TableCell>
                )}
                <TableCell>
                  <span className="mb-1.5 block text-xs text-transparent select-none" aria-hidden>.</span>
                  <Button type="submit" form={`${id}-form`} variant="outline" size="icon" disabled={enCours || !nouvelle.description.trim()}>
                    <PlusIcon />
                    <span className="sr-only">Ajouter la ligne</span>
                  </Button>
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {!lectureSeule && (
        <form
          id={`${id}-form`}
          onSubmit={(e) => {
            e.preventDefault()
            onAjouter(nouvelle, () => setNouvelle(vide()))
          }}
        >
          <p className="text-xs text-muted-foreground">
            Choisissez un service pour pré-remplir la désignation, l&apos;unité et le prix (modifiables), ou saisissez une ligne libre.
            La remise s&apos;applique en pourcentage sur la ligne ; le montant HT se calcule en direct. Les lignes existantes se
            corrigent directement dans le tableau (quantité, prix).{avecCout ? " Le coût estimé sert au calcul de la marge et n'apparaît pas sur le devis client." : ""}
          </p>
        </form>
      )}
    </div>
  )
}
