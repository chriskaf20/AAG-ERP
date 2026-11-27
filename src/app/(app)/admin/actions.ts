"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { messageErreur, type EtatAction } from "@/lib/actions"
import { autoriser } from "@/lib/contexte"
import { ROLES, ROLES_DEPARTEMENT, type AppRole } from "@/lib/permissions"
import { organisationSchema } from "@/lib/schemas"
import { createAdminClient } from "@/lib/supabase/admin"

const roleSchema = z.enum(ROLES as [AppRole, ...AppRole[]])

const nouvelUtilisateur = z.object({
  email: z.email("Email invalide").max(254),
  nom_complet: z.string().trim().min(2, "Nom requis").max(150),
  fonction: z.string().trim().optional(),
  role: roleSchema,
  department_id: z.uuid().nullable(),
})

export type EtatCreation = EtatAction

export async function creerUtilisateur(_: EtatCreation, fd: FormData): Promise<EtatCreation> {
  const { ctx, refus } = await autoriser("admin.users")
  if (refus) return refus
  const parsed = nouvelUtilisateur.safeParse({
    email: fd.get("email"),
    nom_complet: fd.get("nom_complet"),
    fonction: fd.get("fonction") ?? undefined,
    role: fd.get("role"),
    department_id: fd.get("department_id") || null,
  })
  if (!parsed.success) return { erreurs: z.flattenError(parsed.error).fieldErrors }
  const u = parsed.data
  if (ROLES_DEPARTEMENT.includes(u.role) && !u.department_id) {
    return { erreurs: { department_id: ["Département requis pour ce rôle"] } }
  }
  if (u.role === "admin_systeme" && !ctx.roles.includes("admin_systeme")) {
    return { message: "Seul un administrateur système peut attribuer ce rôle" }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return { message: (e as Error).message }
  }

  const email = u.email.toLowerCase()
  const { data: invitation, error: preparation } = await ctx.supabase.rpc("preparer_invitation", {
    p_org: ctx.organisation.id, p_email: email, p_nom: u.nom_complet, p_fonction: u.fonction || null, p_role: u.role,
    p_departement: ROLES_DEPARTEMENT.includes(u.role) ? u.department_id : null,
  })
  if (preparation || !invitation) return { message: messageErreur(preparation) }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { atlas_invitation: invitation } })
  if (error || !data.user) return { message: messageErreur(error) }

  const rattachement = await admin.rpc("invitation_rattachee", { p_invitation: invitation, p_user: data.user.id })
  if (rattachement.error || !rattachement.data) {
    return { message: "Le rôle n’a pas été confirmé. Vérifiez le rattachement avant de renvoyer l’invitation." }
  }

  revalidatePath("/admin/utilisateurs")
  revalidatePath("/admin/roles")
  return { ok: true, message: `Invitation envoyée à ${email}.` }
}

export async function modifierProfil(userId: string, _: EtatAction, fd: FormData): Promise<EtatAction> {
  const { ctx, refus } = await autoriser("admin.users")
  if (refus) return refus
  const nom = String(fd.get("nom_complet") ?? "").trim()
  if (nom.length < 2) return { erreurs: { nom_complet: ["Nom requis"] } }
  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      nom_complet: nom,
      fonction: String(fd.get("fonction") ?? "").trim() || null,
      telephone: String(fd.get("telephone") ?? "").trim() || null,
    })
    .eq("id", userId)
  if (error) return { message: messageErreur(error) }
  revalidatePath("/admin/utilisateurs")
  return { ok: true, message: "Profil enregistré" }
}

export async function ajouterRole(
  userId: string,
  role: AppRole,
  departmentId: string | null
): Promise<EtatAction> {
  const { ctx, refus } = await autoriser("admin.users")
  if (refus) return refus
  if (!roleSchema.safeParse(role).success) return { message: "Rôle invalide" }
  if (role === "responsable_departement" && !departmentId) {
    return { message: "Choisissez le département" }
  }
  const { error } = await ctx.supabase.from("user_roles").insert({
    organization_id: ctx.organisation.id,
    user_id: userId,
    role,
    department_id: ROLES_DEPARTEMENT.includes(role) ? departmentId : null,
  })
  if (error) return { message: messageErreur(error) }
  revalidatePath("/admin/roles")
  revalidatePath("/admin/utilisateurs")
  return { ok: true, message: "Rôle ajouté" }
}

export async function retirerRole(roleId: string): Promise<EtatAction> {
  const { ctx, refus } = await autoriser("admin.users")
  if (refus) return refus
  const { data: r } = await ctx.supabase.from("user_roles").select("user_id, role").eq("id", roleId).maybeSingle()
  if (r?.user_id === ctx.userId && (r.role === "admin_systeme" || r.role === "gerant")) {
    return { message: "Vous ne pouvez pas retirer votre propre rôle d'administration" }
  }
  const { error, count } = await ctx.supabase.from("user_roles").delete({ count: "exact" }).eq("id", roleId)
  if (error) return { message: messageErreur(error) }
  if (!count) return { message: "Action non autorisée pour votre rôle" }
  revalidatePath("/admin/roles")
  revalidatePath("/admin/utilisateurs")
  return { ok: true, message: "Rôle retiré" }
}

export async function enregistrerParametres(_: EtatAction, fd: FormData): Promise<EtatAction> {
  const { ctx, refus } = await autoriser("admin.settings")
  if (refus) return refus
  const parsed = organisationSchema.safeParse(Object.fromEntries(fd.entries()))
  if (!parsed.success) return { erreurs: z.flattenError(parsed.error).fieldErrors }
  const {
    seuil_validation_usd,
    acompte_pct,
    garantie_jours,
    tva_pct,
    taux_cdf,
    delai_paiement_jours,
    devis_validite_jours,
    conditions_paiement,
    ...org
  } = parsed.data
  const actuels = (ctx.organisation.parametres as Record<string, unknown>) ?? {}
  const autresTaxes = (Array.isArray(actuels.taxes) ? (actuels.taxes as { code: string }[]) : []).filter(
    (t) => t.code !== "TVA"
  )
  const parametres = {
    ...actuels,
    seuil_validation_usd,
    acompte_pct,
    garantie_jours,
    taux_cdf,
    delai_paiement_jours,
    devis_validite_jours,
    conditions_paiement,
    taxes: [{ code: "TVA", libelle: "TVA", taux: tva_pct }, ...autresTaxes],
  }
  const { error, count } = await ctx.supabase
    .from("organizations")
    .update({ ...org, parametres }, { count: "exact" })
    .eq("id", ctx.organisation.id)
  if (error) return { message: messageErreur(error) }
  if (!count) return { message: "Action non autorisée pour votre rôle" }
  revalidatePath("/", "layout")
  return { ok: true, message: "Paramètres enregistrés" }
}

export async function enregistrerEmails(type: "relances" | "points", actives: boolean, mode: "simulation" | "reel"): Promise<EtatAction> {
  const { ctx, refus } = await autoriser("admin.settings")
  if (refus) return refus
  if (!ctx.roles.includes("gerant")) return { message: "Seul le gérant peut modifier ce réglage." }
  if (type !== "relances" && type !== "points") return { message: "Réglage invalide" }
  if (typeof actives !== "boolean") return { message: "État invalide" }
  if (mode !== "simulation" && mode !== "reel") return { message: "Mode invalide" }
  const parametres = {
    ...((ctx.organisation.parametres as Record<string, unknown>) ?? {}),
    ...(type === "relances" ? { relances_actives: actives, relances_mode: mode }
      : { points_avancement_email_actifs: actives, points_avancement_email_mode: mode }),
  }
  const { error, count } = await ctx.supabase
    .from("organizations")
    .update({ parametres }, { count: "exact" })
    .eq("id", ctx.organisation.id)
  if (error) return { message: messageErreur(error) }
  if (!count) return { message: "Action non autorisée pour votre rôle" }
  revalidatePath("/admin/parametres")
  return { ok: true, message: "Réglage enregistré" }
}
