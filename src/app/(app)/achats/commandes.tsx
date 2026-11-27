"use client"

import { useState } from "react"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { formatDateHeure, formatMontant } from "@/lib/format"
import { STATUTS_BON, type BonCommande } from "@/lib/achats"
import { avancerCommande, enregistrerCommande } from "./actions"

type Choix = {
  fournisseurs: { id: string; nom: string; actif: boolean }[]
  departements: { id: string; nom: string }[]
  dossiers: { id: string; numero: string; department_id: string }[]
}

type Ligne = { id: string; description: string; quantite: number | string; prix_unitaire: number | string }
const vide = { description: "", quantite: 1, prix_unitaire: "" }

function FormulaireBon({ choix, bon }: { choix: Choix; bon?: BonCommande }) {
  const [departement, setDepartement] = useState(bon?.department_id ?? "")
  const [lignes, setLignes] = useState<Ligne[]>(bon?.lignes ?? [{ id: "initiale", ...vide }])
  return <FormulaireOperation bouton="Enregistrer le brouillon" reinitialiser={false} enregistrer={enregistrerCommande.bind(null, bon?.id ?? null)}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Champ nom="Objet"><Input name="objet" required maxLength={300} defaultValue={bon?.objet} /></Champ>
      <Champ nom="Fournisseur"><NativeSelect name="fournisseur" required defaultValue={bon?.fournisseur_id ?? ""}>
        <option value="">Sélectionner</option>
        {choix.fournisseurs.filter(f => f.actif || bon?.fournisseur_id === f.id)
          .map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
      </NativeSelect></Champ>
      <Champ nom="Département"><NativeSelect name="departement" required value={departement} onChange={e => setDepartement(e.target.value)}>
        <option value="">Sélectionner</option>
        {choix.departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
      </NativeSelect></Champ>
      <Champ nom="Dossier"><NativeSelect name="dossier" key={departement} defaultValue={departement === bon?.department_id ? bon.dossier_id ?? "" : ""}>
        <option value="">Achat de fonctionnement</option>
        {choix.dossiers.filter(d => d.department_id === departement).map(d => <option key={d.id} value={d.id}>{d.numero}</option>)}
      </NativeSelect></Champ>
      <Champ nom="Devise"><NativeSelect name="devise" defaultValue={bon?.devise ?? "USD"}><option value="USD">USD</option><option value="CDF">CDF</option></NativeSelect></Champ>
    </div>
    {lignes.map((l, i) => <fieldset key={l.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
      <legend className="px-1 text-sm">Ligne {i + 1}</legend>
      <Champ nom="Description"><Input name="description" required maxLength={500} defaultValue={l.description} /></Champ>
      <Champ nom="Quantité"><Input name="quantite" type="number" min={0.001} step={0.001} required defaultValue={l.quantite} /></Champ>
      <Champ nom="Prix unitaire HT"><Input name="prix_unitaire" type="number" min={0} step={0.01} required defaultValue={l.prix_unitaire} /></Champ>
      {lignes.length > 1 && <Button type="button" variant="ghost" className="self-end"
        onClick={() => setLignes(lignes.filter(x => x.id !== l.id))}>Retirer la ligne</Button>}
    </fieldset>)}
    <Button type="button" variant="outline" size="sm" className="self-start"
      onClick={() => setLignes([...lignes, { id: crypto.randomUUID(), ...vide }])}>Ajouter une ligne</Button>
  </FormulaireOperation>
}

export function Commandes({ commandes, choix, gestion, validation }: {
  commandes: BonCommande[]; choix: Choix; gestion: boolean; validation: boolean
}) {
  return <div className="grid gap-4">
    {gestion && choix.departements.length > 0 && <Card><CardContent>
      {choix.fournisseurs.some(f => f.actif) ? <details>
        <summary className="cursor-pointer font-medium">Nouveau bon de commande</summary>
        <div className="pt-3"><FormulaireBon choix={choix} /></div>
      </details> : <p>Ajoutez un fournisseur actif pour créer un bon de commande.</p>}
    </CardContent></Card>}
    {!commandes.length && <p className="text-sm text-muted-foreground">Aucun bon de commande visible.</p>}
    {commandes.map(bon => {
      const fournisseur = choix.fournisseurs.find(f => f.id === bon.fournisseur_id)
      const departement = choix.departements.find(d => d.id === bon.department_id)
      const dossier = choix.dossiers.find(d => d.id === bon.dossier_id)
      const ecriture = gestion && !!departement
      const ouvert = ["brouillon", "a_valider", "valide"].includes(bon.statut)
      return <Card key={bon.id} id={bon.id}>
        <CardHeader><CardTitle className="flex flex-wrap gap-2">{bon.numero && bon.numero + " · "}{bon.objet}
          <Badge variant="outline">{STATUTS_BON[bon.statut] ?? bon.statut}</Badge></CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>{[fournisseur?.nom, departement?.nom,
            dossier?.numero ?? (bon.dossier_id ? "Achat sur dossier" : "Achat de fonctionnement")].filter(Boolean).join(" · ")}</p>
          <ul className="grid gap-1">{bon.lignes.map(l => <li key={l.id}>{l.description} · {l.quantite} × {formatMontant(l.prix_unitaire, bon.devise)} HT</li>)}</ul>
          <p className="font-medium">{formatMontant(bon.total_ht, bon.devise)} HT · {formatMontant(bon.total_ttc, bon.devise)} TTC</p>
          {bon.valide_le && <p>Validé par le gérant le {formatDateHeure(bon.valide_le)}</p>}
          {bon.emis_le && <p>Émis le {formatDateHeure(bon.emis_le)} · <a href={"/pdf/commandes/" + bon.id} target="_blank" rel="noreferrer" className="underline">Ouvrir le bon PDF</a></p>}
          {bon.motif_annulation && <p>{bon.motif_annulation}</p>}
          {ecriture && bon.statut === "brouillon" && <details>
            <summary className="cursor-pointer">Modifier le brouillon</summary><div className="pt-3"><FormulaireBon choix={choix} bon={bon} /></div>
          </details>}
          <div className="flex flex-wrap gap-3">
            {ecriture && bon.statut === "brouillon" && <FormulaireOperation bouton="Soumettre" enregistrer={avancerCommande.bind(null, bon.id, "soumettre")} />}
            {validation && bon.statut === "a_valider" && <FormulaireOperation bouton="Valider" enregistrer={avancerCommande.bind(null, bon.id, "valider")} />}
            {ecriture && bon.statut === "valide" && <FormulaireOperation bouton="Émettre le bon" enregistrer={avancerCommande.bind(null, bon.id, "emettre")} />}
            {ecriture && ouvert && bon.statut !== "brouillon" && <FormulaireOperation bouton="Reprendre le brouillon" enregistrer={avancerCommande.bind(null, bon.id, "reprendre")} />}
          </div>
          {ecriture && ouvert && <details><summary className="cursor-pointer">Annuler le bon</summary>
            <div className="pt-3"><FormulaireOperation bouton="Confirmer l’annulation" enregistrer={avancerCommande.bind(null, bon.id, "annuler")}>
              <Champ nom="Motif"><Input name="motif" required /></Champ>
            </FormulaireOperation></div>
          </details>}
        </CardContent>
      </Card>
    })}
  </div>
}
