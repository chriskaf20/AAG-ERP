import { getTranslations } from "next-intl/server"
import type { Database } from "@/lib/database.types"
import { formatDate } from "@/lib/format"

type Piece = Database["public"]["Functions"]["portail_documents"]["Returns"][number]

export async function DocumentsPartages({ documents }: { documents: Piece[] }) {
  const t = await getTranslations("documents")
  return <section className="grid gap-2">
    <h2 className="text-lg font-semibold">Documents partagés</h2>
    {documents.length === 0 && <p className="text-sm text-muted-foreground">Aucun document partagé.</p>}
    <ul className="grid gap-2">
      {documents.map(d => <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border p-3">
        <a href={"/portail/documents/" + d.id} className="font-medium underline">{d.libelle ?? d.nom_fichier}</a>
        <span className="text-sm text-muted-foreground">{t.has(d.type) ? t(d.type) : d.type} · v{d.version} · {formatDate(d.partage_le)}</span>
      </li>)}
    </ul>
  </section>
}
