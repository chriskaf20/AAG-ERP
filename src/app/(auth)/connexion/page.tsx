import type { Metadata } from "next"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormulaireConnexion } from "./formulaire-connexion"

export const metadata: Metadata = { title: "Connexion" }

export default async function PageConnexion({ searchParams }: PageProps<"/connexion">) {
  const { suivant } = await searchParams
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>Accédez à votre espace de travail</CardDescription>
      </CardHeader>
      <CardContent>
        <FormulaireConnexion suivant={typeof suivant === "string" ? suivant : undefined} />
      </CardContent>
    </Card>
  )
}
