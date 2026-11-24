import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody, Section } from "@/components/page-body"
import { PiecesManager } from "@/components/pieces-manager"
import { SiteHeader } from "@/components/site-header"
import { StatutBadge } from "@/components/statut-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { exiger } from "@/lib/contexte"
import { formatDate, formatDateHeure, formatMontant } from "@/lib/format"
import { membresOrganisation } from "@/lib/membres"
import { LECTURE_DOSSIERS, transitionsManuelles, type DroitsDossier } from "@/lib/permissions"
import { ActionsStatut } from "./actions-statut"
import { Affectations } from "./affectations"
import { VerificationF02 } from "./verification-f02"
import { Contrats, PvLancement } from "./contrats-pv"
import { chargerFinanceDossier } from "./finance-donnees"
import { OngletDevis } from "./onglet-devis"
import { OngletFactures } from "./onglet-factures"

export const metadata: Metadata = { title: "Dossier" }

const ONGLETS = ["resume", "client", "verification", "devis", "factures", "documents", "historique"] as const

export default async function FicheDossier({ params, searchParams }: PageProps<"/dossiers/[id]">) {
  const { id } = await params
  const { onglet } = await searchParams
  const ctx = await exiger(...LECTURE_DOSSIERS, "dossiers.read_assigned")
  const { supabase, organisation } = ctx
  const t = await getTranslations()

  const [{ data: droitsBruts }, { data: d }] = await Promise.all([
    supabase.rpc("droits_dossier", { p_dossier: id }),
    supabase
    .from("dossiers")
    .select(
      "*, clients(*), contacts(*), departments(code, nom), profiles!dossiers_responsable_id_fkey(nom_complet)"
    )
    .eq("id", id)
    .maybeSingle(),
  ])
  if (!d) notFound()
  const droits = droitsBruts as unknown as DroitsDossier

  const [
    { data: verifications },
    { data: documents },
    { data: piecesClient },
    { data: historique },
    { data: affectations },
    membres,
  ] = await Promise.all([
    supabase.from("verifications").select("*").eq("dossier_id", id).order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, type, libelle, nom_fichier, version, taille, created_at, est_signe")
      .eq("dossier_id", id),
    supabase
      .from("documents")
      .select("id, type, libelle, nom_fichier, version, taille, created_at, est_signe")
      .eq("client_id", d.client_id)
      .is("dossier_id", null),
    supabase
      .from("dossier_status_history")
      .select("id, ancien_statut, nouveau_statut, motif, created_at, created_by")
      .eq("dossier_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("dossier_affectations").select("id, user_id").eq("dossier_id", id),
    membresOrganisation(ctx),
  ])

  const nom = (uid: string | null) => membres.find((m) => m.id === uid)?.nom ?? "—"

  const pilote = droits.verify
  const transitions = transitionsManuelles(d.statut, droits)
  const fin = droits.devis_read || droits.factures_read ? await chargerFinanceDossier(ctx, d.id) : null
  const enrichir = <T extends { verifie_par: string | null; valide_par: string | null }>(v: T) => ({
    ...v,
    verificateur: v.verifie_par ? nom(v.verifie_par) : null,
    validateur: v.valide_par ? nom(v.valide_par) : null,
  })
  const brouillon = verifications?.find((v) => !v.valide_le)
  const validees = (verifications ?? []).filter((v) => v.valide_le).map(enrichir)

  const ongletInitial = ONGLETS.includes(onglet as (typeof ONGLETS)[number])
    ? (onglet as string)
    : "resume"

  const ligne = (libelle: string, valeur: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="col-span-2">{valeur || "—"}</dd>
    </div>
  )

  return (
    <>
      <SiteHeader
        titre={
          <span className="flex items-center gap-2">
            {d.numero} <StatutBadge statut={d.statut} />
          </span>
        }
        sousTitre={`${d.clients?.raison_sociale ?? ""} · ${d.service}`}
        actions={<ActionsStatut dossierId={d.id} transitions={transitions} />}
      />
      <PageBody>
        {d.statut_motif && ["complement_requis", "refuse", "classe_sans_suite"].includes(d.statut) && (
          <Section>
            <Alert variant={d.statut === "refuse" ? "destructive" : "default"}>
              <AlertTitle>{t(`statuts.${d.statut}`)}</AlertTitle>
              <AlertDescription>{d.statut_motif}</AlertDescription>
            </Alert>
          </Section>
        )}
        <Section>
          <Tabs defaultValue={ongletInitial}>
            <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
              <TabsTrigger value="resume">Résumé</TabsTrigger>
              <TabsTrigger value="client">Client et pièces</TabsTrigger>
              <TabsTrigger value="verification">
                Vérification
                {brouillon?.decision && droits.decide && (
                  <span className="ml-1 size-2 rounded-full bg-accent" aria-label="à valider" />
                )}
              </TabsTrigger>
              {droits.devis_read && <TabsTrigger value="devis">Devis et contrat</TabsTrigger>}
              {droits.factures_read && <TabsTrigger value="factures">Factures et paiements</TabsTrigger>}
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="historique">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="resume" className="grid gap-4 pt-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Fiche d&apos;ouverture F-01</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y">
                    {ligne("Numéro", d.numero)}
                    {ligne("Date de réception", formatDate(d.date_reception))}
                    {ligne("Canal", t(`canaux.${d.canal}`))}
                    {ligne("Service demandé", d.service)}
                    {ligne("Besoin", <span className="whitespace-pre-line">{d.besoin}</span>)}
                    {ligne("Délai souhaité", formatDate(d.delai_souhaite))}
                    {ligne("Budget indicatif", formatMontant(d.budget_indicatif, d.budget_devise))}
                  </dl>
                </CardContent>
              </Card>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pilotage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y">
                      {ligne("Département", d.departments ? `${d.departments.code} — ${d.departments.nom}` : null)}
                      {ligne("Responsable", d.profiles?.nom_complet)}
                      {ligne(
                        "Pièces reçues",
                        d.pieces_recues.length ? (
                          <span className="flex flex-wrap gap-1">
                            {d.pieces_recues.map((p) => (
                              <Badge key={p} variant="outline">
                                {t(`pieces.${p}`)}
                              </Badge>
                            ))}
                            {d.pieces_autres && <span className="text-muted-foreground">({d.pieces_autres})</span>}
                          </span>
                        ) : null
                      )}
                      {ligne("Accusé de réception", d.accuse_reception_envoye ? "Envoyé" : "Non envoyé")}
                      {ligne("Créé le", formatDateHeure(d.created_at))}
                    </dl>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Affectations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Affectations
                      dossierId={d.id}
                      affectations={(affectations ?? []).map((a) => ({ ...a, nom: nom(a.user_id) }))}
                      candidats={membres.filter((m) => m.roles.includes("agent_terrain"))}
                      peutModifier={pilote}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="client" className="grid gap-4 pt-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Link href={`/clients/${d.client_id}`} className="hover:underline">
                      {d.clients?.raison_sociale}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y">
                    {ligne("Type", d.clients ? t(`clientTypes.${d.clients.type}`) : null)}
                    {ligne("RCCM", d.clients?.rccm)}
                    {ligne("NIF", d.clients?.nif)}
                    {ligne("Id. Nat.", d.clients?.id_nat)}
                    {ligne("Adresse", d.clients?.adresse)}
                    {ligne(
                      "Contact",
                      d.contacts
                        ? [d.contacts.nom, d.contacts.fonction].filter(Boolean).join(" — ")
                        : null
                    )}
                    {ligne("Téléphone", d.contacts?.telephone ?? d.clients?.telephone)}
                    {ligne("Email", d.contacts?.email ?? d.clients?.email)}
                  </dl>
                </CardContent>
              </Card>
              <PiecesManager
                titre="Pièces du client"
                bucket="clients"
                orgId={organisation.id}
                clientId={d.client_id}
                types={
                  d.clients?.type === "particulier"
                    ? ["piece_identite", "autre"]
                    : ["rccm", "nif", "id_nat", "piece_identite", "autre"]
                }
                documents={piecesClient ?? []}
                peutEcrire={droits.clients_write}
              />
            </TabsContent>

            <TabsContent value="verification" className="pt-4">
              <VerificationF02
                dossierId={d.id}
                statutDossier={d.statut}
                brouillon={brouillon ? enrichir(brouillon) : null}
                validees={validees}
                peutRemplir={pilote}
                peutValider={droits.decide}
              />
            </TabsContent>

            {fin && droits.devis_read && (
              <TabsContent value="devis" className="flex flex-col gap-4 pt-4">
                <OngletDevis
                  dossierId={d.id}
                  peutCreer={["accepte", "devis_envoye", "en_lancement", "en_cours", "livre", "reserves"].includes(d.statut)}
                  devis={fin.devis}
                  services={fin.services}
                  droits={droits}
                  seuilUsd={fin.seuilUsd}
                  emailClient={d.contacts?.email ?? d.clients?.email ?? null}
                />
                <PvLancement
                  key={fin.pv?.id ?? "nouveau"}
                  dossierId={d.id}
                  pv={fin.pv}
                  signatures={fin.pvSignatures}
                  devisSignes={fin.devisSignes}
                  pilote={droits.devis_write}
                  emailClient={d.contacts?.email ?? d.clients?.email ?? null}
                  disponible={fin.devisSignes.length > 0}
                />
                <Contrats dossierId={d.id} contrats={fin.contrats} devisSignes={fin.devisSignes} pilote={droits.devis_write} />
              </TabsContent>
            )}
            {fin && droits.factures_read && (
              <TabsContent value="factures" className="pt-4">
                <OngletFactures
                  dossierId={d.id}
                  factures={fin.factures}
                  devisSignes={fin.devisSignes}
                  services={fin.services}
                  droits={droits}
                  relances={fin.relances}
                />
              </TabsContent>
            )}
            <TabsContent value="documents" className="pt-4">
              <PiecesManager
                titre="Documents du dossier"
                description={`Classés dans dossiers/${d.numero}. Un nouveau dépôt crée une nouvelle version.`}
                bucket="dossiers"
                orgId={organisation.id}
                dossier={{ id: d.id, numero: d.numero }}
                types={["accuse_reception", "fiche_ouverture", "fiche_verification", "autre"]}
                documents={documents ?? []}
                peutEcrire={pilote}
              />
            </TabsContent>

            <TabsContent value="historique" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Historique des statuts</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="relative flex flex-col gap-4 border-l pl-6">
                    {(historique ?? []).map((h) => (
                      <li key={h.id} className="relative">
                        <span className="absolute top-1.5 -left-[1.9rem] size-3 rounded-full border-2 border-background bg-accent" aria-hidden />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {h.ancien_statut && <StatutBadge statut={h.ancien_statut} />}
                          <span aria-hidden>→</span>
                          <StatutBadge statut={h.nouveau_statut} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateHeure(h.created_at)} · {nom(h.created_by)}
                        </p>
                        {h.motif && <p className="mt-1 text-sm">{h.motif}</p>}
                      </li>
                    ))}
                    <li className="relative">
                      <span className="absolute top-1.5 -left-[1.9rem] size-3 rounded-full border-2 border-background bg-primary" aria-hidden />
                      <p className="text-sm font-medium">Dossier ouvert</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateHeure(d.created_at)} · {nom(d.created_by)}
                      </p>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Section>
      </PageBody>
    </>
  )
}
