import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PageBody, Section } from "@/components/page-body"
import { PiecesManager } from "@/components/pieces-manager"
import { SiteHeader } from "@/components/site-header"
import { StatutBadge } from "@/components/statut-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getContexte } from "@/lib/contexte"
import { formatDate } from "@/lib/format"
import { peut } from "@/lib/permissions"
import { modifierClient } from "../actions"
import { ClientForm } from "../client-form"
import { Contacts } from "./contacts"

export const metadata: Metadata = { title: "Fiche client" }

export default async function FicheClient({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params
  const { supabase, roles, organisation } = await getContexte()

  const [{ data: client }, { data: contacts }, { data: documents }, { data: dossiers }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase.from("contacts").select("*").eq("client_id", id).order("nom"),
      supabase
        .from("documents")
        .select("id, type, libelle, nom_fichier, version, taille, created_at, est_signe")
        .eq("client_id", id)
        .is("dossier_id", null),
      supabase
        .from("dossiers")
        .select("id, numero, service, statut, date_reception")
        .eq("client_id", id)
        .order("date_reception", { ascending: false }),
    ])

  if (!client) notFound()
  const ecriture = peut.ecrireClients(roles)

  return (
    <>
      <SiteHeader titre={client.raison_sociale} sousTitre={client.type === "entreprise" ? "Entreprise" : "Particulier"} />
      <PageBody>
        <Section>
          <Tabs defaultValue="infos">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
              <TabsTrigger value="infos">Informations</TabsTrigger>
              <TabsTrigger value="contacts">Contacts ({contacts?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="pieces">Pièces</TabsTrigger>
              <TabsTrigger value="dossiers">Dossiers ({dossiers?.length ?? 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="infos" className="pt-4">
              <Card>
                <CardContent>
                  <ClientForm
                    action={modifierClient.bind(null, client.id)}
                    valeurs={client}
                    lectureSeule={!ecriture}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="contacts" className="pt-4">
              <Contacts clientId={client.id} contacts={contacts ?? []} peutEcrire={ecriture} />
            </TabsContent>
            <TabsContent value="pieces" className="pt-4">
              <PiecesManager
                titre="Pièces du client"
                description="PDF ou image, 20 Mo maximum. Un nouveau dépôt crée une nouvelle version."
                bucket="clients"
                orgId={organisation.id}
                clientId={client.id}
                types={
                  client.type === "entreprise"
                    ? ["rccm", "nif", "id_nat", "piece_identite", "autre"]
                    : ["piece_identite", "autre"]
                }
                documents={documents ?? []}
                peutEcrire={ecriture}
              />
            </TabsContent>
            <TabsContent value="dossiers" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dossiers du client</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  {(dossiers ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun dossier visible.</p>
                  )}
                  {(dossiers ?? []).map((d) => (
                    <Link
                      key={d.id}
                      href={`/dossiers/${d.id}`}
                      className="flex flex-wrap items-center gap-2 py-2 hover:text-primary"
                    >
                      <span className="font-medium">{d.numero}</span>
                      <span className="flex-1 truncate text-sm text-muted-foreground">
                        {d.service} · {formatDate(d.date_reception)}
                      </span>
                      <StatutBadge statut={d.statut} />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Section>
      </PageBody>
    </>
  )
}
