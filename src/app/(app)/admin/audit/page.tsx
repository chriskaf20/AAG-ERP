import type { Metadata } from "next"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exiger } from "@/lib/contexte"
import { formatDateHeure } from "@/lib/format"
import { membresOrganisation } from "@/lib/membres"

export const metadata: Metadata = { title: "Journal d'audit" }

export default async function JournalAudit() {
  const ctx = await exiger("audit.read")
  const [{ data }, membres] = await Promise.all([
    ctx.supabase
      .from("audit_log")
      .select("id, table_name, record_id, action, changed_fields, motif, created_at, created_by")
      .eq("organization_id", ctx.organisation.id)
      .order("created_at", { ascending: false })
      .limit(300),
    membresOrganisation(ctx),
  ])
  const nom = (id: string | null) => (id ? (membres.find((m) => m.id === id)?.nom ?? "—") : "Système")

  return (
    <>
      <SiteHeader titre="Journal d'audit" sousTitre="300 dernières opérations (lecture seule)" />
      <PageBody>
        <Section>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{formatDateHeure(l.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{nom(l.created_by)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.action}</Badge>
                    </TableCell>
                    <TableCell>{l.table_name}</TableCell>
                    <TableCell className="max-w-96 truncate text-muted-foreground">
                      {l.motif ?? l.changed_fields?.join(", ") ?? l.record_id}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      </PageBody>
    </>
  )
}
