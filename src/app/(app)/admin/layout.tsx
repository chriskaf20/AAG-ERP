
import { exiger } from "@/lib/contexte"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await exiger("admin.users", "admin.settings", "audit.read")
  return children
}
