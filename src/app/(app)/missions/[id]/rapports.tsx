"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { SaisieSignature } from "@/components/saisie-signature"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDateHeure } from "@/lib/format"
import type { FicheMission, RapportMission } from "@/lib/missions"
import { createClient } from "@/lib/supabase/client"
import { SaisieIncident } from "../saisie-incident"
import { enregistrerRapport, reprendreRapport, terminerRapport } from "../actions"

async function jpeg(fichier: File) {
  const image = await createImageBitmap(fichier)
  try {
    const ratio = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * ratio))
    canvas.height = Math.max(1, Math.round(image.height * ratio))
    const contexte = canvas.getContext("2d")
    if (!contexte) throw new Error("Compression indisponible")
    contexte.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.8))
    if (!blob) throw new Error("Conversion JPEG impossible")
    return { blob, largeur: canvas.width, hauteur: canvas.height }
  } finally {
    image.close()
  }
}

function DepotPhotos({ rapport, onChargement }: { rapport: RapportMission; onChargement: (actif: boolean) => void }) {
  const router = useRouter()
  const [actif, setActif] = useState(false)
  return <Champ nom="Ajouter des photos (appareil photo ou galerie)">
    <Input type="file" accept="image/*" multiple disabled={actif} onChange={async (e) => {
      const input = e.currentTarget
      const fichiers = Array.from(input.files ?? [])
      if (!fichiers.length) return
      setActif(true)
      onChargement(true)
      const supabase = createClient()
      try {
        for (const fichier of fichiers) {
          try {
            const { blob, largeur, hauteur } = await jpeg(fichier)
            const chemin = `${rapport.organization_id}/${rapport.dossier_id}/${rapport.id}/${crypto.randomUUID()}.jpg`
            const { error: depot } = await supabase.storage.from("terrain").upload(chemin, blob, { contentType: "image/jpeg" })
            if (depot) throw depot
            const { error } = await supabase.from("rapport_photos").insert({
              organization_id: rapport.organization_id, rapport_id: rapport.id, chemin, largeur, hauteur, taille: blob.size,
            })
            if (error) {
              await supabase.storage.from("terrain").remove([chemin])
              throw error
            }
            toast.success(`Photo ajoutée · ${fichier.name}`)
          } catch {
            toast.error(`Impossible d’ajouter ${fichier.name}. Réessayez avec une image JPEG.`)
          }
        }
      } finally {
        input.value = ""
        setActif(false)
        onChargement(false)
        router.refresh()
      }
    }} />
  </Champ>
}

export function RapportsMission({ fiche }: { fiche: FicheMission }) {
  const [depotActif, setDepotActif] = useState(false)
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
          </FormulaireOperation>}
        {rapports.map(r => <article key={r.id} className="grid gap-3 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className="font-medium">Version {r.version}</span>
            <Badge variant="outline">{r.signe_le ? "Signé par le client" : r.valide_le ? "Validé" : "Brouillon"}</Badge>
          </div>
          <p className="whitespace-pre-wrap">{r.travaux}</p>
          {r.observations && <p className="whitespace-pre-wrap">{r.observations}</p>}
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
          {actif && fiche.peut_rediger && r.id === brouillon?.id && mission.type === "terrain" && <>
            <DepotPhotos rapport={r} onChargement={setDepotActif} />
            {!depotActif && <SaisieSignature label="Faire signer le client" envoyer={terminerRapport.bind(null, mission.id, r.id)} />}
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
