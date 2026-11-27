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

export default async function PageStock({ searchParams }: { searchParams: Promise<{ historique?: string }> }) {
  const [{ supabase, organisation, permissions, roles }, params] = await Promise.all([
    exiger("achats.read", "achats.write"), searchParams,
  ])
  const historique = Math.max(1, Math.trunc(Number(params.historique) || 1))
  const offset = (Number.isSafeInteger(historique) ? historique - 1 : 0) * 50
  const [articles, emplacements, quantites, mouvements] = await Promise.all([
    supabase.from("stock_articles").select("*").eq("organization_id", organisation.id).order("code"),
    supabase.from("stock_emplacements").select("*").eq("organization_id", organisation.id).order("nom"),
    supabase.from("stock_quantites").select("*").eq("organization_id", organisation.id),
    supabase.from("stock_mouvements").select("*").eq("organization_id", organisation.id)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 50),
  ])
  if (articles.error) throw articles.error
  if (emplacements.error) throw emplacements.error
  if (quantites.error) throw quantites.error
  if (mouvements.error) throw mouvements.error

  const articlesParId = new Map(articles.data.map(a => [a.id, a]))
  const emplacementsParId = new Map(emplacements.data.map(e => [e.id, e]))
  const valeurs = new Map(quantites.data.map(q => [q.article_id + q.emplacement_id, q.quantite]))
  const defaut = emplacements.data.find(e => e.par_defaut)
  return <>
    <SiteHeader titre="Stock" sousTitre={defaut ? "Emplacement par défaut · " + defaut.nom : undefined} />
    <PageBody>
      <Section className="grid gap-4">
        {permissions.includes("achats.write") && <OperationsStock articles={articles.data} emplacements={emplacements.data}
          parametrer={roles.includes("gerant")} />}
        <h2 className="font-semibold">Quantités par emplacement</h2>
        {!articles.data.length && <p>Aucun article enregistré.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {articles.data.map(a => <li key={a.id} className="rounded-md border p-3">
            <h3 className="font-medium">{a.code} · {a.nom}</h3>
            <ul className="grid gap-1 text-sm">
              {emplacements.data.map(e => <li key={e.id}>{e.nom} · {formatQuantite.format(valeurs.get(a.id + e.id) ?? 0)} {a.unite}</li>)}
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
