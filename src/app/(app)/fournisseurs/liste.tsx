"use client"

import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Tables } from "@/lib/database.types"
import { enregistrerFournisseur } from "./actions"

type Fournisseur = Tables<"fournisseurs">

function Formulaire({ fournisseur: f }: { fournisseur?: Fournisseur }) {
  return <FormulaireOperation bouton="Enregistrer le fournisseur" enregistrer={enregistrerFournisseur.bind(null, f?.id ?? null)}
    reinitialiser={!f}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Champ nom="Nom"><Input name="nom" required maxLength={200} defaultValue={f?.nom} /></Champ>
      <Champ nom="Catégorie"><Input name="categorie" defaultValue={f?.categorie ?? ""} /></Champ>
      <Champ nom="RCCM"><Input name="rccm" defaultValue={f?.rccm ?? ""} /></Champ>
      <Champ nom="NIF"><Input name="nif" defaultValue={f?.nif ?? ""} /></Champ>
      <Champ nom="Contact"><Input name="contact" defaultValue={f?.contact ?? ""} /></Champ>
      <Champ nom="E-mail"><Input type="email" name="email" defaultValue={f?.email ?? ""} /></Champ>
      <Champ nom="Téléphone"><Input type="tel" name="telephone" defaultValue={f?.telephone ?? ""} /></Champ>
      <Champ nom="Évaluation (1 à 5)"><Input type="number" name="evaluation" min={1} max={5} defaultValue={f?.evaluation ?? ""} /></Champ>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="actif" defaultChecked={f?.actif ?? true} /> Actif</label>
  </FormulaireOperation>
}

export function ListeFournisseurs({ fournisseurs, gestion }: { fournisseurs: Fournisseur[]; gestion: boolean }) {
  return <div className="grid gap-4">
    {gestion && <Card><CardContent><details>
      <summary className="cursor-pointer font-medium">Nouveau fournisseur</summary>
      <div className="pt-3"><Formulaire /></div>
    </details></CardContent></Card>}
    {!fournisseurs.length && <p className="text-sm text-muted-foreground">Aucun fournisseur enregistré.</p>}
    {fournisseurs.map(f => <Card key={f.id}>
      <CardHeader><CardTitle className="flex flex-wrap gap-2">{f.nom}{!f.actif && <Badge variant="outline">Inactif</Badge>}</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p>{[f.categorie, f.contact, f.email, f.telephone].filter(Boolean).join(" · ")}</p>
        {(f.rccm || f.nif) && <p>{[f.rccm && "RCCM " + f.rccm, f.nif && "NIF " + f.nif].filter(Boolean).join(" · ")}</p>}
        {f.evaluation !== null && <p>Évaluation {f.evaluation}/5</p>}
        {gestion && <details><summary className="cursor-pointer">Modifier la fiche</summary><div className="pt-3"><Formulaire fournisseur={f} /></div></details>}
      </CardContent>
    </Card>)}
  </div>
}
