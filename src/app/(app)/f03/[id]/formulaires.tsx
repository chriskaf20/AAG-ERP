"use client"

import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import { CHAMPS_F03, type ContenuF03 } from "@/lib/f03"

import { consignerAccordF03, deciderF03, enregistrerF03 } from "../actions"

export function EditeurF03({ dossier, version, modifieLe, contenu }: {
  dossier: string
  version: number
  modifieLe: string | null
  contenu: ContenuF03
}) {
  const { enCours, run } = useAction()
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const soumettre = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "soumettre"
      run(() => enregistrerF03(dossier, version, modifieLe, soumettre, fd))
    }}>
      {CHAMPS_F03.map(champ => <Champ key={champ.nom} nom={champ.libelle}>
        {champ.nom === "date_mise_en_ligne"
          ? <Input type="date" name={champ.nom} defaultValue={contenu[champ.nom]} />
          : <Textarea name={champ.nom} defaultValue={contenu[champ.nom]} maxLength={4000} rows={2}
            placeholder={"aide" in champ ? champ.aide : undefined} />}
      </Champ>)}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="outline" disabled={enCours}>Enregistrer le brouillon</Button>
        <Button type="submit" value="soumettre" disabled={enCours}>Soumettre à Digital</Button>
      </div>
    </form>
  )
}

export function DecisionDigital({ dossier, version }: { dossier: string; version: number }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <FormulaireOperation bouton="Valider cette version" enregistrer={fd => deciderF03(dossier, version, true, fd)} />
    <FormulaireOperation bouton="Demander des corrections" enregistrer={fd => deciderF03(dossier, version, false, fd)}>
      <Champ nom="Motif"><Textarea name="motif" required maxLength={4000} /></Champ>
    </FormulaireOperation>
  </div>
}

export function ConsignationAccord({ dossier, version, aujourdHui }: { dossier: string; version: number; aujourdHui: string }) {
  return <FormulaireOperation bouton="Consigner l’accord client" enregistrer={fd => consignerAccordF03(dossier, version, fd)}>
    <Champ nom="Date de l’accord"><Input name="date" type="date" required max={aujourdHui} /></Champ>
    <Champ nom="Référence de l’accord"><Textarea name="reference" required maxLength={4000}
      placeholder="Ex. courriel du client ou pièce déposée dans les documents du dossier" /></Champ>
  </FormulaireOperation>
}
