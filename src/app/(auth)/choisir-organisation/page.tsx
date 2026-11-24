import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2Icon, ChevronRightIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cheminSur } from "@/lib/redirection"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Choisir l'organisation" }

type Org = { id: string; nom: string; sigle: string | null }

export default async function ChoisirOrganisation({
  searchParams,
}: PageProps<"/choisir-organisation">) {
  const { suivant } = await searchParams
  const cible = cheminSur(typeof suivant === "string" ? suivant : null)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/connexion")

  const { data } = await supabase
    .from("user_roles")
    .select("organizations(id, nom, sigle)")
    .eq("user_id", user.id)
    .neq("role", "client")

  const parId = new Map<string, Org>()
  for (const r of data ?? []) {
    if (r.organizations) parId.set(r.organizations.id, r.organizations)
  }
  const orgs = [...parId.values()]

  const lien = (id: string) => `/auth/organisation?id=${id}&suivant=${encodeURIComponent(cible)}`

  if (orgs.length === 1) redirect(lien(orgs[0]!.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Choisir l&apos;organisation</CardTitle>
        <CardDescription>
          {orgs.length === 0
            ? "Votre compte n'est rattaché à aucune organisation. Contactez votre administrateur."
            : "Sélectionnez l'entreprise sur laquelle travailler."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {orgs.map((o) => (
          <Link
            key={o.id}
            href={lien(o.id)}
            prefetch={false}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Building2Icon className="size-5 text-primary" aria-hidden />
            <span className="flex-1">
              <span className="block font-medium">{o.nom}</span>
              {o.sigle && <span className="block text-xs text-muted-foreground">{o.sigle}</span>}
            </span>
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
        <form action="/auth/deconnexion" method="post" className="pt-2">
          <button
            type="submit"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Se déconnecter
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
