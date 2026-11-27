"use server"

import { headers } from "next/headers"
import { z } from "zod"

import { archiverDevisSigne } from "@/lib/documents-figes"
import { createAdminClient } from "@/lib/supabase/admin"

const schema = z.object({
  jeton: z.string().regex(/^[0-9a-f]{64}$/),
  nom: z.string().trim().min(2, "Indiquez votre nom complet").max(150),
  image: z
    .string()
    .startsWith("data:image/png;base64,", "Signature manquante")
    .max(700_000, "Signature trop volumineuse"),
  accord: z.literal(true, "Vous devez accepter le document"),
})

export type EtatSignature = { ok?: boolean; message?: string } | null

export async function signer(entree: z.input<typeof schema>): Promise<EtatSignature> {
  const parsed = schema.safeParse(entree)
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Données invalides" }

  const h = await headers()
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null
  const ua = h.get("user-agent")

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("signer_par_lien", {
    p_token: parsed.data.jeton,
    p_nom: parsed.data.nom,
    p_image: parsed.data.image,
    p_ip: ip as unknown as string,
    p_user_agent: ua ?? "",
  })
  if (error) return { message: error.message }

  const res = data as { objet_type: string; objet_id: string }
  if (res.objet_type === "devis") {
    try {
      await archiverDevisSigne(res.objet_id)
    } catch {
      console.warn("Archivage de devis à reprendre", res.objet_id)
    }
  }
  return { ok: true, message: "Merci, votre signature a bien été enregistrée." }
}
