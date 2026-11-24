"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type NavItem = { titre: string; url: string; icone: React.ReactNode }
export type NavGroupe = { titre: string; items: NavItem[] }

export function NavMain({ groupes }: { groupes: NavGroupe[] }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  // L'élément actif est celui dont l'URL est le préfixe le plus long du chemin courant
  const toutes = groupes.flatMap((g) => g.items.map((i) => i.url))
  const active = toutes
    .filter((u) => pathname === u || pathname.startsWith(`${u}/`))
    .sort((a, b) => b.length - a.length)[0]

  return (
    <>
      {groupes.map((groupe) => (
        <SidebarGroup key={groupe.titre}>
          <SidebarGroupLabel>{groupe.titre}</SidebarGroupLabel>
          <SidebarMenu>
            {groupe.items.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  tooltip={item.titre}
                  isActive={item.url === active}
                  render={
                    <Link
                      href={item.url}
                      aria-current={item.url === active ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                >
                  {item.icone}
                  <span>{item.titre}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
