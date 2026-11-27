import Link from "next/link"
import { exigerPortail } from "@/lib/portail"

export default async function LayoutPortail({ children }: { children: React.ReactNode }) {
  const ctx = await exigerPortail()
  return <div className="min-h-svh">
    <header className="border-b">
      <nav aria-label="Portail client" className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 p-4">
        <Link href="/portail" className="font-semibold">{ctx.organisation.nom} · Portail client</Link>
        {ctx.organisations.length > 1 && <Link href="/choisir-organisation?suivant=/portail" className="text-sm underline">Changer d’organisation</Link>}
        {ctx.permissions.length > 0 && <Link href="/profil" className="text-sm underline">Espace interne</Link>}
        <form action="/auth/deconnexion" method="post" className="ml-auto">
          <button type="submit" className="text-sm underline">Se déconnecter</button>
        </form>
      </nav>
    </header>
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6">{children}</main>
  </div>
}
