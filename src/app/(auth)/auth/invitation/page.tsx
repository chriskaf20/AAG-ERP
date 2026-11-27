import type { Metadata } from "next"
import Link from "next/link"
import { FormulaireInvitation } from "./formulaire"
import { sessionInvitation } from "./session"

export const metadata: Metadata = {
  title: "Invitation · Atlas",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}

export default async function PageInvitation({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: jeton } = await searchParams
  const aUnLien = typeof jeton === "string" && /^[a-zA-Z0-9_-]{16,256}$/.test(jeton)
  const active = !aUnLien && await sessionInvitation()
  return <div className="grid gap-4">
    <h1 className="text-xl font-semibold">{active ? "Choisir votre mot de passe" : "Invitation à l’ERP Atlas"}</h1>
    {aUnLien || active ? <FormulaireInvitation jeton={aUnLien ? jeton : undefined} /> : <>
      <p>Ouvrez le lien reçu par email. Si l’invitation a expiré, demandez un nouvel envoi.</p>
      <Link className="underline" href="/connexion">Retour à la connexion</Link>
    </>}
  </div>
}
