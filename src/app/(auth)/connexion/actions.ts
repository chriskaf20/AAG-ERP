"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import type { EtatAction } from "@/lib/actions"
import { cheminSur } from "@/lib/redirection"
import { createClient } from "@/lib/supabase/server"

const schema = z.object({
  email: z.email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
})

export async function seConnecter(_: EtatAction, fd: FormData): Promise<EtatAction> {
  const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") })
  if (!parsed.success) {
    return { erreurs: z.flattenError(parsed.error).fieldErrors }
  }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return { message: "Email ou mot de passe incorrect" }
  }
  const suivant = fd.get("suivant")
  const cible = cheminSur(typeof suivant === "string" ? suivant : null)
  redirect(`/choisir-organisation?suivant=${encodeURIComponent(cible)}`)
}
