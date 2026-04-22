'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Drawer } from 'vaul'
import { ArrowRight, Circle, Loader2, Play, RefreshCw, Sparkles, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubjectRecordingGuide } from '@/components/subject/SubjectRecordingGuide'
import { SubjectNarrativeAnchor } from '@/components/subject/SubjectNarrativeAnchor'
import { StaleAnchorBadge } from '@/components/subject/StaleAnchorBadge'
import type { RecordingGuide } from '@/lib/recording-guide'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

interface SessionLite {
  id: string
  status: string
  themeName: string | null
  recordingScript: unknown
  projectId: string | null
}

interface FormatCardDrawerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  formatLabel: string
  formatEmoji: string
  topicId: string
  format: string
  canonical: SessionLite | null
  anchor: NarrativeAnchor | null
  isStale: boolean
  onResync: () => Promise<void> | void
  resyncing?: boolean
}

const SESSION_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'À enregistrer', tone: 'text-amber-600' },
  RECORDING: { label: 'En cours', tone: 'text-blue-500' },
  SUBMITTED: { label: 'Soumise', tone: 'text-blue-500' },
  PROCESSING: { label: 'En traitement', tone: 'text-blue-500' },
  DONE: { label: 'Terminée', tone: 'text-emerald-600' },
  LIVE: { label: 'En ligne', tone: 'text-emerald-700' },
  REPLACED: { label: 'Variante remplacée', tone: 'text-muted-foreground' },
  FAILED: { label: 'Raté', tone: 'text-red-500' },
}

/**
 * Drawer in-place qui expose le script format-specific d'une carte format sans
 * navigation. Mobile : bottom sheet Vaul, desktop : side drawer right.
 *
 * Contenu : StaleAnchorBadge (si applicable) + script complet (via le
 * renderer existant SubjectRecordingGuide qui supporte les 6 kinds
 * format-specific) ou fallback narrativeAnchor (si pas encore de script).
 * Footer : CTA primaire selon statut session + bouton "Re-synchroniser".
 */
export function FormatCardDrawer({
  open,
  onOpenChange,
  formatLabel,
  formatEmoji,
  topicId,
  format,
  canonical,
  anchor,
  isStale,
  onResync,
  resyncing = false,
}: FormatCardDrawerProps) {
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const script = canonical?.recordingScript ?? null
  const statusMeta = canonical
    ? (SESSION_STATUS_LABEL[canonical.status] ?? SESSION_STATUS_LABEL.PENDING)
    : null

  // Le renderer SubjectRecordingGuide accepte un RecordingGuide dont les 6
  // kinds format-specific correspondent exactement à ceux de RecordingScript.
  // On caste pour réutiliser le composant sans dupliquer la logique (les
  // champs supplémentaires de RecordingScript — anchorSyncedAt,
  // sourceAnchorBullets — sont ignorés par le renderer).
  const scriptAsGuide =
    script && typeof script === 'object' && 'kind' in (script as Record<string, unknown>)
      ? (script as unknown as RecordingGuide)
      : null

  const content = (
    <>
      <header className="flex items-start gap-3 border-b border-border/40 px-5 py-4">
        <span className="text-2xl leading-none" aria-hidden>
          {formatEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{formatLabel}</h2>
          {canonical?.themeName && (
            <p className="truncate text-xs text-muted-foreground">{canonical.themeName}</p>
          )}
          {statusMeta && (
            <p className={`mt-1 inline-flex items-center gap-1.5 text-xs ${statusMeta.tone}`}>
              <Circle className="h-2 w-2 fill-current" />
              {statusMeta.label}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {canonical && (
          <StaleAnchorBadge
            isStale={isStale}
            onResync={onResync}
            resyncing={resyncing}
            className="mb-4"
          />
        )}

        {scriptAsGuide ? (
          <SubjectRecordingGuide guide={scriptAsGuide} />
        ) : anchor ? (
          <div className="space-y-3">
            <SubjectNarrativeAnchor anchor={anchor} />
            <p className="rounded-xl border border-dashed border-border/40 bg-surface-raised/30 p-3 text-xs text-muted-foreground">
              Pas encore de script adapté à ce format — Kabou peut l'adapter
              depuis ton angle.
            </p>
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Pas encore d'angle posé pour ce sujet.
          </p>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-border/40 px-5 py-4 sm:flex-row sm:flex-wrap">
        {canonical && (canonical.status === 'PENDING' || canonical.status === 'RECORDING') && (
          <Button asChild size="lg" className="w-full sm:flex-1">
            <Link href={`/s/${canonical.id}`}>
              <Play className="h-4 w-4" />
              Lancer le tournage
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {canonical && (canonical.status === 'SUBMITTED' || canonical.status === 'PROCESSING') && (
          <Button asChild size="lg" variant="outline" className="w-full sm:flex-1">
            <Link href={`/sujets/${canonical.id}/apres-tournage`}>
              <Video className="h-4 w-4" />
              Revoir la session
            </Link>
          </Button>
        )}
        {canonical && (canonical.status === 'DONE' || canonical.status === 'LIVE') && (
          <Button asChild size="lg" className="w-full sm:flex-1">
            <Link
              href={
                canonical.projectId
                  ? `/projects/${canonical.projectId}/publier`
                  : `/sujets/${canonical.id}/publier`
              }
            >
              <Sparkles className="h-4 w-4" />
              Publier ce contenu
            </Link>
          </Button>
        )}
        {!canonical && (
          <Button asChild size="lg" className="w-full sm:flex-1">
            <Link href={`/chat?topicId=${topicId}&action=record&format=${format}`}>
              <Sparkles className="h-4 w-4" />
              Adapter l'angle avec Kabou
            </Link>
          </Button>
        )}

        {canonical && scriptAsGuide && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => onResync()}
            disabled={resyncing}
            className="w-full sm:w-auto"
          >
            {resyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-synchroniser
          </Button>
        )}
      </footer>
    </>
  )

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={isDesktop ? 'right' : 'bottom'}
      snapPoints={isDesktop ? undefined : [0.6, 0.92]}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Drawer.Content
          className={
            isDesktop
              ? 'fixed right-0 top-0 z-50 flex h-full w-[min(480px,96vw)] flex-col border-l border-border/50 bg-card focus:outline-none'
              : 'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-full max-h-[92vh] flex-col rounded-t-2xl border border-b-0 border-border/50 bg-card focus:outline-none'
          }
        >
          {!isDesktop && (
            <div className="mx-auto mt-2 h-1.5 w-12 flex-none rounded-full bg-muted" />
          )}
          <Drawer.Title className="sr-only">{formatLabel}</Drawer.Title>
          <Drawer.Description className="sr-only">
            Script du format {formatLabel}.
          </Drawer.Description>
          {content}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
