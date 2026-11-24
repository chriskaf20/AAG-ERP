import { redirect } from "next/navigation"

import { getContexte } from "@/lib/contexte"
import { accueil } from "@/lib/navigation"

export default async function Accueil() {
  const { permissions } = await getContexte()
  redirect(accueil(permissions))
}
