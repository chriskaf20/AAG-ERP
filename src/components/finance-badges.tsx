import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import type { Enums } from "@/lib/database.types"
import { cn } from "@/lib/utils"

const DEVIS: Record<Enums<"devis_statut">, string> = {
  brouillon: "border-border bg-muted text-muted-foreground",
  valide: "border-chart-3/40 bg-chart-3/15 text-chart-3 dark:text-foreground",
  envoye: "border-accent/50 bg-accent/15 text-foreground",
  signe: "border-success/40 bg-success/15 text-success",
  refuse: "border-destructive/40 bg-destructive/10 text-destructive",
  expire: "border-warning/40 bg-warning/15 text-warning",
  remplace: "border-border bg-muted text-muted-foreground line-through",
}

const FACTURE: Record<Enums<"facture_statut">, string> = {
  brouillon: "border-border bg-muted text-muted-foreground",
  emise: "border-primary/30 bg-primary/10 text-primary dark:text-foreground",
  normalisee: "border-chart-3/40 bg-chart-3/15 text-chart-3 dark:text-foreground",
  partiellement_payee: "border-accent/50 bg-accent/15 text-foreground",
  payee: "border-success/40 bg-success/15 text-success",
  en_retard: "border-destructive/40 bg-destructive/10 text-destructive",
  annulee: "border-border bg-muted text-muted-foreground line-through",
}

export function DevisBadge({ statut, className }: { statut: Enums<"devis_statut">; className?: string }) {
  const t = useTranslations("devisStatuts")
  return (
    <Badge variant="outline" className={cn(DEVIS[statut], className)}>
      {t(statut)}
    </Badge>
  )
}

export function FactureBadge({ statut, className }: { statut: Enums<"facture_statut">; className?: string }) {
  const t = useTranslations("factureStatuts")
  return (
    <Badge variant="outline" className={cn(FACTURE[statut], className)}>
      {t(statut)}
    </Badge>
  )
}
