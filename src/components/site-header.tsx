import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

/** En-tête de page (bloc dashboard-01 adapté) : bouton sidebar, titre, actions. */
export function SiteHeader({
  titre,
  sousTitre,
  actions,
}: {
  titre: React.ReactNode
  sousTitre?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 flex min-h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex w-full items-center gap-1 px-4 py-2 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{titre}</h1>
          {sousTitre && <p className="truncate text-xs text-muted-foreground">{sousTitre}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
