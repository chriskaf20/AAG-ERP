import type { Metadata } from "next"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { LECTURE_FOURNISSEURS } from "@/lib/permissions"
import { ListeFournisseurs } from "./liste"

export const metadata: Metadata = { title: "Fournisseurs" }

export default async function Fournisseurs() {
  const { supabase, organisation, permissions } = await exiger(...LECTURE_FOURNISSEURS)
  const { data, error } = await supabase.from("fournisseurs").select("*").eq("organization_id", organisation.id).order("nom")
  if (error) throw error
  return <>
    <SiteHeader titre="Fournisseurs" />
    <PageBody><Section><ListeFournisseurs fournisseurs={data} gestion={permissions.includes("fournisseurs.manage")} /></Section></PageBody>
  </>
}
