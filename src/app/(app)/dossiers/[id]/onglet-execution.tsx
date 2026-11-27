"use client"

import Link from "next/link"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { Tables } from "@/lib/database.types"
import { formatDateHeure } from "@/lib/format"
import type { Membre } from "@/lib/membres"
import type { DroitsDossier } from "@/lib/permissions"
import { SaisieIncident } from "@/app/(app)/missions/saisie-incident"
import { STATUT_MISSION } from "@/lib/missions"
import { annulerMission, cloreIncident, consignerPoint, gererAffectationMission, gererLivrable, planifierMission, suivreIncident } from "./execution-actions"

const EMAIL = { consigne: "Consigné", simule: "Envoi simulé", ignore: "Adresse ignorée", en_attente: "Envoi en attente", envoye: "Envoyé", echec: "Échec d’envoi" }
const GRAVITE = { faible: "Faible", moyenne: "Moyenne", elevee: "Élevée" }

export function OngletExecution({ dossier, missions, equipes, membres, livrables, incidents, points, droits }: {
  dossier: Tables<"dossiers">
  missions: Tables<"missions">[]
  equipes: Tables<"mission_agents">[]
  membres: Membre[]
  livrables: Tables<"livrables">[]
  incidents: Tables<"incidents">[]
  points: Tables<"points_avancement">[]
  droits: DroitsDossier
}) {
  const enExecution = ["en_lancement", "en_cours", "reserves"].includes(dossier.statut)
  const ecriture = droits.execution_write && enExecution
  return <div className="grid gap-4">
    <Card>
      <CardHeader><CardTitle>Missions</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        {missions.length === 0 && <p className="text-sm text-muted-foreground">Aucune mission planifiée.</p>}
        {missions.map(m => {
          const equipe = equipes.filter(a => a.mission_id === m.id)
          const candidats = membres.filter(x => !equipe.some(a => a.user_id === x.id) && (m.type === "interne" || x.roles.includes("agent_terrain")))
          const gerable = ecriture && (m.statut === "planifiee" || m.statut === "en_cours")
          return <article key={m.id} className="grid gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap gap-2">
              <Link className="font-medium underline" href={`/missions/${m.id}`}>{m.titre}</Link>
              <Badge variant="outline">{m.type === "terrain" ? "Terrain" : "Interne"}</Badge>
              <Badge variant="outline">{STATUT_MISSION[m.statut]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{formatDateHeure(m.debut)}{m.lieu && ` · ${m.lieu}`}</p>
            {m.motif_annulation && <p className="text-sm">{m.motif_annulation}</p>}
            <ul className="grid gap-2">
              {equipe.map(a => <li className="flex flex-wrap items-center gap-2 text-sm" key={a.id}>
                <span>{membres.find(x => x.id === a.user_id)?.nom ?? "Membre affecté"}</span>
                {gerable && <FormulaireOperation bouton="Retirer" enregistrer={() => gererAffectationMission(dossier.id, m.id, a.user_id, true)} />}
              </li>)}
            </ul>
            {equipe.length === 0 && <p className="text-sm text-muted-foreground">Aucune personne affectée.</p>}
            {gerable && candidats.length > 0 && <FormulaireOperation bouton="Affecter" enregistrer={fd => gererAffectationMission(dossier.id, m.id, String(fd.get("membre")))}>
              <Champ nom="Membre à affecter"><NativeSelect name="membre" required><option value="">Sélectionner</option>
                {candidats.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}
              </NativeSelect></Champ>
            </FormulaireOperation>}
            {gerable && <details className="text-sm"><summary className="cursor-pointer">Annuler la mission</summary>
              <div className="pt-2"><FormulaireOperation bouton="Confirmer l’annulation" enregistrer={annulerMission.bind(null, dossier.id, m.id)}>
                <Champ nom="Motif"><Textarea name="motif" required /></Champ>
              </FormulaireOperation></div>
            </details>}
          </article>
        })}
        {ecriture && <details open={missions.length === 0}>
          <summary className="cursor-pointer font-medium">Planifier une mission</summary>
          <div className="pt-3"><FormulaireOperation bouton="Planifier" enregistrer={fd => {
            for (const champ of ["debut", "fin"]) {
              const valeur = fd.get(champ)
              if (valeur) fd.set(champ, `${valeur}:00+02:00`)
            }
            return planifierMission(dossier.id, fd)
          }}>
            <Champ nom="Titre"><Input name="titre" required /></Champ>
            <Champ nom="Type"><NativeSelect name="type"><option value="terrain">Terrain</option><option value="interne">Interne</option></NativeSelect></Champ>
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ nom="Début (heure de Lubumbashi)"><Input name="debut" type="datetime-local" required /></Champ>
              <Champ nom="Fin (facultative)"><Input name="fin" type="datetime-local" /></Champ>
            </div>
            <Champ nom="Lieu"><Input name="lieu" /></Champ>
            <Champ nom="Consignes"><Textarea name="consignes" /></Champ>
          </FormulaireOperation></div>
        </details>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Livrables</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {livrables.length === 0 && <p className="text-sm text-muted-foreground">Aucun livrable enregistré.</p>}
        {livrables.map(l => <div key={l.id} className="grid gap-1 text-sm">
          <p>{l.libelle} <Badge variant="outline">{l.remis_le ? "Remis" : "À remettre"}</Badge></p>
          {l.description && <p>{l.description}</p>}
          {ecriture && !l.remis_le && <FormulaireOperation bouton="Marquer remis" enregistrer={fd => gererLivrable(dossier.id, fd, l.id)} />}
        </div>)}
        {ecriture && <details><summary className="cursor-pointer font-medium">Ajouter un livrable</summary>
          <div className="pt-2"><FormulaireOperation bouton="Ajouter" enregistrer={gererLivrable.bind(null, dossier.id)}>
            <Champ nom="Libellé"><Input name="libelle" required /></Champ>
            <Champ nom="Description"><Textarea name="description" /></Champ>
          </FormulaireOperation></div>
        </details>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Incidents</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {incidents.length === 0 && <p className="text-sm text-muted-foreground">Aucun incident signalé.</p>}
        {incidents.map(i => <article key={i.id} className="grid gap-2 rounded-lg border p-3 text-sm">
          <div className="flex gap-2"><Badge variant={i.gravite === "elevee" ? "destructive" : "outline"}>{GRAVITE[i.gravite]}</Badge>
            <Badge variant="outline">{{ ouvert: "Ouvert", en_traitement: "En traitement", clos: "Clos" }[i.statut]}</Badge></div>
          <p className="whitespace-pre-wrap">{i.description}</p>
          {i.action_corrective && <p>{i.action_corrective}</p>}
          {i.responsable_id && <p>Responsable · {membres.find(m => m.id === i.responsable_id)?.nom ?? "Membre interne"}</p>}
          {i.date_cloture && <p>Clos le {formatDateHeure(i.date_cloture)}</p>}
          {droits.execution_write && i.statut !== "clos" && <details className="text-sm"><summary className="cursor-pointer">Suivre l’incident</summary>
            <div className="pt-2"><FormulaireOperation bouton="Enregistrer le suivi" reinitialiser={false} enregistrer={suivreIncident.bind(null, dossier.id, i.id)}>
              <Champ nom="Responsable"><NativeSelect name="responsable" defaultValue={i.responsable_id ?? ""}>
                <option value="">Sans responsable</option>
                {membres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </NativeSelect></Champ>
              <Champ nom="État"><NativeSelect name="statut" defaultValue={i.statut}>
                <option value="ouvert">Ouvert</option><option value="en_traitement">En traitement</option>
              </NativeSelect></Champ>
              <Champ nom="Action corrective"><Textarea name="action" defaultValue={i.action_corrective ?? ""} /></Champ>
            </FormulaireOperation></div>
          </details>}
          {droits.execution_write && i.statut !== "clos" && <details><summary className="cursor-pointer">Clore l’incident</summary>
            <div className="pt-2"><FormulaireOperation bouton="Clore" enregistrer={cloreIncident.bind(null, dossier.id, i.id)}>
              <Champ nom="Action corrective"><Textarea name="action" required defaultValue={i.action_corrective ?? ""} /></Champ>
            </FormulaireOperation></div>
          </details>}
        </article>)}
        {ecriture && <details><summary className="cursor-pointer font-medium">Signaler un incident</summary><div className="pt-2"><SaisieIncident dossier={dossier.id} /></div></details>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Points d’avancement</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {droits.execution_write && (enExecution || dossier.statut === "livre") && <FormulaireOperation bouton="Consigner le point" enregistrer={consignerPoint.bind(null, dossier.id)}>
          <Champ nom="Compte rendu"><Textarea name="texte" required maxLength={10_000} /></Champ>
        </FormulaireOperation>}
        {points.length === 0 && <p className="text-sm text-muted-foreground">Aucun point consigné.</p>}
        {points.map(p => <article className="grid gap-1 rounded-lg border p-3 text-sm" key={p.id}>
          <div className="flex flex-wrap items-center gap-2"><time>{formatDateHeure(p.date_point)}</time><Badge variant="outline">{EMAIL[p.email_statut as keyof typeof EMAIL]}</Badge></div>
          <p className="whitespace-pre-wrap">{p.texte}</p>
          {p.email_erreur && <p className="text-muted-foreground">{p.email_erreur}</p>}
        </article>)}
      </CardContent>
    </Card>
  </div>
}
