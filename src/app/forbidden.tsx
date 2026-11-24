import Link from "next/link"
import { ShieldXIcon } from "lucide-react"

export default function Interdit() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldXIcon className="size-10 text-destructive" aria-hidden />
      <h1 className="text-xl font-semibold">Accès refusé (403)</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Vos rôles ne donnent pas accès à cette page. Contactez votre administrateur si vous pensez que c&apos;est une erreur.
      </p>
      <Link href="/tableau-de-bord" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Retour au tableau de bord
      </Link>
    </main>
  )
}
