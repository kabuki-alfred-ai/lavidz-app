'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StaleAnchorBadgeProps {
  isStale: boolean
  onResync: () => void
  resyncing?: boolean
  className?: string
}

/**
 * Affiche un avertissement quand `Topic.narrativeAnchor.updatedAt` est plus
 * récent que `Session.recordingScript.anchorSyncedAt` (F14). Le bouton
 * re-sync déclenche un reshape pour ré-aligner le script format-specific.
 *
 * Silencieux si `isStale === false` (retourne `null`).
 */
export function StaleAnchorBadge({
  isStale,
  onResync,
  resyncing = false,
  className,
}: StaleAnchorBadgeProps) {
  if (!isStale) return null

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300',
        className,
      )}
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Ton angle a évolué depuis ce script</p>
        <button
          type="button"
          onClick={onResync}
          disabled={resyncing}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 underline-offset-2 transition-opacity hover:underline disabled:opacity-50 dark:text-amber-200"
        >
          <RefreshCw className={cn('h-3 w-3', resyncing && 'animate-spin')} />
          {resyncing ? 'Synchronisation…' : "Re-synchroniser avec l'angle"}
        </button>
      </div>
    </div>
  )
}
