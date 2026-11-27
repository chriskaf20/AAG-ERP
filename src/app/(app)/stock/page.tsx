import type { Metadata } from "next"
import { ButtonLink } from "@/components/button-link"
import { PageBody, Section } from "@/components/page-body"
import { SiteHeader } from "@/components/site-header"
import { exiger } from "@/lib/contexte"
import { formatDateHeure } from "@/lib/format"

import { OperationsStock } from "./operations"

export const metadata: Metadata = { title: "Stock" }
const libelles: Record<string, string> = { reception: "Réception d’achat", sortie: "Sortie", ajustement: "Ajustement" }
const formatQuantite = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 })

async function toutesLesLignes<T extends { id: string }>(
  page: (apres: string | undefined) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const lignes: T[] = []
  for (;;) {
    const { data, error } = await page(lignes.at(-1)?.id)
    if (error) throw error
    if (!data?.length) return lignes
    lignes.push(...data)
  }
}

export default async function PageStock({ searchParams }: { searchParams: Promise<{ historique?: string }> }) {
  const [{ supabase, organisation, permissions, roles }, params] = await Promise.all([
    exiger("achats.read", "achats.write"), searchParams,
  ])
  const historique = Math.max(1, Math.trunc(Number(params.historique) || 1))
  const offset = (Number.isSafeInteger(historique) ? historique - 1 : 0) * 50
  const [articles, emplacements, quantites, mouvements] = await Promise.all([
    toutesLesLignes(apres => {
      const q = supabase.from("stock_articles").select("*").eq("organization_id", organisation.id).order("id").limit(500)
      return apres ? q.gt("id", apres) : q
    }),
    toutesLesLignes(apres => {
      const q = supabase.from("stock_emplacements").select("*").eq("organization_id", organisation.id).order("id").limit(500)
      return apres ? q.gt("id", apres) : q
    }),
    toutesLesLignes(apres => {
      const q = supabase.from("stock_quantites").select("*").eq("organization_id", organisation.id).order("id").limit(500)
      return apres ? q.gt("id", apres) : q
    }),
    supabase.from("stock_mouvements").select("*").eq("organization_id", organisation.id)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 50),
  ])
  if (mouvements.error) throw mouvements.error
  articles.sort((a, b) => a.code.localeCompare(b.code, "fr"))
  emplacements.sort((a, b) => a.nom.localeCompare(b.nom, "fr"))

  const articlesParId = new Map(articles.map(a => [a.id, a]))
  const emplacementsParId = new Map(emplacements.map(e => [e.id, e]))
  const valeurs = new Map(quantites.map(q => [q.article_id + q.emplacement_id, q.quantite]))
  const defaut = emplacements.find(e => e.par_defaut)
  return <>
    <SiteHeader titre="Stock" sousTitre={defaut ? "Emplacement par défaut · " + defaut.nom : undefined} />
    <PageBody>
      <Section className="grid gap-4">
        {permissions.includes("achats.write") && <OperationsStock articles={articles} emplacements={emplacements}
          parametrer={roles.includes("gerant")} />}
        <h2 className="font-semibold">Quantités par emplacement</h2>
        {!articles.length && <p>Aucun article enregistré.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {articles.map(a => <li key={a.id} className="rounded-md border p-3">
            <h3 className="font-medium">{a.code} · {a.nom}</h3>
            <ul className="grid gap-1 text-sm">
              {emplacements.map(e => <li key={e.id}>{e.nom} · {formatQuantite.format(valeurs.get(a.id + e.id) ?? 0)} {a.unite}</li>)}
            </ul>
          </li>)}
        </ul>
        <h2 id="historique" className="font-semibold">Historique des mouvements</h2>
        {!mouvements.data.length && <p>Aucun mouvement sur cette page.</p>}
        <ul className="grid gap-2">
          {mouvements.data.slice(0, 50).map(m => {
            const a = articlesParId.get(m.article_id)
            return <li key={m.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{a?.code} · {a?.nom} · {emplacementsParId.get(m.emplacement_id)?.nom}</p>
              <p>{formatDateHeure(m.created_at)} · {libelles[m.type]} · {m.quantite > 0 && "+"}{formatQuantite.format(m.quantite)} {a?.unite}</p>
              {m.motif && <p>{m.motif}</p>}
            </li>
          })}
        </ul>
        <nav aria-label="Pages de l’historique" className="flex gap-2">
          {historique > 1 && <ButtonLink href={`/stock?historique=${historique - 1}#historique`} variant="outline">Précédent</ButtonLink>}
          {mouvements.data.length > 50 && <ButtonLink href={`/stock?historique=${historique + 1}#historique`} variant="outline">Suivant</ButtonLink>}
        </nav>
      </Section>
    </PageBody>
  </>
}
