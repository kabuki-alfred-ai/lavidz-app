'use client'

import { useEffect, useState } from 'react'

/**
 * Dot indicator persistant et subtil sur le lien "Mon univers" de la nav
 * quand l'entrepreneur n'a pas encore posé sa thèse. Signal visuel
 * non-bloquant : l'user voit le dot orange, il peut cliquer quand il est en
 * mode "meta" (pas en mode "je bosse sur mon sujet courant").
 *
 * Fetch léger au mount + cache sessionStorage 1h pour éviter de hammer
 * /api/thesis à chaque page. Aria-label pour accessibilité.
 */

const CACHE_KEY = 'lavidz:thesis-absent'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1h

type Cached = { absent: boolean; at: number }

function readCache(): Cached | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cached
    if (!parsed || typeof parsed.absent !== 'boolean' || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(absent: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ absent, at: Date.now() }))
  } catch {
    /* silent */
  }
}

export function ThesisIndicatorDot() {
  const [absent, setAbsent] = useState<boolean | null>(() => {
    const cached = readCache()
    return cached?.absent ?? null
  })

  useEffect(() => {
    if (absent !== null) return // cache warm, pas de fetch
    let alive = true
    fetch('/api/thesis', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive) return
        const hasThesis =
          !!data && typeof (data as { statement?: unknown }).statement === 'string'
        const isAbsent = !hasThesis
        setAbsent(isAbsent)
        writeCache(isAbsent)
      })
      .catch(() => {
        if (alive) setAbsent(false) // fail silent, n'affiche pas de dot
      })
    return () => {
      alive = false
    }
  }, [absent])

  if (!absent) return null

  return (
    <span
      aria-label="Thèse non définie — clique pour en poser une"
      title="Tu n'as pas encore de thèse — elle aidera Kabou à rester cohérent."
      className="ml-auto inline-flex h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_2px_rgba(255,107,46,0.15)]"
    />
  )
}
