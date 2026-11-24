import { redirect } from "next/navigation"

import { getContexte } from "@/lib/contexte"
import { peut } from "@/lib/permissions"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { roles } = await getContexte()
  if (!peut.administrer(roles)) redirect("/tableau-de-bord")
  return children
}
