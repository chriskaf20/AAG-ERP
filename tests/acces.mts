/**
 * Vérifie, pour chaque compte de test, le menu affiché et le code HTTP de chaque page.
 * Usage : BASE_URL=http://localhost:3001 npm run test:acces   (serveur démarré)
 */
import { readFileSync } from "node:fs"
import { createServerClient } from "@supabase/ssr"

import * as M from "../src/lib/permissions"
import type { AppRole, Permission } from "../src/lib/permissions"

// Module TypeScript du projet (CommonJS) chargé depuis ESM
const P = ((M as unknown as { default?: typeof M }).default ?? M) as typeof M
const { aUne, LECTURE_DOSSIERS, LECTURE_FOURNISSEURS, LECTURE_MISSIONS, permissionsDe } = P

const BASE = process.env.BASE_URL ?? "http://localhost:3001"
const ORG = "a0000000-0000-4000-8000-000000000001"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
)

const COMPTES: [string, AppRole[]][] = [
  ["admin", ["admin_systeme"]],
  ["gerant", ["gerant"]],
  ["associe", ["associe"]],
  ["dir.commercial", ["directeur_commercial"]],
  ["dir.operations", ["directeur_operations"]],
  ["daf", ["daf"]],
  ["resp.aff", ["responsable_departement"]],
  ["resp.dossier", ["responsable_dossier"]],
  ["acheteur", ["acheteur"]],
  ["rh", ["responsable_rh"]],
  ["agent", ["agent_terrain"]],
  ["multi", ["responsable_dossier", "acheteur"]],
  ["multi.direction", ["gerant", "admin_systeme"]],
]

type Regle = Permission[] | "tous" | "general"
const PAGES: [string, Regle, boolean][] = [
  // [url, permissions (une suffit), présent dans le menu]
  ["/tableau-de-bord", "general", true],
  ["/missions", ["missions.read_assigned", "dossiers.read_assigned"], true],
  ["/planning", LECTURE_MISSIONS, true],
  ["/dossiers", LECTURE_DOSSIERS, true],
  ["/dossiers/nouveau", ["dossiers.create"], true],
  ["/clients", ["clients.read"], true],
  ["/clients/nouveau", ["clients.write"], false],
  ["/achats", ["achats.read"], true],
  ["/fournisseurs", LECTURE_FOURNISSEURS, true],
  ["/finance", ["factures.write"], true],
  ["/devis", ["devis.read"], true],
  ["/factures", ["factures.read"], true],
  ["/paiements", ["paiements.write"], true],
  ["/services", ["services.manage", "devis.write"], false],
  ["/rapports", ["reports.read"], true],
  ["/admin/utilisateurs", ["admin.users"], true],
  ["/admin/roles", ["admin.users"], true],
  ["/admin/parametres", ["admin.settings"], true],
  ["/admin/audit", ["audit.read"], true],
  ["/profil", "tous", false],
]
const MENU_SERVICES = (p: Permission[]) => aUne(p, "services.manage")

async function cookie(email: string) {
  const jar = new Map<string, string>()
  const sb = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)),
    },
  })
  const { error } = await sb.auth.signInWithPassword({ email, password: "AtlasTest2026!" })
  if (error) throw new Error(`${email} : ${error.message}`)
  jar.set("atlas_org", ORG)
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ")
}

let echecs = 0
for (const [compte, roles] of COMPTES) {
  const perms = permissionsDe(roles)
  const general = perms.some((p) => !["dossiers.read_assigned", "missions.read_assigned", "missions.report"].includes(p))
  const autorise = (r: Regle) => (r === "tous" ? true : r === "general" ? general : aUne(perms, ...r))
  const c = await cookie(`${compte}@atlas-erp.test`)

  const attendusMenu = PAGES.filter(([, r, menu]) => menu && autorise(r)).map(([u]) => u)
  if (MENU_SERVICES(perms)) attendusMenu.push("/services")
  const html = await (await fetch(`${BASE}/profil`, { headers: { cookie: c } })).text()
  const menu = [...html.matchAll(/data-sidebar="menu-button"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*data-sidebar="menu-button"/g)].map(
    (m) => m[1] ?? m[2]
  )
  const menuOk = JSON.stringify([...menu].sort()) === JSON.stringify([...attendusMenu].sort())
  if (!menuOk) echecs++

  const lignes: string[] = []
  for (const [url, regle] of PAGES) {
    const res = await fetch(`${BASE}${url}`, { headers: { cookie: c }, redirect: "manual" })
    const attendu = url === "/tableau-de-bord" && !general ? 307 : autorise(regle) ? 200 : 403
    const ok = res.status === attendu
    if (!ok) echecs++
    lignes.push(`${ok ? "  ok " : "  KO "} ${url.padEnd(20)} ${res.status}${ok ? "" : ` (attendu ${attendu})`}`)
  }
  console.log(`\n${compte} [${roles.join(" + ")}] — ${perms.length} permissions`)
  console.log(`  menu ${menuOk ? "ok" : "KO"} : ${menu.join(", ") || "(vide)"}`)
  if (!menuOk) console.log(`  menu attendu : ${attendusMenu.join(", ")}`)
  console.log(lignes.join("\n"))
}
console.log(`\n${echecs === 0 ? "Tous les contrôles d'accès sont conformes." : `${echecs} écart(s).`}`)
process.exitCode = echecs ? 1 : 0
