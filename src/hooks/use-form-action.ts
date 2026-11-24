"use client"

import { startTransition, useActionState } from "react"

import type { EtatAction } from "@/lib/actions"

/**
 * Comme useActionState, mais soumis via onSubmit : le formulaire n'est pas
 * réinitialisé par React en cas d'erreur de validation.
 */
export function useFormAction(action: (etat: EtatAction, fd: FormData) => Promise<EtatAction>) {
  const [etat, dispatch, enCours] = useActionState(action, null)
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => dispatch(fd))
  }
  return [etat, onSubmit, enCours] as const
}
