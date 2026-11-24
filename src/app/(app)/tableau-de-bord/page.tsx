import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import {
  BellIcon,
  ClipboardCheckIcon,
  FolderOpenIcon,
  HandCoinsIcon,
  HourglassIcon,
  SearchCheckIcon,
  SendIcon,
  UserCheckIcon,
} from "lucide-react"

import { ButtonLink } from "@/components/button-link"
import { PageBody, Section } from "@/components/page-body"
import { SectionCards, type StatCarte } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { StatutBadge } from "@/components/statut-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getContexte, getOrgId, getSupabase } from "@/lib/contexte"
import { formatDate, formatMontant } from "@/lib/format"
import type { Indicateurs } from "@/lib/indicateurs"
import { cartesIndicateurs } from "@/lib/indicateurs-cartes"
import { accueil } from "@/lib/navigation"
import { a, aUne, LECTURE_DOSSIERS, STATUTS, STATUTS_TERMINAUX, type DossierStatut } from "@/lib/permissions"

export const metadata: Metadata = { title: "Tableau de bord" }

const PROCHAINE_ACTION: Partial<Record<DossierStatut, string>> = {
  nouveau: "Lancer la vérification",
  en_verification: "Compléter la fiche F-02",
  complement_requis: "Relancer le client pour les pièces",
  accepte: "Établir le devis",
  devis_envoye: "Obtenir la signature, l'acompte et le PV F-04",
  en_lancement: "Démarrer les prestations",
}

/** Accueil : blocs affichés selon l'union des permissions de l'utilisateur. */
export default async function TableauDeBord() {
  const [supabase, orgId] = await Promise.all([getSupabase(), getOrgId()])
  const [ctx, t, { data: brut }] = await Promise.all([
    getContexte(),
    getTranslations(),
    supabase.rpc("donnees_accueil", { p_org: orgId }),
  ])
  const p = ctx.permissions
  if (accueil(p) !== "/tableau-de-bord") redirect(accueil(p))

  const lit = aUne(p, ...LECTURE_DOSSIERS)
  type Cli = { raison_sociale: string } | null
  const acc = (brut ?? {}) as unknown as {
    dossiers: { id: string; numero: string; statut: DossierStatut; service: string; date_reception: string; responsable_id: string | null; clients: Cli }[] | null
    verifs: { id: string; decision: "accepte" | "complement_requis" | "refuse"; dossiers: { id: string; numero: string; clients: Cli } }[] | null
    devis_a_valider: { id: string; numero: string; version: number; total_ttc_usd: number; dossier_id: string; dossiers: { numero: string; clients: Cli } }[] | null
    devis_a_envoyer: { id: string; numero: string; version: number; statut: string; depasse_seuil: boolean; total_ttc: number; devise: string; dossier_id: string; dossiers: { numero: string; clients: Cli } }[] | null
    factures: { id: string; type: string; statut: string; solde_du: number | null; devise: string; taux_cdf: number; echeance: string | null }[] | null
    notifications: { id: string; titre: string; message: string | null; lien: string | null }[]
    indicateurs: Indicateurs | null
  }
  const dossiers = acc.dossiers
  const verifs = acc.verifs
  const devisAValider = acc.devis_a_valider
  const devisAEnvoyer = acc.devis_a_envoyer
  const factures = acc.factures
  const notifs = acc.notifications
  const ind = acc.indicateurs

  const liste = dossiers ?? []
  const nb = (s: DossierStatut) => liste.filter((d) => d.statut === s).length
  const usd = (m: number, devise: string, taux: number) => (devise === "CDF" ? m / taux : m)
  const cartes: StatCarte[] = []

  if (a(p, "dossiers.decide") || a(p, "devis.validate")) {
    cartes.push({
      libelle: "Validations en attente",
      valeur: (verifs?.length ?? 0) + (devisAValider?.length ?? 0),
      detail: `${verifs?.length ?? 0} fiche(s) F-02, ${devisAValider?.length ?? 0} devis au-dessus du seuil`,
      icone: <UserCheckIcon className="size-5" />,
      accent: true,
    })
  }
  if (a(p, "devis.send")) {
    cartes.push({
      libelle: "Devis à envoyer",
      valeur: devisAEnvoyer?.length ?? 0,
      detail: "Soumis par les responsables de dossier",
      icone: <SendIcon className="size-5" />,
      accent: true,
    })
  }
  if (a(p, "factures.write") && factures) {
    const ouvertes = factures.filter((f) => !["brouillon", "payee", "annulee"].includes(f.statut) && (f.solde_du ?? 0) > 0)
    const acomptes = ouvertes.filter((f) => f.type === "acompte")
    const echus = ouvertes.filter((f) => f.echeance && f.echeance < new Date().toISOString().slice(0, 10))
    cartes.push(
      {
        libelle: "Acomptes à encaisser",
        valeur: formatMontant(acomptes.reduce((s, f) => s + usd(f.solde_du ?? 0, f.devise, f.taux_cdf), 0), "USD"),
        detail: `${acomptes.length} facture(s)`,
        icone: <HandCoinsIcon className="size-5" />,
        href: "/finance",
      },
      {
        libelle: "Factures à émettre",
        valeur: factures.filter((f) => f.statut === "brouillon").length,
        detail: "Brouillons en attente",
        icone: <ClipboardCheckIcon className="size-5" />,
        href: "/finance",
      },
      {
        libelle: "Impayés échus",
        valeur: formatMontant(echus.reduce((s, f) => s + usd(f.solde_du ?? 0, f.devise, f.taux_cdf), 0), "USD"),
        detail: `${echus.length} facture(s)`,
        icone: <HourglassIcon className="size-5" />,
        href: "/finance",
      }
    )
  }
  if (lit) {
    const actifs = liste.filter((d) => !STATUTS_TERMINAUX.includes(d.statut))
    cartes.push(
      {
        libelle: a(p, "dossiers.read_own") && !a(p, "dossiers.read_all") ? "Mes dossiers actifs" : "Dossiers actifs",
        valeur: actifs.length,
        detail: `${liste.length} visible(s)`,
        icone: <FolderOpenIcon className="size-5" />,
        href: "/dossiers",
      },
      {
        libelle: t("statuts.en_verification"),
        valeur: nb("en_verification") + nb("complement_requis"),
        detail: "En vérification ou complément requis",
        icone: <SearchCheckIcon className="size-5" />,
        href: "/dossiers?statut=en_verification",
      }
    )
  }

  const mesDossiers = a(p, "dossiers.verify")
    ? liste.filter((d) => d.responsable_id === ctx.userId && PROCHAINE_ACTION[d.statut])
    : []
  const repartition = STATUTS.filter((s) => nb(s) > 0)
  const max = Math.max(1, ...repartition.map(nb))

  return (
    <>
      <SiteHeader
        titre={`Bonjour ${ctx.profil?.nom_complet?.split(" ")[0] ?? ""}`.trim()}
        sousTitre={ctx.roles.map((r) => t(`roles.${r}`)).join(" · ")}
        actions={
          a(p, "dossiers.create") ? (
            <ButtonLink href="/dossiers/nouveau" size="sm">
              Nouveau dossier
            </ButtonLink>
          ) : null
        }
      />
      <PageBody>
        {cartes.length > 0 && <SectionCards cartes={cartes.slice(0, 8)} />}
        {ind && <SectionCards cartes={cartesIndicateurs(ind)} />}

        {(notifs?.length ?? 0) > 0 && (
          <Section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BellIcon className="size-4" aria-hidden /> Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {notifs!.map((n) => (
                  <Link key={n.id} href={n.lien ?? "#"} className="flex flex-col py-2 hover:text-primary">
                    <span className="font-medium">{n.titre}</span>
                    {n.message && <span className="text-sm text-muted-foreground">{n.message}</span>}
                  </Link>
                ))}
              </CardContent>
            </Card>
          </Section>
        )}

        {((verifs?.length ?? 0) > 0 || (devisAValider?.length ?? 0) > 0 || (devisAEnvoyer?.length ?? 0) > 0) && (
          <Section>
            <Card className="border-accent/60">
              <CardHeader>
                <CardTitle>À traiter</CardTitle>
                <CardDescription>Décisions et envois qui vous reviennent</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {(verifs ?? []).map((v) => (
                  <Link key={v.id} href={`/dossiers/${v.dossiers.id}?onglet=verification`} className="flex flex-wrap justify-between gap-2 py-2 hover:text-primary">
                    <span className="font-medium">F-02 — {v.dossiers.numero} · {v.dossiers.clients?.raison_sociale}</span>
                    <span className="text-sm text-muted-foreground">Proposition : {v.decision ? t(`verification.decisions.${v.decision}`) : "—"}</span>
                  </Link>
                ))}
                {(devisAValider ?? []).map((d) => (
                  <Link key={d.id} href={`/dossiers/${d.dossier_id}?onglet=devis`} className="flex flex-wrap justify-between gap-2 py-2 hover:text-primary">
                    <span className="font-medium">Valider le devis {d.numero} v{d.version} · {d.dossiers?.clients?.raison_sociale}</span>
                    <span className="text-sm tabular-nums">{formatMontant(d.total_ttc_usd, "USD")}</span>
                  </Link>
                ))}
                {(devisAEnvoyer ?? []).map((d) => (
                  <Link key={d.id} href={`/dossiers/${d.dossier_id}?onglet=devis`} className="flex flex-wrap justify-between gap-2 py-2 hover:text-primary">
                    <span className="font-medium">Envoyer le devis {d.numero} v{d.version} · {d.dossiers?.clients?.raison_sociale}</span>
                    <span className="text-sm text-muted-foreground">
                      {d.depasse_seuil && d.statut !== "valide" ? "En attente de validation du gérant" : formatMontant(d.total_ttc, d.devise)}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </Section>
        )}

        {mesDossiers.length > 0 && (
          <Section>
            <Card>
              <CardHeader>
                <CardTitle>Mes dossiers et prochaines actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {mesDossiers.map((d) => (
                  <Link key={d.id} href={`/dossiers/${d.id}`} className="flex flex-wrap items-center gap-2 py-2 hover:text-primary">
                    <span className="font-medium">{d.numero}</span>
                    <StatutBadge statut={d.statut} />
                    <span className="flex-1 truncate text-sm text-muted-foreground">{d.clients?.raison_sociale}</span>
                    <span className="text-sm">{PROCHAINE_ACTION[d.statut]}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </Section>
        )}

        {lit && (
          <Section className="grid gap-4 @4xl/main:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Répartition par statut</CardTitle>
                <CardDescription>Dossiers visibles selon vos rôles</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {repartition.length === 0 && <p className="text-sm text-muted-foreground">Aucun dossier.</p>}
                {repartition.map((s) => (
                  <Link key={s} href={`/dossiers?statut=${s}`} className="group flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="group-hover:text-primary">{t(`statuts.${s}`)}</span>
                      <span className="font-medium tabular-nums">{nb(s)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" aria-hidden>
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(nb(s) / max) * 100}%` }} />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card className="@4xl/main:col-span-2">
              <CardHeader>
                <CardTitle>Derniers dossiers</CardTitle>
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
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Section>
        )}

        {!lit && !ind && (
          <Section>
            <Card>
              <CardHeader>
                <CardTitle>Administration</CardTitle>
                <CardDescription>Votre rôle ne donne pas accès aux données métier.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {a(p, "admin.users") && <ButtonLink href="/admin/utilisateurs" variant="outline">Utilisateurs</ButtonLink>}
                {a(p, "admin.settings") && <ButtonLink href="/admin/parametres" variant="outline">Paramètres</ButtonLink>}
                {a(p, "audit.read") && <ButtonLink href="/admin/audit" variant="outline">Journal d&apos;audit</ButtonLink>}
              </CardContent>
            </Card>
          </Section>
        )}
      </PageBody>
    </>
  )
}
