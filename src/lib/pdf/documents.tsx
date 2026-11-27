import "server-only"

import fs from "node:fs/promises"
import path from "node:path"
import {
  Document,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

const MARINE = "#0B1F4B"
const OR = "#C9A13B"
const GRIS = "#5b6478"
const BORD = "#e2e6ee"

export type OrgPdf = {
  nom: string
  sigle: string | null
  rccm: string | null
  nif: string | null
  id_nat: string | null
  adresse: string | null
  telephone: string | null
  email: string | null
}

export type ClientPdf = {
  raison_sociale: string
  adresse: string | null
  rccm: string | null
  nif: string | null
  id_nat: string | null
  telephone: string | null
  email: string | null
  contact: string | null
}

export type LignePdf = {
  description: string
  quantite: number
  unite: string
  prix_unitaire: number
  remise_pct: number
  montant_ht: number
}

export type TotauxPdf = {
  devise: string
  total_brut: number
  total_remise: number
  total_ht: number
  total_taxes: number
  arrondi?: number
  total_ttc: number
  taxes: { libelle?: string; code: string; taux: number }[]
}

export type SignaturePdf = { nom: string; signe_le: string; image_png: string; ip?: string | null }

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 60, fontSize: 9, fontFamily: "Helvetica", color: "#0a1430" },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 78, height: 78, objectFit: "contain" },
  org: { textAlign: "right", fontSize: 8, color: GRIS, lineHeight: 1.4 },
  orgNom: { fontSize: 11, fontFamily: "Helvetica-Bold", color: MARINE, marginBottom: 2 },
  bandeau: {
    marginTop: 14,
    backgroundColor: MARINE,
    color: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titre: { fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  numero: { fontSize: 10, color: OR, fontFamily: "Helvetica-Bold" },
  mention: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: OR,
    color: "#8a6d1f",
    padding: 5,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  blocs: { flexDirection: "row", gap: 12, marginTop: 12 },
  bloc: { flex: 1, borderWidth: 1, borderColor: BORD, borderRadius: 4, padding: 8, lineHeight: 1.4 },
  blocTitre: { fontSize: 7, color: GRIS, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  gras: { fontFamily: "Helvetica-Bold" },
  table: { marginTop: 14, borderWidth: 1, borderColor: BORD, borderRadius: 4 },
  ligneEntete: { flexDirection: "row", backgroundColor: "#f1f3f8", borderBottomWidth: 1, borderColor: BORD },
  ligne: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORD },
  cDesc: { flex: 5, padding: 5 },
  cQte: { flex: 1.2, padding: 5, textAlign: "right" },
  cPu: { flex: 1.6, padding: 5, textAlign: "right" },
  cRem: { flex: 1, padding: 5, textAlign: "right" },
  cTot: { flex: 1.8, padding: 5, textAlign: "right" },
  totaux: { marginTop: 10, marginLeft: "auto", width: 230 },
  totalLigne: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalTtc: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: MARINE,
    color: "#ffffff",
    padding: 6,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
  },
  texte: { marginTop: 12, lineHeight: 1.5 },
  signatures: { flexDirection: "row", gap: 12, marginTop: 18 },
  signature: { flex: 1, borderWidth: 1, borderColor: BORD, borderRadius: 4, padding: 8, minHeight: 90 },
  signatureImg: { height: 50, objectFit: "contain", marginVertical: 4 },
  pied: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderColor: OR,
    paddingTop: 5,
    fontSize: 7,
    color: GRIS,
    textAlign: "center",
  },
})

/** Montant lisible en PDF (polices standard : pas d'espace fine insécable) */
export function montantPdf(n: number | null | undefined, devise: string) {
  if (n == null) return "—"
  const v = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: devise === "CDF" ? 0 : 2,
    maximumFractionDigits: devise === "CDF" ? 0 : 2,
  })
    .format(n)
    .replace(/[  ]/g, " ")
  return `${v} ${devise}`
}

export function datePdf(d: string | null | undefined) {
  if (!d) return "—"
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`) : new Date(d)
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Lubumbashi" }).format(date)
}

function dateHeurePdf(d: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Africa/Lubumbashi",
  })
    .format(new Date(d))
    .replace(/[  ]/g, " ")
}

let logoCache: Buffer | null | undefined
async function logo() {
  if (logoCache === undefined) {
    logoCache = await fs.readFile(path.join(process.cwd(), "public", "logo-pdf.png")).catch(() => null)
  }
  return logoCache
}

function Entete({ org, logo }: { org: OrgPdf; logo: Buffer | null }) {
  return (
    <View style={s.entete}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {logo ? <Image style={s.logo} src={{ data: logo, format: "png" }} /> : <Text style={s.orgNom}>{org.sigle ?? org.nom}</Text>}
      <View style={s.org}>
        <Text style={s.orgNom}>{org.nom}</Text>
        {org.adresse && <Text>{org.adresse}</Text>}
        {org.telephone && <Text>Tél. {org.telephone}</Text>}
        {org.email && <Text>{org.email}</Text>}
        <Text>
          {[org.rccm && `RCCM ${org.rccm}`, org.nif && `NIF ${org.nif}`, org.id_nat && `Id. Nat. ${org.id_nat}`]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </View>
  )
}

function Pied({ org }: { org: OrgPdf }) {
  return (
    <View style={s.pied} fixed>
      <Text>
        {org.nom}
        {org.rccm ? ` — RCCM ${org.rccm}` : ""}
        {org.nif ? ` — NIF ${org.nif}` : ""}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function BlocClient({ client, titre = "Client" }: { client: ClientPdf; titre?: string }) {
  return (
    <View style={s.bloc}>
      <Text style={s.blocTitre}>{titre}</Text>
      <Text style={s.gras}>{client.raison_sociale}</Text>
      {client.contact && <Text>À l&apos;attention de {client.contact}</Text>}
      {client.adresse && <Text>{client.adresse}</Text>}
      {(client.telephone || client.email) && (
        <Text>{[client.telephone, client.email].filter(Boolean).join(" · ")}</Text>
      )}
      {(client.rccm || client.nif || client.id_nat) && (
        <Text>
          {[client.rccm && `RCCM ${client.rccm}`, client.nif && `NIF ${client.nif}`, client.id_nat && `Id. Nat. ${client.id_nat}`]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      )}
    </View>
  )
}

function Lignes({ lignes, devise }: { lignes: LignePdf[]; devise: string }) {
  return (
    <View style={s.table}>
      <View style={s.ligneEntete}>
        <Text style={[s.cDesc, s.gras]}>Désignation</Text>
        <Text style={[s.cQte, s.gras]}>Qté</Text>
        <Text style={[s.cPu, s.gras]}>P.U. HT</Text>
        <Text style={[s.cRem, s.gras]}>Remise</Text>
        <Text style={[s.cTot, s.gras]}>Montant HT</Text>
      </View>
      {lignes.map((l, i) => (
        <View key={i} style={s.ligne} wrap={false}>
          <Text style={s.cDesc}>{l.description}</Text>
          <Text style={s.cQte}>
            {String(l.quantite).replace(".", ",")} {l.unite}
          </Text>
          <Text style={s.cPu}>{montantPdf(l.prix_unitaire, devise)}</Text>
          <Text style={s.cRem}>{l.remise_pct ? `${String(l.remise_pct).replace(".", ",")} %` : "—"}</Text>
          <Text style={s.cTot}>{montantPdf(l.montant_ht, devise)}</Text>
        </View>
      ))}
    </View>
  )
}

function Totaux({ t, extra }: { t: TotauxPdf; extra?: { libelle: string; montant: number }[] }) {
  return (
    <View style={s.totaux} wrap={false}>
      {t.total_remise > 0 && (
        <>
          <View style={s.totalLigne}>
            <Text>Total brut HT</Text>
            <Text>{montantPdf(t.total_brut, t.devise)}</Text>
          </View>
          <View style={s.totalLigne}>
            <Text>Remises</Text>
            <Text>- {montantPdf(t.total_remise, t.devise)}</Text>
          </View>
        </>
      )}
      <View style={s.totalLigne}>
        <Text style={s.gras}>Total HT</Text>
        <Text style={s.gras}>{montantPdf(t.total_ht, t.devise)}</Text>
      </View>
      {t.taxes.map((x) => (
        <View key={x.code} style={s.totalLigne}>
          <Text>
            {x.libelle ?? x.code} {String(x.taux).replace(".", ",")} %
          </Text>
          <Text>{montantPdf(Math.round(t.total_ht * x.taux) / 100, t.devise)}</Text>
        </View>
      ))}
      {!!t.arrondi && <View style={s.totalLigne}>
        <Text>Arrondi</Text>
        <Text>{montantPdf(t.arrondi, t.devise)}</Text>
      </View>}
      <View style={s.totalTtc}>
        <Text>Total TTC</Text>
        <Text>{montantPdf(t.total_ttc, t.devise)}</Text>
      </View>
      {extra?.map((e) => (
        <View key={e.libelle} style={s.totalLigne}>
          <Text style={s.gras}>{e.libelle}</Text>
          <Text style={s.gras}>{montantPdf(e.montant, t.devise)}</Text>
        </View>
      ))}
    </View>
  )
}

function CadreSignature({ titre, sig }: { titre: string; sig?: SignaturePdf | null }) {
  return (
    <View style={s.signature} wrap={false}>
      <Text style={s.blocTitre}>{titre}</Text>
      {sig ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.signatureImg} src={sig.image_png} />
          <Text style={s.gras}>{sig.nom}</Text>
          <Text style={{ color: GRIS, fontSize: 7 }}>
            Signé électroniquement le {dateHeurePdf(sig.signe_le)}
            {sig.ip ? ` — IP ${sig.ip}` : ""}
          </Text>
        </>
      ) : (
        <Text style={{ color: GRIS, marginTop: 30 }}>Nom, date et signature</Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Devis
// ---------------------------------------------------------------------------
export type DevisPdfProps = {
  org: OrgPdf
  client: ClientPdf
  dossierNumero: string
  devis: {
    numero: string
    version: number
    objet: string | null
    date_devis: string
    date_validite: string | null
    conditions_paiement: string | null
    acompte_pct: number | null
  }
  totaux: TotauxPdf
  lignes: LignePdf[]
  signature?: SignaturePdf | null
}

function DevisDoc(p: DevisPdfProps & { logo: Buffer | null }) {
  return (
    <Document title={`Devis ${p.devis.numero} v${p.devis.version}`} author={p.org.nom}>
      <Page size="A4" style={s.page}>
        <Entete org={p.org} logo={p.logo} />
        <View style={s.bandeau}>
          <Text style={s.titre}>DEVIS</Text>
          <Text style={s.numero}>
            {p.devis.numero} — version {p.devis.version}
          </Text>
        </View>
        <View style={s.blocs}>
          <BlocClient client={p.client} />
          <View style={s.bloc}>
            <Text style={s.blocTitre}>Références</Text>
            <Text>
              Dossier : <Text style={s.gras}>{p.dossierNumero}</Text>
            </Text>
            <Text>Date : {datePdf(p.devis.date_devis)}</Text>
            <Text>Valable jusqu&apos;au : {datePdf(p.devis.date_validite)}</Text>
            {p.devis.objet && <Text>Objet : {p.devis.objet}</Text>}
          </View>
        </View>
        <Lignes lignes={p.lignes} devise={p.totaux.devise} />
        <Totaux t={p.totaux} />
        <View style={s.texte}>
          {p.devis.acompte_pct ? (
            <Text>
              Acompte à la commande : {String(p.devis.acompte_pct).replace(".", ",")} % soit{" "}
              {montantPdf(Math.round(p.totaux.total_ttc * p.devis.acompte_pct) / 100, p.totaux.devise)} TTC.
            </Text>
          ) : null}
          {p.devis.conditions_paiement && <Text>Conditions de paiement : {p.devis.conditions_paiement}</Text>}
          <Text style={{ color: GRIS }}>
            Devis valable 30 jours à compter de sa date d&apos;émission, sauf mention contraire.
          </Text>
        </View>
        <View style={s.signatures}>
          <CadreSignature titre={`Pour ${p.org.sigle ?? p.org.nom}`} />
          <CadreSignature titre="Bon pour accord — le client" sig={p.signature} />
        </View>
        <Pied org={p.org} />
      </Page>
    </Document>
  )
}

export async function pdfDevis(p: DevisPdfProps) {
  return renderToBuffer(<DevisDoc {...p} logo={await logo()} />)
}

// ---------------------------------------------------------------------------
// Facture
// ---------------------------------------------------------------------------
export type FacturePdfProps = {
  org: OrgPdf
  client: ClientPdf
  dossierNumero: string
  facture: {
    numero: string | null
    type: string
    objet: string | null
    date_emission: string | null
    echeance: string | null
    devis_numero: string | null
    montant_paye: number
    montant_avoirs: number
    solde_du: number
    numero_facture_normalisee: string | null
    code_authentification_def: string | null
    qr_code: string | null
    normalisee_le: string | null
  }
  totaux: TotauxPdf
  lignes: LignePdf[]
}

const TYPES: Record<string, string> = { acompte: "d'acompte", solde: "de solde", mensuelle: "mensuelle" }

function FactureDoc(p: FacturePdfProps & { logo: Buffer | null }) {
  const f = p.facture
  const normalisee = Boolean(f.normalisee_le)
  return (
    <Document title={`Facture ${f.numero ?? "brouillon"}`} author={p.org.nom}>
      <Page size="A4" style={s.page}>
        <Entete org={p.org} logo={p.logo} />
        <View style={s.bandeau}>
          <Text style={s.titre}>{normalisee ? "FACTURE" : "FACTURE PRO FORMA"}</Text>
          <Text style={s.numero}>{f.numero ?? "BROUILLON"}</Text>
        </View>
        {normalisee ? (
          <View style={[s.mention, { borderColor: MARINE, color: MARINE }]}>
            <Text>
              Facture normalisée n° {f.numero_facture_normalisee} — Code DEF : {f.code_authentification_def}
            </Text>
          </View>
        ) : (
          <Text style={s.mention}>
            Facture pro forma — en attente de normalisation DGI (e-DEF). Ne vaut pas facture définitive.
          </Text>
        )}
        <View style={s.blocs}>
          <BlocClient client={p.client} titre="Facturé à" />
          <View style={s.bloc}>
            <Text style={s.blocTitre}>Références</Text>
            <Text>Facture {TYPES[f.type] ?? f.type}</Text>
            <Text>
              Dossier : <Text style={s.gras}>{p.dossierNumero}</Text>
            </Text>
            {f.devis_numero && <Text>Devis : {f.devis_numero}</Text>}
            <Text>Date d&apos;émission : {datePdf(f.date_emission)}</Text>
            <Text>
              Échéance : <Text style={s.gras}>{datePdf(f.echeance)}</Text>
            </Text>
            {f.objet && <Text>Objet : {f.objet}</Text>}
          </View>
        </View>
        <Lignes lignes={p.lignes} devise={p.totaux.devise} />
        <Totaux
          t={p.totaux}
          extra={[
            ...(f.montant_avoirs > 0 ? [{ libelle: "Avoirs", montant: -f.montant_avoirs }] : []),
            ...(f.montant_paye > 0 ? [{ libelle: "Déjà réglé", montant: -f.montant_paye }] : []),
            { libelle: "Reste à payer", montant: f.solde_du },
          ]}
        />
        {normalisee && f.qr_code && (
          <View style={s.texte}>
            <Text style={s.blocTitre}>Données QR DGI</Text>
            <Text style={{ fontSize: 7, color: GRIS }}>{f.qr_code}</Text>
          </View>
        )}
        <View style={s.texte}>
          <Text>
            Règlement par virement bancaire, M-Pesa, Airtel Money, Orange Money ou espèces, en rappelant la référence{" "}
            {f.numero ?? ""}.
          </Text>
        </View>
        <Pied org={p.org} />
      </Page>
    </Document>
  )
}

export async function pdfFacture(p: FacturePdfProps) {
  return renderToBuffer(<FactureDoc {...p} logo={await logo()} />)
}

// ---------------------------------------------------------------------------
// Reçu de paiement
// ---------------------------------------------------------------------------
export type RecuPdfProps = {
  org: OrgPdf
  client: ClientPdf
  dossierNumero: string
  paiement: {
    numero_recu: string
    montant: number
    devise: string
    mode: string
    reference: string | null
    date_paiement: string
  }
  facture: { numero: string | null; total_ttc: number; solde_du: number }
}

function RecuDoc(p: RecuPdfProps & { logo: Buffer | null }) {
  return (
    <Document title={`Reçu ${p.paiement.numero_recu}`} author={p.org.nom}>
      <Page size="A5" orientation="landscape" style={s.page}>
        <Entete org={p.org} logo={p.logo} />
        <View style={s.bandeau}>
          <Text style={s.titre}>REÇU DE PAIEMENT</Text>
          <Text style={s.numero}>{p.paiement.numero_recu}</Text>
        </View>
        <View style={s.blocs}>
          <BlocClient client={p.client} titre="Reçu de" />
          <View style={s.bloc}>
            <Text style={s.blocTitre}>Paiement</Text>
            <Text>
              Montant : <Text style={s.gras}>{montantPdf(p.paiement.montant, p.paiement.devise)}</Text>
            </Text>
            <Text>Date : {datePdf(p.paiement.date_paiement)}</Text>
            <Text>Mode : {p.paiement.mode}</Text>
            {p.paiement.reference && <Text>Référence : {p.paiement.reference}</Text>}
            <Text>
              Facture : {p.facture.numero} — dossier {p.dossierNumero}
            </Text>
            <Text>Reste dû sur la facture : {montantPdf(p.facture.solde_du, p.paiement.devise)}</Text>
          </View>
        </View>
        <View style={s.signatures}>
          <CadreSignature titre={`Pour ${p.org.sigle ?? p.org.nom}`} />
        </View>
        <Pied org={p.org} />
      </Page>
    </Document>
  )
}

export async function pdfRecu(p: RecuPdfProps) {
  return renderToBuffer(<RecuDoc {...p} logo={await logo()} />)
}
