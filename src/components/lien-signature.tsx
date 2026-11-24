"use client"

import { CopyIcon, MailIcon, MessageCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Affiche un lien de signature à usage unique (copie, WhatsApp, email). */
export function LienSignature({
  url,
  titre,
  message,
  email,
  onClose,
}: {
  url: string | null
  titre: string
  message: string
  email?: string | null
  onClose: () => void
}) {
  const texte = `${message}\n${url ?? ""}`
  return (
    <Dialog open={url !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>
            Lien sécurisé à usage unique. Il ne sera plus affiché : transmettez-le maintenant au client.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border bg-muted p-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs select-all">{url}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              void navigator.clipboard.writeText(url ?? "")
              toast.success("Lien copié")
            }}
          >
            <CopyIcon />
            <span className="sr-only">Copier le lien</span>
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <a
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
            href={`https://wa.me/?text=${encodeURIComponent(texte)}`}
            target="_blank"
            rel="noopener"
          >
            <MessageCircleIcon className="size-4" aria-hidden /> WhatsApp
          </a>
          <a
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
            href={`mailto:${email ?? ""}?subject=${encodeURIComponent(titre)}&body=${encodeURIComponent(texte)}`}
          >
            <MailIcon className="size-4" aria-hidden /> Email
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
