"use client"

import { useState } from "react"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { SignaturePad } from "@/components/signature-pad"
import { Input } from "@/components/ui/input"

export function SaisieSignature({ label, envoyer }: {
  label: string
  envoyer: (signature: { nom: string; image: string }) => Promise<{ ok?: boolean; message?: string }>
}) {
  const [image, setImage] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState(false)
  return <details open={ouvert} onToggle={e => {
    setOuvert(e.currentTarget.open)
    if (!e.currentTarget.open) setImage(null)
  }}>
    <summary className="cursor-pointer font-medium">{label}</summary>
    {ouvert && <div className="pt-2"><FormulaireOperation bouton="Enregistrer la signature" disabled={!image} enregistrer={fd => envoyer({ nom: String(fd.get("nom")), image: image ?? "" })}>
      <Champ nom="Nom du signataire"><Input name="nom" required minLength={2} maxLength={150} /></Champ>
      <SignaturePad onChange={setImage} label={label} />
    </FormulaireOperation></div>}
  </details>
}
