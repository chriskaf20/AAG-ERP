import "server-only"

import { forbidden } from "next/navigation"
import { getContexte } from "@/lib/contexte"

export async function exigerPortail() {
  const ctx = await getContexte()
  if (!ctx.roles.includes("client")) forbidden()
  return ctx
}
