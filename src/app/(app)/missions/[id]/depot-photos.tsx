"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Champ } from "@/components/formulaire-operation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { RapportMission } from "@/lib/missions"
import { deposerPhotoTerrain, type JpegTerrain } from "@/lib/photos-terrain"
import { createClient } from "@/lib/supabase/client"

type PhotoEnAttente = {
  fichier: File
  chemin: string
  jpeg?: JpegTerrain
  etat: "attente" | "envoi" | "echec"
}

async function compresser(fichier: File) {
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

export function DepotPhotos({ rapport, onAttente }: { rapport: RapportMission; onAttente: (attente: boolean) => void }) {
  const router = useRouter()
  const file = useRef<PhotoEnAttente[]>([])
  const traitement = useRef(false)
  const [photos, setPhotos] = useState<PhotoEnAttente[]>([])
  const [occupe, setOccupe] = useState(false)

  function publier() {
    setPhotos([...file.current])
    onAttente(file.current.length > 0)
  }

  async function envoyer() {
    if (traitement.current || !file.current.length || !navigator.onLine) return
    traitement.current = true
    setOccupe(true)
    let deposee = false
    const supabase = createClient()
    const storage = supabase.storage.from("terrain")

    try {
      for (const photo of [...file.current]) {
        photo.etat = "envoi"
        publier()
        try {
          photo.jpeg ??= await compresser(photo.fichier)
          await deposerPhotoTerrain({
            televerser: (chemin, blob) => storage.upload(chemin, blob, { contentType: "image/jpeg", upsert: false }),
            verifierObjet: chemin => storage.createSignedUrl(chemin, 60),
            consigner: async (chemin, { blob, largeur, hauteur }) => {
              const resultat = await supabase.from("rapport_photos").upsert({
                organization_id: rapport.organization_id, rapport_id: rapport.id, chemin, largeur, hauteur, taille: blob.size,
              }, { onConflict: "rapport_id,chemin", ignoreDuplicates: true })
              if (!resultat.error) return resultat
              const { data } = await supabase.from("rapport_photos").select("id")
                .eq("rapport_id", rapport.id).eq("chemin", chemin).maybeSingle()
              return data ? { error: null } : resultat
            },
          }, photo.chemin, photo.jpeg)
          file.current = file.current.filter(p => p !== photo)
          deposee = true
        } catch {
          photo.etat = "echec"
        }
        publier()
      }
    } finally {
      traitement.current = false
      setOccupe(false)
      if (deposee) router.refresh()
    }
  }

  useEffect(() => {
    function avertir(e: BeforeUnloadEvent) {
      if (file.current.length) e.preventDefault()
    }
    function lien(e: MouseEvent) {
      const cible = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!file.current.length || !cible || cible.hasAttribute("download") || cible.target || e.button !== 0 ||
        e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || cible.href === window.location.href) return
      if (!window.confirm("Des photos sont encore en attente d’envoi. Quitter cette mission ?")) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", avertir)
    document.addEventListener("click", lien, true)
    return () => {
      window.removeEventListener("beforeunload", avertir)
      document.removeEventListener("click", lien, true)
    }
  }, [])

  const reprendre = useRef<() => void>(() => {})
  useEffect(() => {
    reprendre.current = envoyer
  })
  useEffect(() => {
    const reconnecte = () => reprendre.current()
    window.addEventListener("online", reconnecte)
    return () => window.removeEventListener("online", reconnecte)
  }, [])

  async function retirer(photo: PhotoEnAttente) {
    if (traitement.current) return
    traitement.current = true
    setOccupe(true)
    try {
      const storage = createClient().storage.from("terrain")
      const { error } = await storage.remove([photo.chemin])
      if (error && navigator.onLine) toast.error("Le nettoyage du dépôt n’a pas pu être confirmé.")
      file.current = file.current.filter(p => p !== photo)
      publier()
      router.refresh()
    } finally {
      traitement.current = false
      setOccupe(false)
    }
  }

  return <div className="grid gap-2">
    <Champ nom="Ajouter des photos (appareil photo ou galerie)">
      <Input type="file" accept="image/*" multiple disabled={occupe} onChange={e => {
        const fichiers = Array.from(e.currentTarget.files ?? [])
        e.currentTarget.value = ""
        if (!fichiers.length || traitement.current) return
        const base = rapport.organization_id + "/" + rapport.dossier_id + "/" + rapport.id + "/"
        file.current.push(...fichiers.map(fichier => ({
          fichier, chemin: base + crypto.randomUUID() + ".jpg", etat: "attente" as const,
        })))
        publier()
        void envoyer()
      }} />
    </Champ>
    {photos.length > 0 && <>
      <ul aria-live="polite" className="grid gap-1 text-xs">
        {photos.map(photo => <li key={photo.chemin} className="flex flex-wrap items-center justify-between gap-2">
          <span>{photo.fichier.name} · {photo.etat === "envoi" ? "Envoi en cours" : photo.etat === "echec" ? "Échec d’envoi" : "En attente d’envoi"}</span>
          {!occupe && <Button type="button" size="xs" variant="ghost" onClick={() => void retirer(photo)}>Retirer de la file</Button>}
        </li>)}
      </ul>
      {!occupe && <Button type="button" size="sm" variant="outline" className="justify-self-start"
        onClick={() => void envoyer()}>Réessayer les envois</Button>}
    </>}
  </div>
}
