"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  FilePlus2Icon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersIcon,
  Building2Icon,
} from "lucide-react"

import { NavMain, type NavGroupe } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { OrgSwitcher } from "@/components/org-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { peut, type AppRole } from "@/lib/permissions"

export type AppSidebarProps = {
  organisation: { id: string; nom: string; sigle: string | null }
  organisations: { id: string; nom: string; sigle: string | null }[]
  utilisateur: { nom: string; email: string }
  roles: AppRole[]
} & React.ComponentProps<typeof Sidebar>

export function AppSidebar({
  organisation,
  organisations,
  utilisateur,
  roles,
  ...props
}: AppSidebarProps) {
  const t = useTranslations("nav")

  const groupes: NavGroupe[] = [
    {
      titre: "Activité",
      items: [
        { titre: t("tableauDeBord"), url: "/tableau-de-bord", icone: <LayoutDashboardIcon /> },
        { titre: t("dossiers"), url: "/dossiers", icone: <FolderKanbanIcon /> },
        ...(peut.creerDossier(roles)
          ? [{ titre: t("nouveauDossier"), url: "/dossiers/nouveau", icone: <FilePlus2Icon /> }]
          : []),
        { titre: t("clients"), url: "/clients", icone: <Building2Icon /> },
      ],
    },
  ]

  if (peut.administrer(roles)) {
    groupes.push({
      titre: t("administration"),
      items: [
        { titre: t("utilisateurs"), url: "/admin/utilisateurs", icone: <UsersIcon /> },
        { titre: t("roles"), url: "/admin/roles", icone: <ShieldCheckIcon /> },
        { titre: t("parametres"), url: "/admin/parametres", icone: <Settings2Icon /> },
      ],
    })
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrgSwitcher active={organisation} organisations={organisations} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groupes={groupes} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser utilisateur={utilisateur} roles={roles} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
