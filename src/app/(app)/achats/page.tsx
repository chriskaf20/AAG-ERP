import type { Metadata } from "next"
import { ButtonLink } from "@/components/button-link"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { Commandes } from "./commandes"

export const metadata: Metadata = { title: "Achats" }

export default async function Achats() {
  const ctx = await exiger("achats.read")
  const { supabase, organisation, permissions, roles, departements, departementsOrg, userId } = ctx
  const gestion = permissions.includes("achats.write")
  const porteeGlobale = roles.includes("gerant") || roles.includes("directeur_operations")
  const [commandes, lignes, receptions, quantites, fournisseurs, dossiers, acheteur] = await Promise.all([
    supabase.from("bons_commande").select("*").eq("organization_id", organisation.id).order("created_at", { ascending: false }),
    supabase.from("bon_commande_lignes").select("*").eq("organization_id", organisation.id).order("ordre"),
    supabase.from("receptions_achat").select("*").eq("organization_id", organisation.id).order("created_at"),
    supabase.from("reception_achat_lignes").select("*").eq("organization_id", organisation.id),
    supabase.from("fournisseurs").select("id, nom, actif").eq("organization_id", organisation.id).order("nom"),
    supabase.from("dossiers").select("id, numero, department_id").eq("organization_id", organisation.id).order("numero"),
    gestion && !porteeGlobale ? supabase.from("user_roles").select("department_id")
      .eq("organization_id", organisation.id).eq("user_id", userId).eq("role", "acheteur") : null,
  ])
  for (const resultat of [commandes, lignes, receptions, quantites, fournisseurs, dossiers, acheteur]) if (resultat?.error) throw resultat.error
  const departementsVisibles = !gestion || porteeGlobale ? departementsOrg : departementsOrg.filter(d =>
    departements.includes(d.id) && acheteur?.data?.some(r => r.department_id === d.id))
  return <>
    <SiteHeader titre="Bons de commande" actions={<ButtonLink href="/fournisseurs" variant="outline" size="sm">Fournisseurs</ButtonLink>} />
    <PageBody><Section><Commandes
      commandes={(commandes.data ?? []).map(b => ({
        ...b, lignes: (lignes.data ?? []).filter(l => l.bon_id === b.id),
        receptions: (receptions.data ?? []).filter(r => r.bon_id === b.id)
          .map(r => ({ ...r, lignes: (quantites.data ?? []).filter(l => l.reception_id === r.id) })),
      }))}
      choix={{ fournisseurs: fournisseurs.data ?? [], departements: departementsVisibles, dossiers: dossiers.data ?? [] }}
      gestion={gestion} validation={permissions.includes("achats.validate")} /></Section></PageBody>
  </>
}
