"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { EtatAction } from "@/lib/actions"
import { ORG_COOKIE } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

import { SESSION_INVITEE, sessionInvitation } from "./session"
const jetonInvitation = z.string().regex(/^[a-zA-Z0-9_-]{16,256}$/)

export async function accepterInvitation(_: EtatAction, fd: FormData): Promise<EtatAction> {
  const jeton = jetonInvitation.safeParse(fd.get("token_hash"))
  if (!jeton.success) return { message: "Lien d’invitation invalide." }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ type: "invite", token_hash: jeton.data })
  if (error || !data.user || !data.session) return { message: "Ce lien est expiré ou a déjà été utilisé. Demandez une nouvelle invitation." }

  const jar = await cookies()
  jar.set(SESSION_INVITEE, data.user.id, {
    path: "/auth/invitation", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 900,
  })
  jar.delete(ORG_COOKIE)
  redirect("/auth/invitation")
}

export async function definirMotDePasse(_: EtatAction, fd: FormData): Promise<EtatAction> {
  const v = z.object({ motDePasse: z.string().min(6).max(72), confirmation: z.string() })
    .safeParse({ motDePasse: fd.get("password"), confirmation: fd.get("confirmation") })
  if (!v.success || v.data.motDePasse !== v.data.confirmation) {
    return { message: "Saisissez deux fois le même mot de passe de 6 à 72 caractères." }
  }
  const supabase = await sessionInvitation()
  if (!supabase) return { message: "Votre session d’activation a expiré." }
  const { error } = await supabase.auth.updateUser({ password: v.data.motDePasse })
  if (error) return { message: "Mot de passe refusé. Choisissez un autre mot de passe." }
  const jar = await cookies()
  jar.set(SESSION_INVITEE, "", { path: "/auth/invitation", maxAge: 0 })
  redirect("/choisir-organisation")
}
