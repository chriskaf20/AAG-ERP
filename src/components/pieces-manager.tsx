"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { DownloadIcon, FileIcon, LockIcon, UploadIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { enregistrerDocument } from "@/app/(app)/documents/actions"
import { partagerDocumentPortail } from "@/app/(app)/documents/actions-portail"
import { FormulaireOperation } from "@/components/formulaire-operation"
import type { Enums } from "@/lib/database.types"
import { formatDateHeure, formatTaille } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"

export type DocType = Enums<"document_type">

export type DocumentLigne = {
  id: string
  type: DocType
  libelle: string | null
  nom_fichier: string
  version: number
  taille: number | null
  created_at: string
  est_signe: boolean
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
const TAILLE_MAX = 20 * 1024 * 1024

function nomSur(nom: string) {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-120)
}

/**
 * Pièces et documents versionnés. Un nouveau dépôt crée une nouvelle version,
 * l'ancienne reste consultable ; un document signé n'est jamais remplacé.
 */
export function PiecesManager({
  titre,
  description,
  bucket,
  orgId,
  clientId,
  dossier,
  types,
  documents,
  peutEcrire,
  partagesPortail,
}: {
  titre: string
  description?: string
  bucket: "dossiers" | "clients"
  orgId: string
  clientId?: string
  dossier?: { id: string; numero: string }
  types: DocType[]
  documents: DocumentLigne[]
  peutEcrire: boolean
  partagesPortail?: string[]
}) {
  const t = useTranslations("documents")
  const router = useRouter()
  const [enCours, setEnCours] = React.useState<DocType | null>(null)
  const inputs = React.useRef<Partial<Record<DocType, HTMLInputElement | null>>>({})

  const typesVisibles = partagesPortail ? [...new Set([...types, ...documents.map(d => d.type)])] : types
  const parType = (type: DocType) =>
    documents.filter((d) => d.type === type).sort((a, b) => b.version - a.version)

  async function deposer(type: DocType, fichier: File) {
    if (fichier.size > TAILLE_MAX) {
      toast.error("Fichier trop volumineux (20 Mo maximum)")
      return
    }
    setEnCours(type)
    try {
      const dossierOuClient = bucket === "dossiers" ? dossier!.numero : clientId!
      const chemin = `${orgId}/${dossierOuClient}/${type}/${Date.now()}-${nomSur(fichier.name)}`
      const supabase = createClient()
      const { error: errUpload } = await supabase.storage
        .from(bucket)
        .upload(chemin, fichier, { upsert: false, contentType: fichier.type || undefined })
      if (errUpload) {
        toast.error(`Dépôt impossible : ${errUpload.message}`)
        return
      }
      const precedent = type === "autre" ? undefined : parType(type)[0]
      const res = await enregistrerDocument({
        bucket,
        chemin,
        type,
        libelle: type === "autre" ? fichier.name : null,
        nom_fichier: fichier.name,
        mime_type: fichier.type || null,
        taille: fichier.size,
        dossier_id: bucket === "dossiers" ? dossier!.id : null,
        client_id: clientId ?? null,
        version_precedente_id: precedent?.id ?? null,
      })
      if (res?.ok) {
        toast.success(precedent ? `Nouvelle version enregistrée (v${precedent.version + 1})` : "Document enregistré")
        router.refresh()
      } else {
        toast.error(res?.message ?? "Erreur")
      }
    } finally {
      setEnCours(null)
      const input = inputs.current[type]
      if (input) input.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titre}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {typesVisibles.map((type) => {
          const versions = parType(type)
          const actuel = versions[0]
          const anciens = type === "autre" ? versions.slice(1) : versions.slice(1)
          return (
            <div key={type} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <FileIcon className="size-4 text-muted-foreground" aria-hidden />
                <span className="font-medium">{t.has(type) ? t(type) : type}</span>
                {actuel ? (
                  <Badge variant="outline" className="border-success/40 text-success">
                    Reçu · v{actuel.version}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Manquant
                  </Badge>
                )}
                {peutEcrire && types.includes(type) && (
                  <div className="ml-auto">
                    <input
                      ref={(el) => {
                        inputs.current[type] = el
                      }}
                      type="file"
                      accept={ACCEPT}
                      className="sr-only"
                      id={`fichier-${type}`}
                      aria-label={`Déposer : ${t(type)}`}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void deposer(type, f)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={enCours !== null}
                      onClick={() => inputs.current[type]?.click()}
                    >
                      <UploadIcon />
                      {enCours === type
                        ? "Envoi…"
                        : actuel && type !== "autre"
                          ? "Nouvelle version"
                          : "Déposer"}
                    </Button>
                  </div>
                )}
              </div>
              {(type === "autre" ? versions : actuel ? [actuel] : []).map((d) => (
                <LigneDocument key={d.id} doc={d} partagePortail={partagesPortail?.includes(d.id)} />
              ))}
              {type !== "autre" && anciens.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Versions précédentes ({anciens.length})
                  </summary>
                  <div className="mt-1 flex flex-col">
                    {anciens.map((d) => (
                      <LigneDocument key={d.id} doc={d} partagePortail={partagesPortail?.includes(d.id)} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function LigneDocument({ doc, partagePortail }: { doc: DocumentLigne; partagePortail?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-sm">
      <a
        href={`/documents/${doc.id}`}
        target="_blank"
        rel="noopener"
        className="max-w-full truncate text-primary hover:underline dark:text-foreground"
      >
        {doc.libelle ?? doc.nom_fichier}
      </a>
      <span className="text-muted-foreground">
        v{doc.version} · {formatTaille(doc.taille)} · {formatDateHeure(doc.created_at)}
      </span>
      {doc.est_signe && (
        <Badge variant="outline" className="gap-1">
          <LockIcon className="size-3" aria-hidden /> Signé
        </Badge>
      )}
      <a
        href={`/documents/${doc.id}?telecharger`}
        className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <DownloadIcon className="size-3.5" aria-hidden />
        <span className="sr-only sm:not-sr-only">Télécharger</span>
      </a>
      {partagePortail !== undefined && <FormulaireOperation
        bouton={partagePortail ? "Révoquer le partage client" : "Partager au portail client"}
        enregistrer={partagerDocumentPortail.bind(null, doc.id, !partagePortail)} />}
    </div>
  )
}
