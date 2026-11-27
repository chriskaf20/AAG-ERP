"use client"

import { useState } from "react"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { SaisieSignature } from "@/components/saisie-signature"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { formatDateHeure } from "@/lib/format"
import type { FicheMission } from "@/lib/missions"
import { SaisieIncident } from "../saisie-incident"
import { enregistrerRapport, reprendreRapport, terminerRapport } from "../actions"
import { DepotPhotos } from "./depot-photos"
import { PositionRapport } from "./position-rapport"

export function RapportsMission({ fiche }: { fiche: FicheMission }) {
  const [depotEnAttente, setDepotEnAttente] = useState(false)
  const { mission, dossier, rapports } = fiche
  const actif = ["en_cours", "reserves"].includes(dossier.statut) && mission.statut !== "annulee"
  const recent = rapports[0]
  const brouillon = recent && !recent.signe_le && !recent.valide_le ? recent : null
  return <>
    <Card>
      <CardHeader><CardTitle>Rapport d’intervention</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        {!recent && <p className="text-sm text-muted-foreground">Aucun rapport saisi.</p>}
        {fiche.peut_rediger && actif && (!recent || brouillon) &&
          <FormulaireOperation key={brouillon?.id ?? "nouveau"} bouton="Enregistrer le rapport" reinitialiser={false}
            enregistrer={enregistrerRapport.bind(null, mission.id, dossier.id, brouillon?.id ?? null)}>
            <Champ nom="Travaux réalisés"><Textarea name="travaux" required defaultValue={brouillon?.travaux} /></Champ>
            <Champ nom="Observations"><Textarea name="observations" defaultValue={brouillon?.observations ?? ""} /></Champ>
            {mission.type === "terrain" && <PositionRapport initiale={brouillon && brouillon.latitude !== null && brouillon.longitude !== null ? {
              latitude: brouillon.latitude, longitude: brouillon.longitude, precision_m: brouillon.precision_m,
            } : null} />}
          </FormulaireOperation>}
        {rapports.map(r => <article key={r.id} className="grid gap-3 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className="font-medium">Version {r.version}</span>
            <Badge variant="outline">{r.signe_le ? "Signé par le client" : r.valide_le ? "Validé" : "Brouillon"}</Badge>
          </div>
          <a href={"/pdf/interventions/" + r.id} target="_blank" rel="noreferrer" className="w-fit underline">Ouvrir le rapport PDF</a>
          <p className="whitespace-pre-wrap">{r.travaux}</p>
          {r.observations && <p className="whitespace-pre-wrap">{r.observations}</p>}
          {r.latitude !== null && r.longitude !== null && <p>Position GPS {r.latitude}, {r.longitude}</p>}
          {r.redacteur && <p>Rédigé par {r.redacteur}</p>}
          {r.valide_le && <p>Validé par {r.valideur ?? "le responsable"} · {formatDateHeure(r.valide_le)}</p>}
          {r.signature && <div className="grid gap-2">
            <p>Signé par {r.signature.nom} · {formatDateHeure(r.signature.signe_le)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.signature.image} alt={`Signature de ${r.signature.nom}`} className="max-h-24 max-w-full rounded border bg-white object-contain sm:w-64" />
          </div>}
          {r.photos.length > 0 && <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{r.photos.map((p, index) =>
            <li key={p.id}>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.legende ?? `Photo ${index + 1} du rapport`} className="aspect-square w-full rounded-md object-cover" loading="lazy" />
            </a> : <p>Photo indisponible</p>}</li>)}</ul>}
          {actif && r.id === brouillon?.id && mission.type === "terrain" && <>
            {fiche.peut_rediger && <DepotPhotos rapport={r} onAttente={setDepotEnAttente} />}
            {fiche.peut_signer && !depotEnAttente &&
              <SaisieSignature label="Faire signer le client" envoyer={terminerRapport.bind(null, mission.id, r.id)} />}
          </>}
          {actif && fiche.peut_valider && r.id === brouillon?.id && mission.type === "interne" &&
            <FormulaireOperation bouton="Valider le rapport" enregistrer={() => terminerRapport(mission.id, r.id)} />}
          {actif && fiche.peut_rediger && r.id === recent?.id && !brouillon &&
            <FormulaireOperation bouton="Préparer une nouvelle version" enregistrer={() => reprendreRapport(mission.id, r.id)} />}
        </article>)}
      </CardContent>
    </Card>
    {actif && fiche.peut_rediger && <Card>
      <CardHeader><CardTitle>Incident</CardTitle></CardHeader>
      <CardContent><SaisieIncident dossier={dossier.id} mission={mission.id} /></CardContent>
    </Card>}
  </>
}
