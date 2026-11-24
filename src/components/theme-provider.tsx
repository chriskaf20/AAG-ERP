"use client"

import { useSyncExternalStore } from "react"

type Theme = "light" | "dark" | "system"
const CLE = "theme"
const MEDIA = "(prefers-color-scheme: dark)"

function lireChoix(): Theme {
  try {
    const t = localStorage.getItem(CLE)
    return t === "light" || t === "dark" ? t : "system"
  } catch {
    return "system"
  }
}

function appliquer(t: Theme) {
  const sombre = t === "dark" || (t === "system" && window.matchMedia(MEDIA).matches)
  document.documentElement.classList.toggle("dark", sombre)
  document.documentElement.style.colorScheme = sombre ? "dark" : "light"
}

function subscribe(cb: () => void) {
  const mql = window.matchMedia(MEDIA)
  const surSysteme = () => {
    if (lireChoix() === "system") appliquer("system")
    cb()
  }
  mql.addEventListener("change", surSysteme)
  window.addEventListener("storage", surSysteme)
  window.addEventListener("atlas-theme", cb)
  return () => {
    mql.removeEventListener("change", surSysteme)
    window.removeEventListener("storage", surSysteme)
    window.removeEventListener("atlas-theme", cb)
  }
}

/** Thème clair / sombre (classe .dark sur <html>, posée avant l'hydratation par SCRIPT_THEME). */
export function useTheme() {
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => undefined
  )
  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem(CLE, t)
    } catch {}
    appliquer(t)
    window.dispatchEvent(new Event("atlas-theme"))
  }
  return { resolvedTheme, setTheme }
}
