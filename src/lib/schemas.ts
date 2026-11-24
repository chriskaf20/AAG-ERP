import { z } from "zod"

const optionnel = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)

const emailOptionnel = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "Email invalide")

export const clientSchema = z.object({
  type: z.enum(["entreprise", "particulier"]),
  raison_sociale: z.string().trim().min(2, "Raison sociale ou nom requis"),
  rccm: optionnel,
  nif: optionnel,
  id_nat: optionnel,
  adresse: optionnel,
  ville: optionnel,
  telephone: optionnel,
  email: emailOptionnel,
  notes: optionnel,
})

export const contactSchema = z.object({
  nom: z.string().trim().min(2, "Nom requis"),
  fonction: optionnel,
  telephone: optionnel,
  email: emailOptionnel,
  est_signataire: z.boolean(),
})

const date = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide")

export const dossierSchema = z
  .object({
    date_reception: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de réception requise"),
    canal: z.enum(["visite", "appel", "whatsapp", "email", "site_web"], "Canal requis"),
    // client existant ou nouveau
    client_id: optionnel,
    nouveau_client: z.boolean(),
    client_type: z.enum(["entreprise", "particulier"]).default("entreprise"),
    client_raison_sociale: optionnel,
    client_adresse: optionnel,
    client_telephone: optionnel,
    client_email: emailOptionnel,
    // contact existant ou nouveau
    contact_id: optionnel,
    contact_nom: optionnel,
    contact_fonction: optionnel,
    contact_telephone: optionnel,
    contact_email: emailOptionnel,
    service: z.string().trim().min(2, "Service demandé requis"),
    besoin: z.string().trim().min(5, "Description du besoin requise"),
    delai_souhaite: date,
    budget_indicatif: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v.replace(/\s/g, "").replace(",", ".")) : null))
      .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Montant invalide"),
    budget_devise: z.enum(["USD", "CDF"]),
    department_id: z.uuid("Département requis"),
    responsable_id: optionnel,
    pieces_recues: z.array(z.enum(["rccm", "id_nat", "nif", "piece_identite", "autre"])),
    pieces_autres: optionnel,
    accuse_reception_envoye: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.nouveau_client && !d.client_raison_sociale) {
      ctx.addIssue({ code: "custom", path: ["client_raison_sociale"], message: "Raison sociale ou nom requis" })
    }
    if (!d.nouveau_client && !d.client_id) {
      ctx.addIssue({ code: "custom", path: ["client_id"], message: "Choisissez un client" })
    }
    if (!d.contact_id && !d.contact_nom) {
      ctx.addIssue({ code: "custom", path: ["contact_nom"], message: "Personne de contact requise" })
    }
    if (d.pieces_recues.includes("autre") && !d.pieces_autres) {
      ctx.addIssue({ code: "custom", path: ["pieces_autres"], message: "Précisez les autres pièces" })
    }
  })

export const POINTS = [
  "identite_verifiee",
  "documents_valides",
  "coordonnees_confirmees",
  "signataire_habilite",
  "activite_legale",
  "capacite_atlas",
  "capacite_paiement",
  "absence_conflit",
] as const

const point = z
  .enum(["conforme", "non_conforme", ""])
  .optional()
  .transform((v) => (v === "conforme" ? true : v === "non_conforme" ? false : null))

export const verificationSchema = z.object({
  identite_verifiee: point,
  identite_verifiee_obs: optionnel,
  documents_valides: point,
  documents_valides_obs: optionnel,
  coordonnees_confirmees: point,
  coordonnees_confirmees_obs: optionnel,
  signataire_habilite: point,
  signataire_habilite_obs: optionnel,
  activite_legale: point,
  activite_legale_obs: optionnel,
  capacite_atlas: point,
  capacite_atlas_obs: optionnel,
  capacite_paiement: point,
  capacite_paiement_obs: optionnel,
  absence_conflit: point,
  absence_conflit_obs: optionnel,
  observations: optionnel,
  decision: z
    .enum(["accepte", "complement_requis", "refuse", ""])
    .optional()
    .transform((v) => (v ? v : null)),
  pieces_demandees: optionnel,
  motif: optionnel,
})

export const organisationSchema = z.object({
  nom: z.string().trim().min(2, "Nom requis"),
  sigle: optionnel,
  rccm: optionnel,
  nif: optionnel,
  id_nat: optionnel,
  adresse: optionnel,
  telephone: optionnel,
  email: emailOptionnel,
  devise: z.enum(["USD", "CDF"]),
  prefixe_dossier: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, "2 à 6 lettres majuscules"),
  seuil_validation_usd: z.coerce.number().min(0, "Montant positif"),
  acompte_pct: z.coerce.number().min(0).max(100, "Entre 0 et 100"),
  garantie_jours: z.coerce.number().int().min(0, "Nombre de jours positif"),
})
