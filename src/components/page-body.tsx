import { cn } from "@/lib/utils"

/** Zone de contenu d'une page (marges du bloc dashboard-01). */
export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="@container/main flex flex-1 flex-col">
      <div className={cn("flex flex-col gap-4 py-4 md:gap-6 md:py-6", className)}>{children}</div>
    </div>
  )
}

/** Section avec marges horizontales standard */
export function Section({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("px-4 lg:px-6", className)}>{children}</section>
}
