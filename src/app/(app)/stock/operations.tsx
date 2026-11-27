"use client"

import { useRef } from "react"

import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import type { ArticleStock, EmplacementStock } from "@/lib/achats"

import { ajouterArticle, ajouterEmplacement, definirDefaut, mouvementStock } from "./actions"

function Emplacements({ emplacements }: { emplacements: EmplacementStock[] }) {
  return <Champ nom="Emplacement"><NativeSelect name="emplacement" required defaultValue={emplacements.find(e => e.par_defaut)?.id}>
    {emplacements.map(e => <option value={e.id} key={e.id}>{e.nom}{e.par_defaut ? " (par défaut)" : ""}</option>)}
  </NativeSelect></Champ>
}

function Mouvement({ articles, emplacements, type }: {
  articles: ArticleStock[]; emplacements: EmplacementStock[]; type: "sortie" | "ajustement"
}) {
  const operation = useRef<string | null>(null)
  const sortie = type === "sortie"
  return <FormulaireOperation bouton={sortie ? "Enregistrer la sortie" : "Enregistrer l’ajustement"} enregistrer={async fd => {
    operation.current ??= crypto.randomUUID()
    const resultat = await mouvementStock(type, operation.current, fd)
    if ("ok" in resultat && resultat.ok) operation.current = null
    return resultat
  }}>
    <Champ nom="Article"><NativeSelect name="article" required defaultValue="">
      <option value="">Sélectionner</option>
      {articles.map(a => <option value={a.id} key={a.id}>{a.code} · {a.nom} ({a.unite})</option>)}
    </NativeSelect></Champ>
    <Emplacements emplacements={emplacements} />
    <Champ nom={sortie ? "Quantité sortie" : "Variation de quantité (+ ou −)"}>
      <Input name="quantite" type="number" step={0.001} min={sortie ? 0.001 : undefined} required />
    </Champ>
    <Champ nom="Motif"><Input name="motif" maxLength={500} required={!sortie} /></Champ>
  </FormulaireOperation>
}

export function OperationsStock({ articles, emplacements, parametrer }: {
  articles: ArticleStock[]; emplacements: EmplacementStock[]; parametrer: boolean
}) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium">Créer un article</summary>
      <div className="pt-3"><FormulaireOperation bouton="Ajouter l’article" enregistrer={ajouterArticle}>
        <Champ nom="Code"><Input name="code" maxLength={50} required /></Champ>
        <Champ nom="Nom"><Input name="nom" maxLength={200} required /></Champ>
        <Champ nom="Unité"><Input name="unite" maxLength={30} required /></Champ>
      </FormulaireOperation></div>
    </details>
    <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium">Créer un emplacement</summary>
      <div className="pt-3"><FormulaireOperation bouton="Ajouter l’emplacement" enregistrer={ajouterEmplacement}>
        <Champ nom="Nom"><Input name="nom" maxLength={120} required /></Champ>
      </FormulaireOperation></div>
    </details>
    {articles.length > 0 && <>
      <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium">Consigner une sortie</summary>
        <div className="pt-3"><Mouvement articles={articles} emplacements={emplacements} type="sortie" /></div>
      </details>
      <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium">Ajuster une quantité</summary>
        <div className="pt-3"><Mouvement articles={articles} emplacements={emplacements} type="ajustement" /></div>
      </details>
    </>}
    {parametrer && emplacements.length > 1 &&
      <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium">Changer l’emplacement par défaut</summary>
        <div className="pt-3"><FormulaireOperation bouton="Définir par défaut" enregistrer={definirDefaut} reinitialiser={false}>
          <Emplacements emplacements={emplacements} />
        </FormulaireOperation></div>
      </details>}
  </div>
}
