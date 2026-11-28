import type { Metadata } from "next"
import Link from "next/link"

import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getContexte } from "@/lib/contexte"

export const metadata: Metadata = { title: "Cahiers des charges F-03" }

export default async function CahiersDesCharges() {
  const { supabase, organisation } = await getContexte()
  const { data, error } = await supabase.rpc("dossiers_f03", { p_org: organisation.id })
  if (error) throw error

  return (
    <>
      <SiteHeader titre="Cahiers des charges F-03" />
      <PageBody>
        <Section>
          <Card>
            <CardHeader><CardTitle>Dossiers de création et de refonte</CardTitle></CardHeader>
            <CardContent>
              {!data?.length ? <p className="text-sm text-muted-foreground">Aucun dossier web accessible.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Dossier</TableHead><TableHead>Client</TableHead><TableHead>Service</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.map(d => <TableRow key={d.id}>
                      <TableCell><Link className="font-medium text-primary underline underline-offset-2" href={`/f03/${d.id}`}>{d.numero}</Link></TableCell>
                      <TableCell>{d.client}</TableCell>
                      <TableCell>{d.service}</TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Section>
      </PageBody>
    </>
  )
}
