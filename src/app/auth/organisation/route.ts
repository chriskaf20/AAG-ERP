import { NextResponse, type NextRequest } from "next/server"

import { cheminSur } from "@/lib/redirection"
import { ORG_COOKIE } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

/** Sélectionne l'organisation active après vérification de l'appartenance. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  const suivant = cheminSur(request.nextUrl.searchParams.get("suivant"))
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url))

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.redirect(new URL("/choisir-organisation", request.url))
  }

  const { count } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("organization_id", id)
    .neq("role", "client")

  if (!count) {
    return NextResponse.redirect(new URL("/choisir-organisation", request.url))
  }

  await supabase.from("profiles").update({ organization_id: id }).eq("id", user.id)

  const response = NextResponse.redirect(new URL(suivant, request.url))
  response.cookies.set(ORG_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
