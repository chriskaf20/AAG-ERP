import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheckIcon, FileClockIcon, HandCoinsIcon, HourglassIcon } from "lucide-react"

import { FactureBadge } from "@/components/finance-badges"
import { PageBody, Section } from "@/components/page-body"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exiger } from "@/lib/contexte"
import { formatDate, formatMontant } from "@/lib/format"

export const metadata: Metadata = { title: "Finance" }

const TRANCHES = [
  { cle: "non_echu", libelle: "Non échu" },
  { cle: "0_30", libelle: "1–30 j" },
  { cle: "31_60", libelle: "31–60 j" },
  { cle: "61_90", libelle: "61–90 j" },
  { cle: "90_plus", libelle: "> 90 j" },
] as const

function tranche(echeance: string | null) {
  if (!echeance) return "non_echu"
  const jours = Math.floor((Date.now() - new Date(`${echeance}T23:59:59Z`).getTime()) / 86_400_000)
  if (jours < 0) return "non_echu"
  if (jours <= 30) return "0_30"
  if (jours <= 60) return "31_60"
  if (jours <= 90) return "61_90"
  return "90_plus"
}

export default async function TableauDeBordFinance() {
  const { supabase, organisation } = await exiger("factures.write")

  const [{ data: factures }, { data: devisSignes }] = await Promise.all([
    supabase
      .from("factures")
      .select("id, numero, type, statut, devise, taux_cdf, total_ttc, solde_du, echeance, normalisee_le, devis_id, dossier_id, dossiers(numero, clients(raison_sociale))")
      .eq("organization_id", organisation.id),
    supabase
      .from("devis")
      .select("id, numero, version, acompte_pct, total_ttc, devise, dossier_id, dossiers(numero, statut, clients(raison_sociale))")
      .eq("organization_id", organisation.id)
      .eq("statut", "signe"),
  ])

  const fs = (factures ?? []).map((f) => ({ ...f, solde_du: f.solde_du ?? 0 }))
  const enUsd = (m: number, devise: string, taux: number) => (devise === "CDF" ? m / taux : m)
  const ouvertes = fs.filter((f) => !["brouillon", "payee", "annulee"].includes(f.statut) && f.solde_du > 0)

  const acomptes = ouvertes.filter((f) => f.type === "acompte")
  const brouillons = fs.filter((f) => f.statut === "brouillon")
  const sansAcompte = (devisSignes ?? []).filter(
    (d) => (d.acompte_pct ?? 0) > 0 && !fs.some((f) => f.devis_id === d.id && f.type === "acompte" && f.statut !== "annulee")
  )
  const soldesAEmettre = (devisSignes ?? []).filter(
    (d) =>
      d.dossiers?.statut === "receptionne_a_facturer" &&
      !fs.some((f) => f.devis_id === d.id && f.type === "solde" && f.statut !== "annulee")
  )
  const aNormaliser = fs.filter((f) => f.statut !== "brouillon" && f.statut !== "annulee" && !f.normalisee_le)

  const balance = Object.fromEntries(TRANCHES.map((t) => [t.cle, { montant: 0, nb: 0 }])) as Record<
    (typeof TRANCHES)[number]["cle"],
    { montant: number; nb: number }
  >
  for (const f of ouvertes) {
    const b = balance[tranche(f.echeance)]
    b.montant += enUsd(f.solde_du, f.devise, f.taux_cdf)
    b.nb += 1
  }
  const totalImpaye = Object.values(balance).reduce((s, b) => s + b.montant, 0)
  const echu = totalImpaye - balance.non_echu.montant

  return (
    <>
      <SiteHeader titre="Finance" sousTitre="Tableau de bord DAF — montants en équivalent USD" />
      <PageBody>
        <SectionCards
          cartes={[
            {
              libelle: "Acomptes à encaisser",
              valeur: formatMontant(acomptes.reduce((s, f) => s + enUsd(f.solde_du, f.devise, f.taux_cdf), 0), "USD"),
              detail: `${acomptes.length} facture(s) d'acompte ouverte(s)`,
              icone: <HandCoinsIcon className="size-5" />,
              accent: true,
            },
            {
              libelle: "Factures à émettre",
              valeur: brouillons.length + sansAcompte.length + soldesAEmettre.length,
              detail: `${brouillons.length} brouillon(s), ${sansAcompte.length} acompte(s), ${soldesAEmettre.length} solde(s)`,
              icone: <FileClockIcon className="size-5" />,
            },
            {
              libelle: "Impayés échus",
              valeur: formatMontant(echu, "USD"),
              detail: `sur ${formatMontant(totalImpaye, "USD")} restant dû`,
              icone: <HourglassIcon className="size-5" />,
              href: "/factures",
            },
            {
              libelle: "À normaliser (e-DEF)",
              valeur: aNormaliser.length,
              detail: "Factures émises en pro forma",
              icone: <BadgeCheckIcon className="size-5" />,
              href: "/factures",
            },
          ]}
        />

        <Section className="grid gap-4 @4xl/main:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Impayés par ancienneté</CardTitle>
              <CardDescription>Jours de retard après échéance</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {TRANCHES.map((t) => {
                const b = balance[t.cle]
                return (
                  <div key={t.cle} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span>
                        {t.libelle} <span className="text-muted-foreground">({b.nb})</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatMontant(b.montant, "USD")}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" aria-hidden>
                      <div
                        className={t.cle === "non_echu" ? "h-2 rounded-full bg-chart-3" : t.cle === "0_30" ? "h-2 rounded-full bg-accent" : "h-2 rounded-full bg-destructive"}
                        style={{ width: `${totalImpaye ? (b.montant / totalImpaye) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Factures à émettre</CardTitle>
              <CardDescription>Devis signés sans facture, brouillons en attente</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col divide-y text-sm">
              {sansAcompte.length + soldesAEmettre.length + brouillons.length === 0 && (
                <p className="text-muted-foreground">Rien à émettre.</p>
              )}
              {sansAcompte.map((d) => (
                <Link key={`a-${d.id}`} href={`/dossiers/${d.dossier_id}?onglet=factures`} className="flex justify-between gap-2 py-2 hover:text-primary">
                  <span>
                    Acompte {d.acompte_pct} % — {d.numero} v{d.version} · {d.dossiers?.clients?.raison_sociale}
                  </span>
                  <span className="text-muted-foreground">{d.dossiers?.numero}</span>
                </Link>
              ))}
              {soldesAEmettre.map((d) => (
                <Link key={`s-${d.id}`} href={`/dossiers/${d.dossier_id}?onglet=factures`} className="flex justify-between gap-2 py-2 hover:text-primary">
                  <span>
                    Solde — {d.numero} v{d.version} · {d.dossiers?.clients?.raison_sociale}
                  </span>
                  <span className="text-muted-foreground">{d.dossiers?.numero}</span>
                </Link>
              ))}
              {brouillons.map((f) => (
                <Link key={f.id} href={`/dossiers/${f.dossier_id}?onglet=factures`} className="flex justify-between gap-2 py-2 hover:text-primary">
                  <span>
                    Brouillon {f.type} · {f.dossiers?.clients?.raison_sociale}
                  </span>
                  <span className="tabular-nums">{formatMontant(f.total_ttc, f.devise)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section>
          <Card>
            <CardHeader>
              <CardTitle>Factures ouvertes</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Reste dû</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ouvertes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                        Aucune facture ouverte.
                      </TableCell>
                    </TableRow>
                  )}
                  {[...ouvertes]
                    .sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""))
                    .map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <Link href={`/dossiers/${f.dossier_id}?onglet=factures`} className="font-medium text-primary hover:underline dark:text-foreground">
                            {f.numero}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{f.dossiers?.clients?.raison_sociale}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(f.echeance)}</TableCell>
                        <TableCell>
                          <FactureBadge statut={f.statut} />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">{formatMontant(f.solde_du, f.devise)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Section>
      </PageBody>
    </>
  )
}
