import { redirect } from "next/navigation"

import { getContexte } from "@/lib/contexte"
import { accueil } from "@/lib/navigation"

export default async function Accueil() {
  const { permissions, roles } = await getContexte()
  if (permissions.length === 0 && roles.includes("client")) redirect("/portail")
  redirect(accueil(permissions))
}
