'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface SubjectBreadcrumbProps {
  createdAt?: string
  updatedAt?: string
}

function formatRelative(iso: string | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `il y a ${days} j`
  const weeks = Math.round(days / 7)
  if (weeks < 4) return `il y a ${weeks} sem`
  const months = Math.round(days / 30)
  return `il y a ${months} mois`
}

export function SubjectBreadcrumb({ createdAt, updatedAt }: SubjectBreadcrumbProps) {
  const created = formatRelative(createdAt)
  const updated = formatRelative(updatedAt)
  return (
    <div className="flex items-center justify-between mb-6">
      <Link
        href="/topics"
        className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tous mes sujets
      </Link>
      {(created || updated) && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/70">
          {created && <span>Créé {created}</span>}
          {created && updated && <span className="opacity-40">·</span>}
          {updated && <span>Modifié {updated}</span>}
        </div>
      )}
    </div>
  )
}
