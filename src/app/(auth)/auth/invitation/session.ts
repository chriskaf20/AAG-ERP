import "server-only"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export const SESSION_INVITEE = "atlas_activation"

export async function sessionInvitation() {
  const jar = await cookies()
  const invite = jar.get(SESSION_INVITEE)?.value
  if (!invite) return null
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims?.sub === invite ? supabase : null
}
