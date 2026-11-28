// Relances quotidiennes (cron) : devis non signés J+7, factures impayées J+7 / J+15 / J+30.
// Appelée par pg_cron (pg_net) avec l'en-tête x-cron-secret.
import { createClient } from "jsr:@supabase/supabase-js@2"

type Relance = {
  objet_type: "devis" | "facture"
  objet_id: string
  niveau: "j7" | "j15" | "j30"
  organization_id: string
  dossier_id: string
  dossier_numero: string
  numero: string
  montant: number
  devise: string
  echeance: string
  email: string | null
  destinataire_nom: string | null
  org_nom: string
  org_email: string | null
  token: string | null
  simulation: boolean
}

const APP_URL = Deno.env.get("APP_URL") ?? "https://aag-erp.vercel.app"
const FROM = Deno.env.get("RESEND_FROM") ?? "facturation@atlasafricagroup.com"

const echap = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

const montant = (n: number, devise: string) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: devise === "CDF" ? 0 : 2 }).format(n)} ${devise}`

const date = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Lubumbashi" }).format(new Date(`${d}T12:00:00Z`))

function contenu(r: Relance) {
  const bonjour = `Bonjour${r.destinataire_nom ? ` ${echap(r.destinataire_nom)}` : ""},`
  if (r.objet_type === "devis") {
    const lien = r.token ? `${APP_URL}/signer/${r.token}` : null
    return {
      sujet: `Rappel : devis ${r.numero} en attente de signature`,
      html: `<p>${bonjour}</p>
<p>Notre devis <strong>${echap(r.numero)}</strong> (dossier ${echap(r.dossier_numero)}) d'un montant de
<strong>${montant(r.montant, r.devise)}</strong> est toujours en attente de votre accord.
Il reste valable jusqu'au ${date(r.echeance)}.</p>
${lien ? `<p><a href="${lien}" style="background:#0B1F4B;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Consulter et signer le devis</a></p>` : ""}
<p>Nous restons à votre disposition pour toute question.</p>
<p>${echap(r.org_nom)}</p>`,
    }
  }
  const prefixe = r.niveau === "j30" ? "Dernier rappel" : r.niveau === "j15" ? "Second rappel" : "Rappel"
  return {
    sujet: `${prefixe} : facture ${r.numero} — ${montant(r.montant, r.devise)} restant dû`,
    html: `<p>${bonjour}</p>
<p>Sauf erreur de notre part, la facture <strong>${echap(r.numero)}</strong> (dossier ${echap(r.dossier_numero)}),
échue le ${date(r.echeance)}, présente un solde de <strong>${montant(r.montant, r.devise)}</strong>.</p>
<p>Merci de procéder au règlement (virement, M-Pesa, Airtel Money, Orange Money) en rappelant la référence de la facture.
Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.</p>
<p>${echap(r.org_nom)}</p>`,
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET")
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("Non autorisé", { status: 401 })
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  })

  const { data: taches, error: errTaches } = await db.rpc("taches_quotidiennes")
  if (errTaches) return Response.json({ erreur: errTaches.message }, { status: 500 })

  // relances_a_envoyer() ne renvoie que les organisations dont relances_actives = true
  const { data, error } = await db.rpc("relances_a_envoyer")
  if (error) return Response.json({ erreur: error.message }, { status: 500 })

  const cle = Deno.env.get("RESEND_API_KEY")
  const bilan = { envoyees: 0, simulees: 0, echecs: 0, ignorees: 0 }
  for (const r of (data ?? []) as Relance[]) {
    if (!r.email || r.email.toLowerCase().endsWith(".test")) {
      bilan.ignorees++
      continue
    }
    let statut: "envoyee" | "echec" | "simulee" = "echec"
    let erreur: string | null = null
    if (r.simulation) {
      statut = "simulee"
    } else if (!cle) {
      bilan.ignorees++
      continue
    } else {
      const { sujet, html } = contenu(r)
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${r.org_nom} <${FROM}>`,
          to: [r.email],
          reply_to: r.org_email ?? undefined,
          subject: sujet,
          html,
        }),
      })
      if (res.ok) statut = "envoyee"
      else erreur = `Resend ${res.status} : ${(await res.text()).slice(0, 300)}`
    }
    await db.rpc("enregistrer_relance", {
      p_org: r.organization_id,
      p_dossier: r.dossier_id,
      p_objet_type: r.objet_type,
      p_objet_id: r.objet_id,
      p_niveau: r.niveau,
      p_destinataire: r.email,
      p_statut: statut,
      p_erreur: erreur,
    })
    bilan[statut === "envoyee" ? "envoyees" : statut === "simulee" ? "simulees" : "echecs"]++
  }

  return Response.json({ taches, ...bilan })
})
