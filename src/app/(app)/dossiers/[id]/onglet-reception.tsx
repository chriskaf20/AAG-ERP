"use client"

import { useState } from "react"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { LienSignature } from "@/components/lien-signature"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import type { Tables } from "@/lib/database.types"
import { formatDate, formatDateHeure } from "@/lib/format"
import { DECISIONS_PV, RESULTATS_F05, RESULTATS_F06, RESULTATS_PV } from "@/lib/reception"
import { SaisieSignature } from "@/components/saisie-signature"
import {
  ajouterReserve, creerPvReception, enregistrerAvis, enregistrerLignePv, enregistrerPvReception, leverReserve,
  lienReception, refuserReception, retirerElementPv, signerPvReception,
} from "./reception-actions"

function LignePv({ dossier, pv, ligne }: { dossier: string; pv: Tables<"pv_reception">; ligne?: Tables<"pv_reception_lignes"> }) {
  return <FormulaireOperation bouton={ligne ? "Enregistrer le point" : "Ajouter le point"} reinitialiser={!ligne}
    enregistrer={enregistrerLignePv.bind(null, dossier, pv.id, ligne?.id ?? null)}>
    {pv.type === "F06" && <Champ nom="Livrable ou tâche"><Input name="libelle" defaultValue={ligne?.libelle} required /></Champ>}
    <Champ nom="Résultat"><NativeSelect name="resultat" required defaultValue={ligne?.resultat ?? ""}>
      <option value="">Sélectionner</option>
      {Object.entries(pv.type === "F05" ? RESULTATS_F05 : RESULTATS_F06).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </NativeSelect></Champ>
    <Champ nom="Observation"><Input name="observation" defaultValue={ligne?.observation ?? ""} /></Champ>
  </FormulaireOperation>
}

export function OngletReception({ dossier, pvs, lignes, reserves, avis, reception, pilote, emailClient }: {
  dossier: Tables<"dossiers">
  pvs: Tables<"pv_reception">[]
  lignes: Tables<"pv_reception_lignes">[]
  reserves: Tables<"reserves">[]
  avis: Tables<"avis_clients"> | null
  reception: boolean
  pilote: boolean
  emailClient: string | null
}) {
  const [lien, setLien] = useState<string | null>(null)
  const { enCours, run } = useAction()
  const livre = dossier.statut === "livre"
  const actif = pvs.find(p => !p.refuse_le)
  return <div className="grid gap-4">
    {dossier.receptionne_le && <Card>
      <CardHeader><CardTitle>Réception et garantie</CardTitle></CardHeader>
      <CardContent className="grid gap-1 text-sm">
        <p>{dossier.reception_tacite ? "Réception tacite" : "Réception signée"} · {formatDateHeure(dossier.receptionne_le)}</p>
        {dossier.garantie_fin && <p>Fin de garantie le {formatDate(dossier.garantie_fin)}</p>}
      </CardContent>
    </Card>}
    {pvs.length === 0 && <p className="text-sm text-muted-foreground">Aucun PV de réception établi.</p>}
    {livre && reception && !actif && <Card>
      <CardHeader><CardTitle>Nouveau PV de réception</CardTitle></CardHeader>
      <CardContent><FormulaireOperation bouton="Créer le PV" enregistrer={creerPvReception.bind(null, dossier.id)}>
        <Champ nom="Formulaire"><NativeSelect name="type" defaultValue="F06">
          <option value="F06">F-06 · Réception des travaux et livrables</option>
          <option value="F05">F-05 · Réception de site web</option>
        </NativeSelect></Champ>
      </FormulaireOperation></CardContent>
    </Card>}
    {pvs.map(p => {
      const ouvert = !p.signe_le && !p.refuse_le && livre
      const modifiable = reception && ouvert && !p.signature_atlas_id && !p.signature_client_id
      const reservesPv = reserves.filter(r => r.pv_id === p.id)
      return <Card key={p.id}>
        <CardHeader><CardTitle className="flex flex-wrap gap-2">PV F-{p.type.slice(1)} · version {p.version}
          <Badge variant="outline">{p.refuse_le ? "Refusé" : p.signe_le ? "Signé" : "En préparation"}</Badge>
        </CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <p>{formatDate(p.date_reception)}{p.lieu && ` · ${p.lieu}`}{p.decision && ` · ${DECISIONS_PV[p.decision]}`}</p>
          {p.observations && <p className="whitespace-pre-wrap">{p.observations}</p>}
          {p.motif_refus && <p>Motif du refus — {p.motif_refus}</p>}
          {p.satisfaction != null && <p>Satisfaction {p.satisfaction}/5</p>}
          {p.date_limite_reserves && <p>Échéance des réserves le {formatDate(p.date_limite_reserves)}</p>}
          {!!(p.signature_atlas_id || p.signature_client_id) && <p>Signatures reçues — {[p.signature_atlas_id && "Atlas", p.signature_client_id && "Client"].filter(Boolean).join(", ")}</p>}
          {modifiable && <details open={!p.decision}><summary className="cursor-pointer font-medium">Renseigner la décision et les détails</summary>
            <div className="pt-2"><FormulaireOperation bouton="Enregistrer le PV" reinitialiser={false} enregistrer={enregistrerPvReception.bind(null, dossier.id, p.id)}>
              <Champ nom="Date de réception"><Input name="date_reception" type="date" required defaultValue={p.date_reception} /></Champ>
              <Champ nom="Lieu"><Input name="lieu" defaultValue={p.lieu ?? ""} /></Champ>
              <Champ nom="Décision"><NativeSelect name="decision" required defaultValue={p.decision ?? ""}>
                <option value="">Sélectionner</option><option value="sans_reserve">Sans réserve</option><option value="avec_reserves">Avec réserves</option>
              </NativeSelect></Champ>
              <Champ nom="Date limite (avec réserves)"><Input name="date_limite" type="date" defaultValue={p.date_limite_reserves ?? ""} /></Champ>
              <Champ nom="Satisfaction du client (1 à 5)"><Input name="satisfaction" type="number" required={p.type === "F06"} min={1} max={5} defaultValue={p.satisfaction ?? ""} /></Champ>
              <Champ nom="Observations"><Textarea name="observations" defaultValue={p.observations ?? ""} /></Champ>
            </FormulaireOperation></div>
          </details>}
          <div className="grid gap-2">
            <h3 className="font-medium">Points de réception</h3>
            {lignes.filter(l => l.pv_id === p.id).map(l => <div key={l.id} className="grid gap-2 rounded-lg border p-3">
              <p>{l.libelle}{l.resultat && <Badge className="ml-2" variant="outline">{RESULTATS_PV[l.resultat]}</Badge>}</p>
              {l.observation && <p>{l.observation}</p>}
              {modifiable && <details><summary className="cursor-pointer">Modifier le point</summary><div className="grid gap-2 pt-2">
                <LignePv dossier={dossier.id} pv={p} ligne={l} />
                {p.type === "F06" && <FormulaireOperation bouton="Retirer le point" enregistrer={() => retirerElementPv(dossier.id, p.id, l.id, "pv_reception_lignes")} />}
              </div></details>}
            </div>)}
            {modifiable && p.type === "F06" && <details><summary className="cursor-pointer">Ajouter un point</summary><div className="pt-2"><LignePv dossier={dossier.id} pv={p} /></div></details>}
          </div>
          <div className="grid gap-2">
            <h3 className="font-medium">Réserves</h3>
            {reservesPv.length === 0 && <p className="text-muted-foreground">Aucune réserve.</p>}
            {reservesPv.map(r => <div key={r.id} className="grid gap-2 rounded-lg border p-3">
              <p className="whitespace-pre-wrap">{r.description} <Badge variant="outline">{r.statut === "levee" ? "Levée" : "Ouverte"}</Badge></p>
              {r.date_limite && <p>Échéance le {formatDate(r.date_limite)}</p>}
              {r.commentaire_levee && <p>{r.commentaire_levee}</p>}
              {modifiable && <FormulaireOperation bouton="Retirer la réserve" enregistrer={() => retirerElementPv(dossier.id, p.id, r.id, "reserves")} />}
              {reception && p.signe_le && r.statut !== "levee" && ["livre", "reserves"].includes(dossier.statut) &&
                <FormulaireOperation bouton="Lever la réserve" enregistrer={leverReserve.bind(null, dossier.id, r.id)}>
                  <Champ nom="Travaux correctifs"><Textarea name="commentaire" /></Champ>
                </FormulaireOperation>}
            </div>)}
            {modifiable && <details><summary className="cursor-pointer">Ajouter une réserve</summary><div className="pt-2">
              <FormulaireOperation bouton="Ajouter la réserve" enregistrer={ajouterReserve.bind(null, dossier.id, p.id)}>
                <Champ nom="Description de la réserve"><Textarea name="description" required /></Champ>
                <Champ nom="Date limite individuelle"><Input name="date_limite" type="date" /></Champ>
              </FormulaireOperation>
            </div></details>}
          </div>
          {reception && ouvert && <>
            {!p.signature_atlas_id && <SaisieSignature label="Signer pour Atlas" envoyer={signerPvReception.bind(null, dossier.id, p.id, "atlas")} />}
            {!p.signature_client_id && <SaisieSignature label="Faire signer le client sur cet appareil" envoyer={signerPvReception.bind(null, dossier.id, p.id, "client")} />}
            {!!p.signature_atlas_id && !p.signature_client_id && <Button size="sm" variant="outline" className="justify-self-start" disabled={enCours} onClick={() =>
              run(() => lienReception(p.id), r => { if (r.data) setLien(`${window.location.origin}/signer/${r.data}`) })}>
              Créer un lien de signature client
            </Button>}
            <details><summary className="cursor-pointer font-medium">Consigner un refus du client</summary><div className="pt-2">
              <FormulaireOperation bouton="Enregistrer le refus" enregistrer={refuserReception.bind(null, dossier.id, p.id)}>
                <Champ nom="Motif du refus"><Textarea name="motif" required /></Champ>
              </FormulaireOperation>
            </div></details>
          </>}
        </CardContent>
      </Card>
    })}
    {(avis || (pilote && dossier.statut === "receptionne_a_facturer")) && <Card>
      <CardHeader><CardTitle>Avis du client FP-04</CardTitle></CardHeader>
      <CardContent>
        {pilote && dossier.statut === "receptionne_a_facturer" ?
          <FormulaireOperation bouton="Enregistrer l’avis" reinitialiser={false} enregistrer={enregistrerAvis.bind(null, dossier.id)}>
            <Champ nom="Note (1 à 5)"><Input name="note" type="number" min={1} max={5} required defaultValue={avis?.note} /></Champ>
            <Champ nom="Commentaire du client"><Textarea name="commentaire" defaultValue={avis?.commentaire ?? ""} /></Champ>
          </FormulaireOperation> : avis && <div><p>Note {avis.note}/5</p><p className="whitespace-pre-wrap">{avis.commentaire}</p></div>}
      </CardContent>
    </Card>}
    <LienSignature url={lien} titre="Signature du PV de réception" message="Bonjour, veuillez consulter et signer le PV de réception." email={emailClient} onClose={() => setLien(null)} />
  </div>
}
