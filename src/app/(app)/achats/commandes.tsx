"use client"

import { useState } from "react"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { formatDateHeure, formatMontant } from "@/lib/format"
import { STATUTS_BON, type ArticleStock, type BonCommande, type EmplacementStock } from "@/lib/achats"
import { avancerCommande, enregistrerCommande, remplacerCommande } from "./actions"
import { ReceptionsCommande } from "./receptions"

type Choix = {
  articles: ArticleStock[]
  emplacements: EmplacementStock[]
  fournisseurs: { id: string; nom: string; actif: boolean }[]
  departements: { id: string; nom: string }[]
  dossiers: { id: string; numero: string; department_id: string }[]
}

type Ligne = { id: string; article_id: string | null; description: string; quantite: number | string; prix_unitaire: number | string }
const vide = { article_id: null, description: "", quantite: 1, prix_unitaire: "" }

function FormulaireBon({ choix, bon }: { choix: Choix; bon?: BonCommande }) {
  const estRemplacement = !!bon?.bon_origine_id
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
      <Champ nom="Département"><NativeSelect name="departement" required disabled={estRemplacement} value={departement} onChange={e => setDepartement(e.target.value)}>
        <option value="">Sélectionner</option>
        {choix.departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
      </NativeSelect></Champ>
      <Champ nom="Dossier"><NativeSelect name="dossier" disabled={estRemplacement} key={departement} defaultValue={departement === bon?.department_id ? bon.dossier_id ?? "" : ""}>
        <option value="">Achat de fonctionnement</option>
        {choix.dossiers.filter(d => d.department_id === departement).map(d => <option key={d.id} value={d.id}>{d.numero}</option>)}
      </NativeSelect></Champ>
      <Champ nom="Devise"><NativeSelect name="devise" defaultValue={bon?.devise ?? "USD"}><option value="USD">USD</option><option value="CDF">CDF</option></NativeSelect></Champ>
    </div>
    {estRemplacement && <><input type="hidden" name="departement" value={departement} />
      <input type="hidden" name="dossier" value={bon.dossier_id ?? ""} /></>}
    {lignes.map((l, i) => <fieldset key={l.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-5">
      <legend className="px-1 text-sm">Ligne {i + 1}</legend>
      <Champ nom="Article de stock"><NativeSelect name="article_id" disabled={estRemplacement} defaultValue={l.article_id ?? ""}>
        <option value="">Hors stock</option>
        {choix.articles.map(a => <option key={a.id} value={a.id}>{a.code} · {a.nom} ({a.unite})</option>)}
      </NativeSelect></Champ>
      {estRemplacement && <input type="hidden" name="article_id" value={l.article_id ?? ""} />}
      <Champ nom="Description"><Input name="description" required readOnly={estRemplacement} maxLength={500} defaultValue={l.description} /></Champ>
      <Champ nom="Quantité"><Input name="quantite" readOnly={estRemplacement} type="number" min={0.001} step={0.001} required defaultValue={l.quantite} /></Champ>
      <Champ nom="Prix unitaire HT"><Input name="prix_unitaire" type="number" min={0} step={0.01} required defaultValue={l.prix_unitaire} /></Champ>
      {!estRemplacement && lignes.length > 1 && <Button type="button" variant="ghost" className="self-end"
        onClick={() => setLignes(lignes.filter(x => x.id !== l.id))}>Retirer la ligne</Button>}
    </fieldset>)}
    {!estRemplacement && <Button type="button" variant="outline" size="sm" className="self-start"
      onClick={() => setLignes([...lignes, { id: crypto.randomUUID(), ...vide }])}>Ajouter une ligne</Button>}
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
      const origine = commandes.find(c => c.id === bon.bon_origine_id)
      const remplacement = commandes.find(c => c.bon_origine_id === bon.id)
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
          {bon.motif_annulation && <p>Motif de l’annulation : {bon.motif_annulation}</p>}
          {origine && <a className="underline" href={"#" + origine.id}>Remplace le bon {origine.numero}</a>}
          {remplacement && <a className="underline" href={"#" + remplacement.id}>Bon de remplacement{remplacement.numero ? " " + remplacement.numero : " (brouillon)"}</a>}
          {bon.emis_le && <ReceptionsCommande bon={bon} ecriture={ecriture} emplacements={choix.emplacements} />}
          {ecriture && bon.statut === "brouillon" && <details>
            <summary className="cursor-pointer">Modifier le brouillon</summary><div className="pt-3"><FormulaireBon choix={choix} bon={bon} /></div>
          </details>}
          <div className="flex flex-wrap gap-3">
            {ecriture && bon.statut === "brouillon" && <FormulaireOperation bouton="Soumettre" enregistrer={avancerCommande.bind(null, bon.id, "soumettre")} />}
            {validation && bon.statut === "a_valider" && <FormulaireOperation bouton="Valider" enregistrer={avancerCommande.bind(null, bon.id, "valider")} />}
            {ecriture && bon.statut === "valide" && <FormulaireOperation bouton="Émettre le bon" enregistrer={avancerCommande.bind(null, bon.id, "emettre")} />}
            {ecriture && ouvert && bon.statut !== "brouillon" && <FormulaireOperation bouton="Reprendre le brouillon" enregistrer={avancerCommande.bind(null, bon.id, "reprendre")} />}
          </div>
          {ecriture && (bon.statut === "emis" || bon.statut === "recu_partiel") && <details>
            <summary className="cursor-pointer">Annuler et remplacer le reliquat</summary>
            <div className="pt-3"><FormulaireOperation bouton="Créer le bon de remplacement" enregistrer={remplacerCommande.bind(null, bon.id)}>
              <p>Les réceptions restent sur ce bon. Le reliquat passe dans un nouveau brouillon à soumettre.</p>
              <Champ nom="Motif"><Input name="motif" required /></Champ>
            </FormulaireOperation></div>
          </details>}
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
