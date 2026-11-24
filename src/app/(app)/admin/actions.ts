"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { messageErreur, type EtatAction } from "@/lib/actions"
import { getContexte } from "@/lib/contexte"
import { peut, ROLES, ROLES_DEPARTEMENT, type AppRole } from "@/lib/permissions"
import { organisationSchema } from "@/lib/schemas"
import { createAdminClient } from "@/lib/supabase/admin"

async function contexteAdmin() {
  const ctx = await getContexte()
  if (!peut.administrer(ctx.roles)) throw new Error("Action réservée à l'administration")
  return ctx
}

const roleSchema = z.enum(ROLES as [AppRole, ...AppRole[]])

const nouvelUtilisateur = z.object({
  email: z.email("Email invalide"),
  nom_complet: z.string().trim().min(2, "Nom requis"),
  fonction: z.string().trim().optional(),
  role: roleSchema,
  department_id: z.uuid().nullable(),
})

export type EtatCreation = (EtatAction & { motDePasse?: string }) | null

export async function creerUtilisateur(_: EtatCreation, fd: FormData): Promise<EtatCreation> {
  const ctx = await contexteAdmin()
  const parsed = nouvelUtilisateur.safeParse({
    email: fd.get("email"),
    nom_complet: fd.get("nom_complet"),
    fonction: fd.get("fonction") ?? undefined,
    role: fd.get("role"),
    department_id: fd.get("department_id") || null,
  })
  if (!parsed.success) return { erreurs: z.flattenError(parsed.error).fieldErrors }
  const u = parsed.data
  if (u.role === "responsable_departement" && !u.department_id) {
    return { erreurs: { department_id: ["Département requis pour ce rôle"] } }
  }
  if (u.role === "admin_systeme" && !peut.attribuerAdmin(ctx.roles)) {
    return { message: "Seul un administrateur système peut attribuer ce rôle" }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return { message: (e as Error).message }
  }

  const motDePasse = `Atlas-${randomBytes(6).toString("base64url")}`
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { nom_complet: u.nom_complet },
  })
  if (error || !data.user) {
    return { message: error?.message.includes("already") ? "Cet email est déjà utilisé" : messageErreur(error) }
  }

  await admin
    .from("profiles")
    .update({ fonction: u.fonction || null, organization_id: ctx.organisation.id })
    .eq("id", data.user.id)

  // Le rôle est attribué avec la session de l'administrateur : la RLS s'applique.
  const { error: errRole } = await ctx.supabase.from("user_roles").insert({
    organization_id: ctx.organisation.id,
    user_id: data.user.id,
    role: u.role,
    department_id: ROLES_DEPARTEMENT.includes(u.role) ? u.department_id : null,
  })
  if (errRole) return { message: messageErreur(errRole) }

  revalidatePath("/admin/utilisateurs")
  return {
    ok: true,
    message: `Compte créé pour ${u.email}. Transmettez ce mot de passe provisoire :`,
    motDePasse,
  }
}

export async function modifierProfil(userId: string, _: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await contexteAdmin()
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
  const ctx = await contexteAdmin()
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
  const ctx = await contexteAdmin()
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
  const ctx = await contexteAdmin()
  const parsed = organisationSchema.safeParse(Object.fromEntries(fd.entries()))
  if (!parsed.success) return { erreurs: z.flattenError(parsed.error).fieldErrors }
  const { seuil_validation_usd, acompte_pct, garantie_jours, ...org } = parsed.data
  const parametres = {
    ...((ctx.organisation.parametres as Record<string, unknown>) ?? {}),
    seuil_validation_usd,
    acompte_pct,
    garantie_jours,
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
