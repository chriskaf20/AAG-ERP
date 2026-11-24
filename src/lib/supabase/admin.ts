import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import { SUPABASE_URL } from "./env"

/**
 * Client service_role : contourne la RLS. Réservé aux actions serveur
 * d'administration (invitation d'utilisateurs), après contrôle des droits.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante (.env.local)")
  }
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
