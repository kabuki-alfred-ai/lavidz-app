'use client'

import Link from 'next/link'
import { ChevronDown, ChevronUp, Eye, Play, Plus, RefreshCw, Sparkles, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FORMAT_CARD_HEADER_STATE, type SessionStatus } from '@/lib/kabou-voice'
import { FormatCardPreview } from './FormatCardPreview'
import { SessionStatusBadge } from './SessionStatusBadge'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'
import type { RecordingScript } from '@/lib/recording-script'

export type FormatCardSession = {
  id: string
  status: string
  contentFormat: string | null
  createdAt: string
  themeName: string | null
  questionsCount: number
  projectId: string | null
  recordingScript: RecordingScript | null
}

type FormatCardProps = {
  format: string
  formatLabel: string
  formatEmoji: string
  narrativeAnchor: NarrativeAnchor | null
  canonical: FormatCardSession | null
  variants: FormatCardSession[]
  onToggleVariants: () => void
  variantsExpanded: boolean
  /**
   * Appelé quand l'entrepreneur veut voir/éditer ce format : header CTA, chip
   * "Voir le script complet", hero "choisis ton premier format". Le parent
   * ouvre le drawer (preview script + choix Lancer/Planifier). Le drawer est
   * la "salle d'attente" où l'on réfléchit avant de s'engager.
   */
  onExplore: (format: string) => void
}

/**
 * One format, one CTA — le CTA du header ouvre toujours le drawer d'exploration
 * pour les statuts "à jouer maintenant" (null/PENDING/RECORDING) afin que
 * l'entrepreneur voie le script complet + les options Lancer/Planifier AVANT
 * de s'engager. Pour les statuts "après-tournage" (SUBMITTED → LIVE), la CTA
 * route directement vers la vue dédiée.
 */
export function FormatCard({
  format,
  formatLabel,
  formatEmoji,
  narrativeAnchor,
  canonical,
  variants,
  onToggleVariants,
  variantsExpanded,
  onExplore,
}: FormatCardProps) {
  const status = (canonical?.status as SessionStatus | undefined) ?? null
  const isPulsingState = status === 'RECORDING' || status === 'SUBMITTED' || status === 'PROCESSING'
  const headerState = status ? FORMAT_CARD_HEADER_STATE[status] : null

  const borderCls = isPulsingState
    ? 'border-primary/30 shadow-lg shadow-primary/10 ring-2 ring-primary/25'
    : 'border-border/50'

  return (
    <article
      id={`format-${format}`}
      className={`scroll-mt-6 overflow-hidden rounded-2xl border bg-surface-raised/30 transition-shadow ${borderCls}`}
    >
      <header className="flex items-center gap-3 border-b border-border/30 px-4 py-3">
        <span className="text-lg" aria-hidden>
          {formatEmoji}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-sm font-semibold">{formatLabel}</h3>
          {headerState && (
            <span className="text-[11px] text-muted-foreground">{headerState}</span>
          )}
        </div>
        <FormatCardCta
          format={format}
          canonical={canonical}
          status={status}
          onExplore={onExplore}
        />
      </header>

      {canonical && (
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm">
              {canonical.themeName ?? 'Tournage sans titre'}
            </p>
            <SessionStatusBadge status={canonical.status} />
          </div>
          <FormatCardPreview
            script={canonical.recordingScript}
            anchor={narrativeAnchor}
            compact
          />
          <button
            type="button"
            onClick={() => onExplore(format)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Eye className="h-3 w-3" />
            Voir le script complet
          </button>
        </div>
      )}
      {!canonical && (
        <div className="space-y-2 px-4 py-3">
          <FormatCardPreview
            script={null}
            anchor={narrativeAnchor}
            compact
          />
          {variants.length === 0 && (
            <p className="text-xs italic text-muted-foreground/70">
              Pas encore de tournage dans ce format.
            </p>
          )}
        </div>
      )}

      {variants.length > 0 && (
        <div className="border-t border-border/30 bg-background/20">
          <button
            type="button"
            onClick={onToggleVariants}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-muted-foreground hover:bg-background/40"
          >
            {variantsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Variantes précédentes ({variants.length})
          </button>
          {variantsExpanded && (
            <ul>
              {variants.map((v) => (
                <VariantRow key={v.id} session={v} />
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}

function FormatCardCta({
  format,
  canonical,
  status,
  onExplore,
}: {
  format: string
  canonical: FormatCardSession | null
  status: SessionStatus | null
  onExplore: (format: string) => void
}) {
  // Pas de session OU variante rejouable → drawer d'exploration (preview +
  // Lancer/Planifier). Côté drawer : création session via /record-now ou
  // planification via schedule-publish.
  if (!canonical || status === 'REPLACED' || status === 'FAILED') {
    return (
      <Button size="sm" variant="outline" onClick={() => onExplore(format)}>
        <Plus className="h-3 w-3" />
        {canonical ? 'Tenter une variante' : 'Nouveau tournage'}
      </Button>
    )
  }

  // Session déjà PENDING → on ouvre le drawer pour revoir le script avant de
  // confirmer. Le drawer porte la CTA finale "Lancer le tournage" vers /s/:id.
  if (status === 'PENDING') {
    return (
      <Button size="sm" onClick={() => onExplore(format)}>
        <Play className="h-3 w-3" />
        Voir et lancer
      </Button>
    )
  }

  // RECORDING → reprise directe (pas besoin de re-préviewer ce qu'on a déjà commencé).
  if (status === 'RECORDING') {
    return (
      <Button asChild size="sm">
        <Link href={`/s/${canonical.id}`}>
          <Play className="h-3 w-3" />
          Reprendre
        </Link>
      </Button>
    )
  }

  if (status === 'SUBMITTED' || status === 'PROCESSING') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/sujets/${canonical.id}/apres-tournage`}>
          <Video className="h-3 w-3" />
          Revoir
        </Link>
      </Button>
    )
  }

  if (status === 'DONE') {
    const href = canonical.projectId
      ? `/projects/${canonical.projectId}/publier`
      : `/sujets/${canonical.id}/publier`
    return (
      <Button asChild size="sm">
        <Link href={href}>
          <Sparkles className="h-3 w-3" />
          Publier
        </Link>
      </Button>
    )
  }

  if (status === 'LIVE') {
    const href = canonical.projectId
      ? `/projects/${canonical.projectId}/publier`
      : `/sujets/${canonical.id}/publier`
    return (
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href={href}>
            <Sparkles className="h-3 w-3" />
            En ligne
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={() => onExplore(format)}>
          <Plus className="h-3 w-3" />
          Tenter une variante
        </Button>
      </div>
    )
  }

  return null
}

function VariantRow({ session }: { session: FormatCardSession }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 opacity-70">
      <span className="truncate text-xs">{session.themeName ?? 'Variante'}</span>
      {session.status === 'FAILED' ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/s/${session.id}`}>
            <RefreshCw className="h-3 w-3" /> Retenter
          </Link>
        </Button>
      ) : (
        <SessionStatusBadge status={session.status} />
      )}
    </li>
  )
}
