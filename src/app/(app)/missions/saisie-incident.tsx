"use client"

import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { signalerIncident } from "./actions"

export function SaisieIncident({ dossier, mission = null }: { dossier: string; mission?: string | null }) {
  return <FormulaireOperation bouton="Signaler l’incident" enregistrer={signalerIncident.bind(null, dossier, mission)}>
    <Champ nom="Description"><Textarea name="description" required /></Champ>
    <Champ nom="Gravité"><NativeSelect name="gravite"><option value="faible">Faible</option><option value="moyenne">Moyenne</option><option value="elevee">Élevée</option></NativeSelect></Champ>
  </FormulaireOperation>
}
