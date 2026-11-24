import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getTranslations } from "next-intl/server"

import { getContexte } from "@/lib/contexte"
import { menuNavigation } from "@/lib/navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexte()
  const [groupes, t] = await Promise.all([menuNavigation(ctx.permissions), getTranslations("roles")])

  if (ctx.permissions.length === 0) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="text-lg font-semibold">Portail client</h1>
          <p className="text-sm text-muted-foreground">
            Le portail client sera disponible dans une prochaine version.
          </p>
          <form action="/auth/deconnexion" method="post">
            <button type="submit" className="text-sm text-primary underline-offset-4 hover:underline">
              Se déconnecter
            </button>
          </form>
        </div>
      </main>
    )
  }

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
