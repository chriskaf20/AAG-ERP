"use client"

import { useRef, useState, type Touch, type TouchEvent } from "react"
import { Champ, FormulaireOperation } from "@/components/formulaire-operation"
import { SignaturePad } from "@/components/signature-pad"
import { Input } from "@/components/ui/input"

const TOLERANCE_APPUI_PX = 10

function doigtDéplacé(départ: Touch, arrivée: Touch) {
  return départ.identifier !== arrivée.identifier
    || Math.hypot(arrivée.clientX - départ.clientX, arrivée.clientY - départ.clientY) > TOLERANCE_APPUI_PX
}

export function SaisieSignature({ label, envoyer }: {
  label: string
  envoyer: (signature: { nom: string; image: string }) => Promise<{ ok?: boolean; message?: string }>
}) {
  const [image, setImage] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const appui = useRef<{ bouton: HTMLButtonElement; départ: Touch } | null>(null)

  function commencerAppui(e: TouchEvent<HTMLDivElement>) {
    const bouton = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('button[type="submit"]') : null
    appui.current = bouton && !bouton.disabled && e.touches.length === 1
      ? { bouton, départ: e.touches[0] }
      : null
  }

  function suivreAppui(e: TouchEvent<HTMLDivElement>) {
    if (appui.current && (e.touches.length !== 1 || doigtDéplacé(appui.current.départ, e.touches[0]))) {
      appui.current = null
    }
  }

  function terminerAppui(e: TouchEvent<HTMLDivElement>) {
    const contact = appui.current
    appui.current = null
    if (!contact || !e.cancelable || e.touches.length || e.changedTouches.length !== 1) return
    const fin = e.changedTouches[0]
    const { bouton, départ } = contact
    if (bouton.disabled || doigtDéplacé(départ, fin) || !bouton.contains(document.elementFromPoint(fin.clientX, fin.clientY))) return

    // Chromium peut omettre le clic après le tracé. Soumet une fois, avec la validation native.
    e.preventDefault()
    bouton.form?.requestSubmit(bouton)
  }

  return (
    <details open={ouvert} onToggle={e => {
      setOuvert(e.currentTarget.open)
      if (!e.currentTarget.open) setImage(null)
    }}>
      <summary className="cursor-pointer font-medium">{label}</summary>
      {ouvert && (
        <div
          className="pt-2"
          onTouchStart={commencerAppui}
          onTouchMove={suivreAppui}
          onTouchEnd={terminerAppui}
          onTouchCancel={() => { appui.current = null }}
        >
          <FormulaireOperation
            bouton="Enregistrer la signature"
            disabled={!image}
            enregistrer={fd => envoyer({ nom: String(fd.get("nom")), image: image ?? "" })}
          >
            <Champ nom="Nom du signataire"><Input name="nom" required minLength={2} maxLength={150} /></Champ>
            <SignaturePad onChange={setImage} label={label} />
          </FormulaireOperation>
        </div>
      )}
    </details>
  )
}
