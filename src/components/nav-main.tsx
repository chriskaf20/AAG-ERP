"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BanknoteIcon,
  BarChart3Icon,
  CalendarDaysIcon,
  ClipboardListIcon,
  HistoryIcon,
  Building2Icon,
  FilePlus2Icon,
  FileSignatureIcon,
  FolderKanbanIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

import type { IconeNav, NavGroupe } from "@/lib/navigation"

const ICONES: Record<IconeNav, React.ComponentType> = {
  tableau: LayoutDashboardIcon,
  missions: ClipboardListIcon,
  planning: CalendarDaysIcon,
  rapports: BarChart3Icon,
  audit: HistoryIcon,
  dossiers: FolderKanbanIcon,
  nouveau: FilePlus2Icon,
  clients: Building2Icon,
  finance: LandmarkIcon,
  fournisseurs: TruckIcon,
  stock: PackageIcon,
  portail: FolderKanbanIcon,
  "bons-commande": ClipboardListIcon,
  devis: FileSignatureIcon,
  factures: ReceiptTextIcon,
  paiements: BanknoteIcon,
  services: PackageIcon,
  utilisateurs: UsersIcon,
  roles: ShieldCheckIcon,
  parametres: Settings2Icon,
}

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
            {groupe.items.map((item) => {
              const Icone = ICONES[item.icone]
              return (
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
                  <Icone />
                  <span>{item.titre}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
