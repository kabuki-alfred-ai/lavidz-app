'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Waypoints } from 'lucide-react'

type Thesis = {
  statement: string
  confidence: 'forming' | 'emerging' | 'crystallized'
} | null

/**
 * Small discreet banner surfacing the entrepreneur's thesis on a Sujet screen.
 * Its job : remind the user *"voilà la conviction dont tu t'es dotée — ce
 * Sujet doit la servir"*. Clickable → /mon-univers/these.
 */
export function ThesisBanner() {
  const [thesis, setThesis] = useState<Thesis>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/thesis', { credentials: 'include', cache: 'no-store' })
        if (!alive) return
        if (res.ok) {
          const data = (await res.json()) as Thesis
          setThesis(data)
        }
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!ready) return null
  if (!thesis) {
    return (
      <Link
        href="/mon-univers/these"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <Waypoints className="h-3 w-3" />
        Tu n'as pas encore de thèse — elle aidera Kabou à rester cohérent.
      </Link>
    )
  }

  return (
    <Link
      href="/mon-univers/these"
      className="mb-4 block rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs transition hover:bg-primary/10"
    >
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
        <Waypoints className="h-3 w-3" /> Ta thèse
      </span>
      <p className="mt-0.5 italic text-foreground/80">&laquo;&nbsp;{thesis.statement}&nbsp;&raquo;</p>
    </Link>
  )
}
