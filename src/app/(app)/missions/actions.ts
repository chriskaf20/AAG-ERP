"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { messageErreur, texte } from "@/lib/actions"
import { getContexte } from "@/lib/contexte"

function resultat(mission: string, error: { message: string; code?: string } | null, message: string) {
  if (error) return { message: messageErreur(error) }
  revalidatePath("/missions")
  revalidatePath(`/missions/${mission}`)
  revalidatePath("/dossiers/[id]", "page")
  return { ok: true, message }
}

async function ouvrirRapportDeLaMission(mission: string, rapport: string) {
  const { supabase, organisation } = await getContexte()
  const { data, error } = await supabase
    .from("rapports_intervention")
    .select("id")
    .eq("id", rapport)
    .eq("mission_id", mission)
    .eq("organization_id", organisation.id)
    .maybeSingle()

  const refus = error ? { message: messageErreur(error) } : data ? null : { message: "Rapport indisponible" }
  return { supabase, refus }
}

export async function enregistrerRapport(mission: string, dossier: string, rapport: string | null, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const travaux = texte(fd, "travaux")
  if (!travaux) return { message: "Décrivez les travaux réalisés." }
  const valeurs = { travaux, observations: texte(fd, "observations") }
  const requete = rapport
    ? supabase.from("rapports_intervention").update(valeurs).eq("id", rapport).eq("mission_id", mission).eq("organization_id", organisation.id)
    : supabase.from("rapports_intervention").insert({ ...valeurs, organization_id: organisation.id, mission_id: mission, dossier_id: dossier })
  const { data, error } = await requete.select("id").maybeSingle()
  if (!error && !data) return { message: "Rapport indisponible ou non modifiable" }
  return resultat(mission, error, "Rapport enregistré")
}

export async function terminerRapport(mission: string, rapport: string, signature?: { nom: string; image: string }) {
  const { supabase, refus } = await ouvrirRapportDeLaMission(mission, rapport)
  if (refus) return refus
  if (signature && !z.object({ nom: z.string().trim().min(2).max(150), image: z.string().startsWith("data:image/png;base64,").max(700_000) }).safeParse(signature).success) {
    return { message: "Indiquez le nom du client et tracez sa signature." }
  }
  const { error } = signature
    ? await supabase.rpc("signer_rapport", { p_rapport: rapport, p_nom: signature.nom, p_image: signature.image })
    : await supabase.rpc("valider_rapport", { p_rapport: rapport })
  return resultat(mission, error, signature ? "Rapport signé par le client" : "Rapport validé")
}

export async function reprendreRapport(mission: string, rapport: string) {
  const { supabase, refus } = await ouvrirRapportDeLaMission(mission, rapport)
  if (refus) return refus
  const { error } = await supabase.rpc("nouvelle_version_rapport", { p_rapport: rapport })
  return resultat(mission, error, "Nouvelle version du rapport préparée")
}

export async function signalerIncident(dossier: string, mission: string | null, fd: FormData) {
  const { supabase, organisation } = await getContexte()
  const gravite = z.enum(["faible", "moyenne", "elevee"]).safeParse(texte(fd, "gravite"))
  const description = texte(fd, "description")
  if (!description || !gravite.success) return { message: "Renseignez la description et la gravité." }
  const { error } = await supabase.from("incidents").insert({
    organization_id: organisation.id, dossier_id: dossier, mission_id: mission, description, gravite: gravite.data,
  })
  return resultat(mission ?? "", error, "Incident signalé")
}
