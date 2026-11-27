"use client"

import { useRef } from "react"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, FUSEAU_HORAIRE } from "@/lib/format"
import type { BonCommande } from "@/lib/achats"
import { receptionnerCommande } from "./actions"

const dateLocale = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSEAU_HORAIRE })

export function ReceptionsCommande({ bon, ecriture }: { bon: BonCommande; ecriture: boolean }) {
  const operation = useRef<string | null>(null)
  const quantites = new Map<string, number>()
  for (const r of bon.receptions) for (const l of r.lignes) {
    quantites.set(l.ligne_id, (quantites.get(l.ligne_id) ?? 0) + Math.round(l.quantite * 1000))
  }
  const restes = bon.lignes.map(l => {
    const recu = quantites.get(l.id) ?? 0
    return { ...l, recu: recu / 1000, reste: (Math.round(l.quantite * 1000) - recu) / 1000 }
  })
  const ouverts = restes.filter(l => l.reste > 0)

  return <div className="grid gap-2 rounded-md border p-3">
    <h3 className="font-medium">Réceptions</h3>
    <ul className="grid gap-1">
      {restes.map(l => <li key={l.id}>{l.description} · Reçu {l.recu}/{l.quantite} · Reste {l.reste}</li>)}
    </ul>
    {bon.receptions.map(r => <details key={r.id}>
      <summary className="cursor-pointer">{formatDate(r.date_reception)}{r.reference && " · " + r.reference}</summary>
      <ul className="pl-4">
        {r.lignes.map(l => <li key={l.id}>{bon.lignes.find(a => a.id === l.ligne_id)?.description} · {l.quantite}</li>)}
      </ul>
      {r.observations && <p className="whitespace-pre-wrap pl-4">{r.observations}</p>}
    </details>)}
    {ecriture && ouverts.length > 0 && <details>
      <summary className="cursor-pointer font-medium">Consigner une réception</summary>
      <div className="pt-3"><FormulaireOperation bouton="Enregistrer les quantités reçues" enregistrer={async fd => {
        operation.current ??= crypto.randomUUID()
        const resultat = await receptionnerCommande(bon.id, operation.current, fd)
        if ("ok" in resultat && resultat.ok) operation.current = null
        return resultat
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ nom="Date de réception"><Input type="date" name="date_reception" defaultValue={dateLocale.format(new Date())} required /></Champ>
          <Champ nom="Référence du bon de livraison"><Input name="reference" /></Champ>
          {ouverts.map(l => <Champ key={l.id} nom={l.description + " (reste " + l.reste + ")"}>
            <Input type="number" min={0} max={l.reste} step={0.001} name={"recu-" + l.id} />
          </Champ>)}
        </div>
        <Champ nom="Observations"><Textarea name="observations" /></Champ>
      </FormulaireOperation></div>
    </details>}
  </div>
}
