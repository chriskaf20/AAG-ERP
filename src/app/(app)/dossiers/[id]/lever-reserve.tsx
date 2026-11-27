"use client"

import { useRef } from "react"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/database.types"
import { leverReserve } from "./reception-actions"

const extensions: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
}

export function LeverReserve({ dossier, reserve }: {
  dossier: Pick<Tables<"dossiers">, "id" | "numero" | "organization_id">
  reserve: string
}) {
  const operation = useRef<string | null>(null)
  return <FormulaireOperation bouton="Lever la réserve" enregistrer={async fd => {
    const fichier = fd.get("preuve")
    if (!(fichier instanceof File) || fichier.size === 0) return { message: "Ajoutez le justificatif de levée." }
    const extension = extensions[fichier.type]
    if (!extension || fichier.size > 20 * 1024 * 1024) return { message: "Joignez un PDF ou une image de 20 Mo maximum." }
    operation.current ??= crypto.randomUUID()
    const chemin = [dossier.organization_id, dossier.numero, "reserves", reserve, operation.current + "." + extension].join("/")
    const stockage = createClient().storage.from("dossiers")
    const { error } = await stockage.upload(chemin, fichier, { upsert: false, contentType: fichier.type })
    if (error) {
      const { data } = await stockage.download(chemin)
      if (!data?.size) return { message: "Dépôt indisponible. Réessayez avec le même justificatif." }
    }
    fd.delete("preuve")
    return leverReserve(dossier.id, reserve, chemin, fichier.name, fd)
  }}>
    <Champ nom="Travaux correctifs"><Textarea name="commentaire" /></Champ>
    <Champ nom="Justificatif de levée (PDF ou image)">
      <Input name="preuve" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required
        onChange={() => { operation.current = null }} />
    </Champ>
  </FormulaireOperation>
}
