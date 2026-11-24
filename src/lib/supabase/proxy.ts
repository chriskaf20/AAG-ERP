import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { ORG_COOKIE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env"

const PUBLIC_PATHS = ["/connexion", "/auth", "/signer"]

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Ne rien exécuter entre createServerClient et getClaims (rafraîchissement du jeton).
  const { data } = await supabase.auth.getClaims()
  const connecte = Boolean(data?.claims)

  const { pathname, search } = request.nextUrl
  const estPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  const rediriger = (chemin: string, suivant?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = chemin
    url.search = suivant ? `?suivant=${encodeURIComponent(suivant)}` : ""
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (!connecte && !estPublic) {
    return rediriger("/connexion", pathname + search)
  }
  if (connecte && pathname === "/connexion") {
    return rediriger("/")
  }
  if (
    connecte &&
    !estPublic &&
    pathname !== "/choisir-organisation" &&
    !request.cookies.get(ORG_COOKIE)?.value
  ) {
    return rediriger("/choisir-organisation", pathname + search)
  }

  return response
}
