"use client"

import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NativeSelect } from "@/components/ui/native-select"
import type { Database } from "@/lib/database.types"

import { rattacherCompte, retirerCompte } from "@/app/(app)/documents/actions-portail"

type Compte = Database["public"]["Functions"]["portail_comptes_gerant"]["Returns"][number]

export function ComptesPortail({ client, comptes }: { client: string; comptes: Compte[] }) {
  const rattaches = comptes.filter(c => c.client_id === client)
  const candidats = comptes.filter(c => c.client_id === null)
  return <Card>
    <CardHeader><CardTitle>Accès au portail client</CardTitle></CardHeader>
    <CardContent className="grid gap-4">
      {rattaches.length === 0 && <p className="text-sm text-muted-foreground">Aucun compte rattaché.</p>}
      {rattaches.map(c => <div key={c.user_id} className="flex flex-wrap items-center gap-3">
        <span>{c.nom ?? c.email}{c.nom && c.email ? " · " + c.email : ""}</span>
        <FormulaireOperation bouton="Retirer l’accès" enregistrer={retirerCompte.bind(null, client, c.user_id)} />
      </div>)}
      {candidats.length > 0 ? <FormulaireOperation bouton="Rattacher le compte" enregistrer={rattacherCompte.bind(null, client)}>
        <Champ nom="Compte avec le rôle Client"><NativeSelect name="compte" required defaultValue="">
          <option value="">Sélectionner</option>
          {candidats.map(c => <option key={c.user_id} value={c.user_id}>
            {c.nom ?? c.email}{c.nom && c.email ? " · " + c.email : ""}
          </option>)}
        </NativeSelect></Champ>
      </FormulaireOperation> : <p className="text-sm text-muted-foreground">Les comptes disponibles se gèrent dans Utilisateurs avec le rôle Client.</p>}
    </CardContent>
  </Card>
}
