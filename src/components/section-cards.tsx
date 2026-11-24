import Link from "next/link"

import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatCarte = {
  libelle: string
  valeur: string | number
  detail?: string
  icone?: React.ReactNode
  href?: string
  accent?: boolean
}

/** Cartes de statistiques (bloc dashboard-01 « section cards » adapté). */
export function SectionCards({ cartes }: { cartes: StatCarte[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:px-6 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cartes.map((c) => {
        const contenu = (
          <Card
            className={cn(
              "@container/card h-full transition-colors",
              c.href && "hover:border-primary/40",
              c.accent && "border-accent/60"
            )}
          >
            <CardHeader>
              <CardDescription>{c.libelle}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {c.valeur}
              </CardTitle>
              {c.icone && (
                <CardAction className={cn("text-muted-foreground", c.accent && "text-accent")}>
                  {c.icone}
                </CardAction>
              )}
            </CardHeader>
            {c.detail && (
              <CardFooter className="text-sm text-muted-foreground">{c.detail}</CardFooter>
            )}
          </Card>
        )
        return c.href ? (
          <Link
            key={c.libelle}
            href={c.href}
            className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {contenu}
          </Link>
        ) : (
          <div key={c.libelle}>{contenu}</div>
        )
      })}
    </div>
  )
}
