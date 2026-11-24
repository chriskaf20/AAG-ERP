import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import {
  ClipboardCheckIcon,
  FolderOpenIcon,
  HourglassIcon,
  SearchCheckIcon,
  UserCheckIcon,
} from "lucide-react"

import { ButtonLink } from "@/components/button-link"
import { PageBody, Section } from "@/components/page-body"
import { SectionCards, type StatCarte } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { StatutBadge } from "@/components/statut-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getContexte } from "@/lib/contexte"
import { formatDate } from "@/lib/format"
import { peut, STATUTS, STATUTS_TERMINAUX, type DossierStatut } from "@/lib/permissions"

export const metadata: Metadata = { title: "Tableau de bord" }

export default async function TableauDeBord() {
  const ctx = await getContexte()
  const { supabase, roles, userId } = ctx
  const t = await getTranslations()

  // Toutes les requêtes passent par la RLS : chaque rôle ne compte que ce qu'il voit.
  const [{ data: dossiers }, { data: aValider }] = await Promise.all([
    supabase
      .from("dossiers")
      .select("id, numero, statut, service, date_reception, responsable_id, created_at, clients(raison_sociale)")
      .eq("organization_id", ctx.organisation.id)
      .order("created_at", { ascending: false }),
    peut.decider(roles)
      ? supabase
          .from("verifications")
          .select("id, decision, verifie_le, dossiers!inner(id, numero, statut, clients(raison_sociale))")
          .eq("organization_id", ctx.organisation.id)
          .is("valide_le", null)
          .not("decision", "is", null)
          .eq("dossiers.statut", "en_verification")
      : Promise.resolve({ data: [] as never[] }),
  ])

  const liste = dossiers ?? []
  const parStatut = new Map<DossierStatut, number>()
  for (const d of liste) parStatut.set(d.statut, (parStatut.get(d.statut) ?? 0) + 1)
  const nb = (s: DossierStatut) => parStatut.get(s) ?? 0
  const actifs = liste.filter((d) => !STATUTS_TERMINAUX.includes(d.statut)).length

  const cartes: StatCarte[] = [
    {
      libelle: "Dossiers actifs",
      valeur: actifs,
      detail: `${liste.length} dossier${liste.length > 1 ? "s" : ""} au total`,
      icone: <FolderOpenIcon className="size-5" />,
      href: "/dossiers",
    },
    {
      libelle: t("statuts.nouveau"),
      valeur: nb("nouveau"),
      detail: "À mettre en vérification",
      icone: <HourglassIcon className="size-5" />,
      href: "/dossiers?statut=nouveau",
    },
    {
      libelle: t("statuts.en_verification"),
      valeur: nb("en_verification"),
      detail: "Fiche F-02 en cours",
      icone: <SearchCheckIcon className="size-5" />,
      href: "/dossiers?statut=en_verification",
    },
    {
      libelle: t("statuts.complement_requis"),
      valeur: nb("complement_requis"),
      detail: "En attente de pièces client",
      icone: <ClipboardCheckIcon className="size-5" />,
      href: "/dossiers?statut=complement_requis",
    },
  ]

  if (peut.decider(roles)) {
    cartes.unshift({
      libelle: "F-02 à valider",
      valeur: aValider?.length ?? 0,
      detail: "Décisions en attente de votre signature",
      icone: <UserCheckIcon className="size-5" />,
      accent: true,
    })
  } else if (roles.includes("responsable_dossier") && !peut.direction(roles)) {
    const miens = liste.filter((d) => d.responsable_id === userId && !STATUTS_TERMINAUX.includes(d.statut))
    cartes.unshift({
      libelle: "Mes dossiers actifs",
      valeur: miens.length,
      detail: "Dont je suis responsable",
      icone: <UserCheckIcon className="size-5" />,
      accent: true,
      href: "/dossiers?responsable=moi",
    })
  } else if (roles.includes("agent_terrain") && !peut.direction(roles)) {
    cartes.unshift({
      libelle: "Dossiers affectés",
      valeur: liste.length,
      detail: "Missions qui me sont confiées",
      icone: <UserCheckIcon className="size-5" />,
      accent: true,
      href: "/dossiers",
    })
  }

  const max = Math.max(1, ...parStatut.values())
  const statutsPresents = STATUTS.filter((s) => nb(s) > 0)

  return (
    <>
      <SiteHeader
        titre={`Bonjour ${ctx.profil?.nom_complet?.split(" ")[0] ?? ""}`.trim()}
        sousTitre={roles.map((r) => t(`roles.${r}`)).join(" · ")}
        actions={
          peut.creerDossier(roles) ? (
            <ButtonLink href="/dossiers/nouveau" size="sm">
              Nouveau dossier
            </ButtonLink>
          ) : null
        }
      />
      <PageBody>
        <SectionCards cartes={cartes.slice(0, 4)} />

        {peut.decider(roles) && (aValider?.length ?? 0) > 0 && (
          <Section>
            <Card className="border-accent/60">
              <CardHeader>
                <CardTitle>Fiches de vérification à valider</CardTitle>
                <CardDescription>Votre validation applique la décision au dossier.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {aValider!.map((v) => (
                  <Link
                    key={v.id}
                    href={`/dossiers/${v.dossiers.id}?onglet=verification`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 hover:text-primary"
                  >
                    <span className="font-medium">
                      {v.dossiers.numero} — {v.dossiers.clients?.raison_sociale}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Proposition : {v.decision ? t(`verification.decisions.${v.decision}`) : "—"}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </Section>
        )}

        <Section className="grid gap-4 @4xl/main:grid-cols-3">
          <Card className="@4xl/main:col-span-1">
            <CardHeader>
              <CardTitle>Répartition par statut</CardTitle>
              <CardDescription>Dossiers visibles selon votre rôle</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {statutsPresents.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun dossier.</p>
              )}
              {statutsPresents.map((s) => (
                <Link key={s} href={`/dossiers?statut=${s}`} className="group flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="group-hover:text-primary">{t(`statuts.${s}`)}</span>
                    <span className="font-medium tabular-nums">{nb(s)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" aria-hidden>
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(nb(s) / max) * 100}%` }}
                    />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="@4xl/main:col-span-2">
            <CardHeader>
              <CardTitle>Derniers dossiers</CardTitle>
              <CardDescription>Les 8 dossiers les plus récents</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden sm:table-cell">Reçu le</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.slice(0, 8).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Link href={`/dossiers/${d.id}`} className="font-medium text-primary hover:underline dark:text-foreground">
                          {d.numero}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{d.clients?.raison_sociale}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDate(d.date_reception)}</TableCell>
                      <TableCell>
                        <StatutBadge statut={d.statut} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {liste.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        Aucun dossier visible.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Section>
      </PageBody>
    </>
  )
}
