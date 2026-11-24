"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { OrgSwitcher } from "@/components/org-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { NavGroupe } from "@/lib/navigation"

export type AppSidebarProps = {
  organisation: { id: string; nom: string; sigle: string | null }
  organisations: { id: string; nom: string; sigle: string | null }[]
  utilisateur: { nom: string; email: string; roles: string }
  groupes: NavGroupe[]
} & React.ComponentProps<typeof Sidebar>

export function AppSidebar({ organisation, organisations, utilisateur, groupes, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrgSwitcher active={organisation} organisations={organisations} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groupes={groupes} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser utilisateur={utilisateur} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
