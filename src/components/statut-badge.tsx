import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import type { DossierStatut } from "@/lib/permissions"
import { cn } from "@/lib/utils"

const STYLES: Record<DossierStatut, string> = {
  nouveau: "border-primary/30 bg-primary/10 text-primary dark:text-foreground",
  en_verification: "border-chart-3/40 bg-chart-3/15 text-chart-3 dark:text-foreground",
  complement_requis: "border-warning/40 bg-warning/15 text-warning",
  accepte: "border-success/40 bg-success/15 text-success",
  devis_envoye: "border-accent/50 bg-accent/15 text-foreground",
  en_lancement: "border-accent/50 bg-accent/15 text-foreground",
  en_cours: "border-accent/50 bg-accent/25 text-foreground",
  livre: "border-success/40 bg-success/10 text-success",
  reserves: "border-warning/40 bg-warning/15 text-warning",
  receptionne_a_facturer: "border-success/40 bg-success/10 text-success",
  cloture: "border-border bg-muted text-muted-foreground",
  refuse: "border-destructive/40 bg-destructive/10 text-destructive",
  classe_sans_suite: "border-border bg-muted text-muted-foreground",
}

export function StatutBadge({ statut, className }: { statut: DossierStatut; className?: string }) {
  const t = useTranslations("statuts")
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[statut], className)}>
      {t(statut)}
    </Badge>
  )
}
