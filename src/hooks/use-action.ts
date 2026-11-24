"use client"

import { useTransition } from "react"
import { toast } from "sonner"

type Res = { ok?: boolean; message?: string; data?: unknown } | null | undefined

/** Exécute une Server Action et affiche le résultat (toast). */
export function useAction() {
  const [enCours, start] = useTransition()
  const run = <R extends Res>(fn: () => Promise<R>, onOk?: (r: NonNullable<R>) => void) =>
    start(async () => {
      const r = await fn()
      if (r?.ok) {
        if (r.message) toast.success(r.message)
        onOk?.(r as NonNullable<R>)
      } else {
        toast.error(r?.message ?? "Une erreur est survenue")
      }
    })
  return { enCours, run }
}
