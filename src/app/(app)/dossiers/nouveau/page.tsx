import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { membresOrganisation } from "@/lib/membres"
import { a } from "@/lib/permissions"
import { FormulaireF01 } from "./formulaire-f01"

export const metadata: Metadata = { title: "Nouveau dossier (F-01)" }

export default async function NouveauDossier() {
  const ctx = await exiger("dossiers.create")
  const { supabase, organisation } = ctx

  const [{ data: clients }, { data: departements }, membres] = await Promise.all([
    supabase
      .from("clients")
      .select("id, raison_sociale, type, adresse, telephone, email, contacts(id, nom, fonction, telephone, email)")
      .eq("organization_id", organisation.id)
      .order("raison_sociale"),
    supabase.from("departments").select("id, code, nom").eq("organization_id", organisation.id).order("code"),
    membresOrganisation(ctx, ["gerant", "directeur_commercial", "directeur_operations", "responsable_departement", "responsable_dossier"]),
  ])

  // Un responsable de dossier sans autre rôle ne peut créer que ses propres dossiers
  const seulementSoi =
    !a(ctx.permissions, "dossiers.read_all") && !a(ctx.permissions, "dossiers.read_dept")

  return (
    <>
      <SiteHeader titre="Nouveau dossier" sousTitre="Fiche d'ouverture F-01 — le numéro est attribué à l'enregistrement" />
      <PageBody>
        <Section className="max-w-4xl">
          <FormulaireF01
            clients={clients ?? []}
            departements={departements ?? []}
            responsables={seulementSoi ? membres.filter((m) => m.id === ctx.userId) : membres}
            userId={ctx.userId}
            devise={organisation.devise}
          />
        </Section>
      </PageBody>
    </>
  )
}
