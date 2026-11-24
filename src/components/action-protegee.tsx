"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Bouton soumis à une permission : actif si `autorise`, sinon désactivé avec
 * une infobulle (survol ou focus clavier) expliquant pourquoi.
 */
export function ActionProtegee({
  autorise,
  raison,
  ...props
}: React.ComponentProps<typeof Button> & { autorise: boolean; raison: string }) {
  if (autorise) return <Button {...props} />
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} className="inline-flex rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" />}
        aria-label={raison}
      >
        <Button {...props} disabled aria-disabled onClick={undefined} />
      </TooltipTrigger>
      <TooltipContent>{raison}</TooltipContent>
    </Tooltip>
  )
}
