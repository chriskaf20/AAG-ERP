import { Logo } from "@/components/logo"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-sidebar p-4 sm:p-6">
      <Logo taille={128} className="rounded-xl p-2" />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
