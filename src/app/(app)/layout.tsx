import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getTranslations } from "next-intl/server"
import { forbidden } from "next/navigation"

import { getContexte } from "@/lib/contexte"
import { menuNavigation } from "@/lib/navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexte()
  if (ctx.permissions.length === 0) forbidden()
  const [groupes, t] = await Promise.all([menuNavigation(ctx.permissions, ctx.roles.includes("client")), getTranslations("roles")])

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        organisation={{
          id: ctx.organisation.id,
          nom: ctx.organisation.nom,
          sigle: ctx.organisation.sigle,
        }}
        organisations={ctx.organisations}
        utilisateur={{
          nom: ctx.profil?.nom_complet || ctx.email,
          email: ctx.email,
          roles: ctx.roles.map((r) => t(r)).join(", "),
        }}
        groupes={groupes}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
