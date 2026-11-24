"use client"

import { ChevronsUpDownIcon, CheckIcon } from "lucide-react"

import { Logo } from "@/components/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type Org = { id: string; nom: string; sigle: string | null }

/** Sélecteur d'organisation (bloc sidebar-07 « team switcher » adapté). */
export function OrgSwitcher({ active, organisations }: { active: Org; organisations: Org[] }) {
  const { isMobile } = useSidebar()
  const plusieurs = organisations.length > 1

  const entete = (
    <>
      <Logo taille={32} className="rounded-md" />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-semibold">{active.nom}</span>
        <span className="truncate text-xs text-sidebar-foreground/70">Atlas ERP</span>
      </div>
    </>
  )

  if (!plusieurs) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" render={<div />} className="hover:bg-transparent">
            {entete}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            {entete}
            <ChevronsUpDownIcon className="ml-auto" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organisations
              </DropdownMenuLabel>
              {organisations.map((o) => (
                <DropdownMenuItem
                  key={o.id}
                  className="gap-2 p-2"
                  render={<a href={`/auth/organisation?id=${o.id}&suivant=/tableau-de-bord`} />}
                >
                  <span className="flex-1 truncate">{o.nom}</span>
                  {o.id === active.id && <CheckIcon className="size-4" aria-label="active" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
