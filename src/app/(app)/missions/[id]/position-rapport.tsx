"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

type Position = { latitude: number; longitude: number; precision_m: number | null }

export function PositionRapport({ initiale }: { initiale: Position | null }) {
  const [position, setPosition] = useState(initiale)
  const [message, setMessage] = useState("")
  const [capture, setCapture] = useState(false)

  function relever() {
    if (!navigator.geolocation) {
      setMessage("Position GPS indisponible sur cet appareil.")
      return
    }
    setCapture(true)
    setMessage("")
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPosition({ latitude: coords.latitude, longitude: coords.longitude, precision_m: coords.accuracy })
      setCapture(false)
    }, () => {
      setMessage("Position GPS indisponible. Le rapport peut être enregistré sans position.")
      setCapture(false)
    }, { enableHighAccuracy: true, timeout: 10_000 })
  }

  return <div className="grid gap-2">
    {Object.entries(position ?? { latitude: null, longitude: null, precision_m: null })
      .map(([nom, valeur]) => <input key={nom} type="hidden" name={nom} value={valeur ?? ""} />)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={capture} onClick={relever}>
        {capture ? "Recherche de la position…" : "Relever la position (facultatif)"}
      </Button>
      {position && <Button type="button" variant="ghost" size="sm" disabled={capture} onClick={() => setPosition(null)}>Retirer la position</Button>}
    </div>
    {position && <p className="text-xs text-muted-foreground">
      {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}{position.precision_m !== null && " · ± " + Math.round(position.precision_m) + " m"}
    </p>}
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </div>
}
