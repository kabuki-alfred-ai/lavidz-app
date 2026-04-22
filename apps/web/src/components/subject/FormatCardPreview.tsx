'use client'

import type { RecordingScript } from '@/lib/recording-script'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

interface FormatCardPreviewProps {
  /** Script format-specific si la session canonique en a un — sinon null. */
  script: RecordingScript | null
  /** Ancre narrative du Topic (fallback quand pas de script). */
  anchor: NarrativeAnchor | null
  /** Rendu compact (carte format) vs normal (drawer — non utilisé en V1). */
  compact?: boolean
}

const BEAT_LABELS: Record<'setup' | 'tension' | 'climax' | 'resolution', string> = {
  setup: 'Mise en place',
  tension: 'Tension',
  climax: 'Bascule',
  resolution: 'Résolution',
}

function truncate(text: string, max = 60): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return cleaned.slice(0, max) + '…'
}

/**
 * Rend un aperçu 2-lignes du contenu du format — sans jamais dupliquer le
 * rendu complet du script (qui vit dans FormatCardDrawer). Polymorphe par
 * `kind`, fallback narrativeAnchor bullets, puis fallback vide.
 *
 * Contrat : jamais plus de 2 lignes, jamais plus de 60 chars par ligne.
 */
export function FormatCardPreview({ script, anchor, compact = false }: FormatCardPreviewProps) {
  const wrapperClass = compact
    ? 'space-y-1 text-xs leading-relaxed text-muted-foreground'
    : 'space-y-1.5 text-sm leading-relaxed text-muted-foreground'

  const bullets = extractPreviewLines(script, anchor)

  if (bullets.length === 0) {
    return (
      <p className={`${compact ? 'text-xs' : 'text-sm'} italic text-muted-foreground/70`}>
        Pas encore de script adapté à ce format.
      </p>
    )
  }

  return (
    <ul className={wrapperClass}>
      {bullets.map((line, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="select-none text-muted-foreground/60">▸</span>
          <span>
            {line.label && <span className="font-medium text-foreground/80">{line.label} : </span>}
            {line.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

type PreviewLine = { label?: string; text: string }

function extractPreviewLines(
  script: RecordingScript | null,
  anchor: NarrativeAnchor | null,
): PreviewLine[] {
  if (script) {
    switch (script.kind) {
      case 'storytelling': {
        const beats = script.beats.slice(0, 2)
        return beats.map((b) => ({ label: BEAT_LABELS[b.label], text: truncate(b.text) }))
      }
      case 'myth_vs_reality': {
        const pair = script.pairs[0]
        if (!pair) return []
        return [
          { label: 'Mythe', text: truncate(pair.myth) },
          { label: 'Réalité', text: truncate(pair.reality) },
        ]
      }
      case 'qa': {
        const first = script.items[0]
        if (!first) return []
        const kp = first.keyPoints[0]
        return [
          { label: 'Question', text: truncate(first.question) },
          ...(kp ? [{ label: '1er point', text: truncate(kp) }] : []),
        ]
      }
      case 'hot_take': {
        const lines: PreviewLine[] = []
        if (script.thesis?.trim()) lines.push({ label: 'Thèse', text: truncate(script.thesis) })
        const arg = script.arguments?.[0]
        if (arg) lines.push({ label: '1er arg', text: truncate(arg) })
        return lines
      }
      case 'daily_tip': {
        const lines: PreviewLine[] = []
        if (script.problem?.trim()) lines.push({ label: 'Problème', text: truncate(script.problem) })
        if (script.tip?.trim()) lines.push({ label: 'Conseil', text: truncate(script.tip) })
        return lines
      }
      case 'teleprompter': {
        const nonEmpty = script.script
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
        return nonEmpty.slice(0, 2).map((text) => ({ text: truncate(text) }))
      }
    }
  }
  // Fallback : 2 premiers bullets du narrativeAnchor draft
  if (anchor?.kind === 'draft' && anchor.bullets.length > 0) {
    return anchor.bullets
      .filter((b) => b.trim().length > 0)
      .slice(0, 2)
      .map((text) => ({ text: truncate(text) }))
  }
  return []
}
