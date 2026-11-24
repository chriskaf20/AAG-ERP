"use client"

import * as React from "react"
import { EraserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Zone de signature dessinée (souris, doigt, stylet). Renvoie un PNG en data URL. */
export function SignaturePad({
  onChange,
  label = "Signature",
}: {
  onChange: (png: string | null) => void
  label?: string
}) {
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const dessin = React.useRef(false)
  const dernier = React.useRef<{ x: number; y: number } | null>(null)
  const [vide, setVide] = React.useState(true)

  React.useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    const { width, height } = c.getBoundingClientRect()
    c.width = width * ratio
    c.height = height * ratio
    const ctx = c.getContext("2d")!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0B1F4B"
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const fin = () => {
    if (!dessin.current) return
    dessin.current = false
    dernier.current = null
    if (!vide) onChange(canvas.current!.toDataURL("image/png"))
  }

  const effacer = () => {
    const c = canvas.current!
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height)
    setVide(true)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" id="signature-label">
          {label}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={effacer} disabled={vide}>
          <EraserIcon /> Effacer
        </Button>
      </div>
      <canvas
        ref={canvas}
        role="img"
        aria-labelledby="signature-label signature-aide"
        className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-input bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          dessin.current = true
          dernier.current = point(e)
        }}
        onPointerMove={(e) => {
          if (!dessin.current || !dernier.current) return
          const ctx = canvas.current!.getContext("2d")!
          const p = point(e)
          ctx.beginPath()
          ctx.moveTo(dernier.current.x, dernier.current.y)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
          dernier.current = p
          if (vide) setVide(false)
        }}
        onPointerUp={fin}
        onPointerLeave={fin}
      />
      <p id="signature-aide" className="text-xs text-muted-foreground">Dessinez votre signature dans le cadre (souris, doigt ou stylet).</p>
    </div>
  )
}
