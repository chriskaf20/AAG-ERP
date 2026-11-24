"use client"

import Image from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

/** Logo Atlas (public/logo.png) avec repli texte si le fichier est absent. */
export function Logo({ className, taille = 32 }: { className?: string; taille?: number }) {
  const [erreur, setErreur] = useState(false)
  if (erreur) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-accent font-bold text-accent-foreground",
          className
        )}
        style={{ width: taille, height: taille, fontSize: taille * 0.34 }}
        role="img"
        aria-label="Atlas Africa Group"
      >
        AAG
      </span>
    )
  }
  return (
    <Image
      src="/logo.png"
      alt="Atlas Africa Group"
      width={taille}
      height={taille}
      className={cn("shrink-0 rounded-md bg-white object-contain p-0.5", className)}
      onError={() => setErreur(true)}
    />
  )
}
