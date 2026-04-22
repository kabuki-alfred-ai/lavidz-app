'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, PlayCircle, RotateCcw, X } from 'lucide-react'
import { listAllOrphanedSessions, purgeExpired } from '@/lib/recording-buffer'

/**
 * ResumeBanner — apparaît au mount de `/s/[sessionId]/page.tsx` quand la
 * session a déjà connu une activité (recording uploadé / take bufferisé).
 *
 * 3 wordings Kabou selon l'élapsed (Task 7.4) :
 *   - <1h  : "Tu avais fait {N} prises, on reprend à Q{X} ?"
 *   - <1 semaine : "Tu as tourné {N} prises hier/il y a X jours, on continue
 *     ou tu veux tout refaire à tête reposée ?"
 *   - >1 semaine : "On se retrouve ! Ça fait X semaines/mois. Tu veux
 *     reprendre ou repartir de zéro ? Ton angle a peut-être évolué."
 *
 * Cross-device (Task 7.5) : si on détecte des sessions orphelines IndexedDB
 * (takes non clearés de sessions passées) autres que la courante, on surface
 * un warning doux. Les takes expirés (>7j) sont auto-purgés au mount (F8).
 */

interface ResumeBannerProps {
  sessionId: string
  /** ISO string du dernier `Session.lastActivityAt`. null si aucune activité. */
  lastActivityAt: string | null
  /** Nombre de recordings non-superseded déjà présents en DB (canonical uploadés). */
  recordingsCount: number
  /** Numéro (1-indexed) de la prochaine question à tourner. null si tout est déjà fait. */
  nextQuestionNumber: number | null
  /** Topic.narrativeAnchor.updatedAt — si > recordingScript.anchorSyncedAt on signale l'évolution (long-terme). */
  anchorUpdatedAt?: string | null
  /** Session.recordingScript.anchorSyncedAt — pour comparer avec anchorUpdatedAt. */
  scriptSyncedAt?: string | null
  /** Déclenché quand l'user clique "Repartir à zéro" (proxy vers /api/sessions/:id/reset). */
  onResetZero?: () => void
  /** Déclenché quand l'user clique "Reprendre où j'en étais" — default: ferme juste la banner. */
  onResume?: () => void
}

function elapsedWording(elapsedMs: number, recordingsCount: number, nextQ: number | null): {
  kind: 'recent' | 'pause' | 'long_term'
  text: string
} {
  const minutes = Math.floor(elapsedMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  const nPrises = `${recordingsCount} prise${recordingsCount > 1 ? 's' : ''}`
  const qLabel = nextQ ? `Q${nextQ}` : 'la suite'

  if (hours < 1) {
    return {
      kind: 'recent',
      text: `Tu avais fait ${nPrises}, on reprend à ${qLabel} ?`,
    }
  }
  if (days < 7) {
    const whenPhrase = days === 0 ? "il y a quelques heures" : days === 1 ? 'hier' : `il y a ${days} jours`
    return {
      kind: 'pause',
      text: `Tu as tourné ${nPrises} ${whenPhrase}, on continue ou tu veux tout refaire à tête reposée ?`,
    }
  }
  const unit = weeks < 5 ? `${weeks} semaine${weeks > 1 ? 's' : ''}` : `${Math.floor(weeks / 4)} mois`
  return {
    kind: 'long_term',
    text: `On se retrouve ! Ça fait ${unit}. Tu veux reprendre ou repartir de zéro ? Ton angle a peut-être évolué.`,
  }
}

export function ResumeBanner({
  sessionId,
  lastActivityAt,
  recordingsCount,
  nextQuestionNumber,
  anchorUpdatedAt,
  scriptSyncedAt,
  onResetZero,
  onResume,
}: ResumeBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [orphansWarning, setOrphansWarning] = useState(false)

  // Purge takes IndexedDB > 7 jours (F8) + détection cross-device (Task 7.5)
  useEffect(() => {
    let cancelled = false
    purgeExpired().catch(() => {})
    listAllOrphanedSessions()
      .then((sessionIds) => {
        if (cancelled) return
        const orphans = sessionIds.filter((id) => id !== sessionId)
        if (orphans.length > 0) setOrphansWarning(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const wording = useMemo(() => {
    if (!lastActivityAt) return null
    const elapsed = Date.now() - Date.parse(lastActivityAt)
    if (Number.isNaN(elapsed) || elapsed < 0) return null
    return elapsedWording(elapsed, recordingsCount, nextQuestionNumber)
  }, [lastActivityAt, recordingsCount, nextQuestionNumber])

  // F14 — mention stale anchor pour le wording long-terme
  const anchorMayHaveEvolved = useMemo(() => {
    if (!anchorUpdatedAt || !scriptSyncedAt) return false
    return Date.parse(anchorUpdatedAt) > Date.parse(scriptSyncedAt)
  }, [anchorUpdatedAt, scriptSyncedAt])

  if (dismissed || !wording || recordingsCount === 0) return null

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 top-0 z-40 mx-auto max-w-2xl px-4 pt-4"
      role="status"
    >
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <PlayCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="flex-1 text-amber-900 dark:text-amber-100">
            <p className="font-medium">{wording.text}</p>
            {wording.kind === 'long_term' && anchorMayHaveEvolved && (
              <p className="mt-1 text-xs italic">
                🧭 Ton angle a évolué depuis ton dernier tournage — jette un œil avant de reprendre.
              </p>
            )}
            {orphansWarning && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs italic">
                <AlertTriangle className="h-3 w-3" />
                Des prises non synchronisées existent sur un autre appareil — perdues pour celui-ci.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onResume?.()
                  setDismissed(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700"
              >
                <PlayCircle className="h-3 w-3" />
                Reprendre où j'en étais
              </button>
              {onResetZero && (
                <button
                  type="button"
                  onClick={onResetZero}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-600/40 bg-transparent px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-500/10 dark:text-amber-200"
                >
                  <RotateCcw className="h-3 w-3" />
                  Repartir à zéro
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 text-amber-700/60 transition hover:text-amber-900 dark:text-amber-300/60 dark:hover:text-amber-100"
            aria-label="Fermer le message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
