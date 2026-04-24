'use client'

import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { SubjectSection, SectionChip } from './SubjectSection'
import { FormatCard, type FormatCardSession } from './FormatCard'
import { FormatChipButton } from './FormatChipButton'
import { FormatHelp, SessionsHelp } from './SubjectHelp'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

/** Statuts qui signalent un tournage pas fini — on n'invite pas à ouvrir un
 * autre format tant qu'un de ceux-là traîne. */
const IN_PROGRESS_STATUSES = new Set(['PENDING', 'RECORDING', 'SUBMITTED', 'PROCESSING'])

type FormatGroup = {
  format: string
  canonical: FormatCardSession | null
  variants: FormatCardSession[]
}

interface SubjectSessionsSectionProps {
  groups: FormatGroup[]
  missingFormats: Array<{ format: string; emoji: string; label: string }>
  formatLabels: Record<string, string>
  formatEmojis: Record<string, string>
  narrativeAnchor: NarrativeAnchor | null
  expandedVariants: Set<string>
  onToggleVariants: (format: string) => void
  onExplore: (format: string) => void
  id?: string
  defaultOpen?: boolean
}

export function SubjectSessionsSection({
  groups,
  missingFormats,
  formatLabels,
  formatEmojis,
  narrativeAnchor,
  expandedVariants,
  onToggleVariants,
  onExplore,
  id,
  defaultOpen = true,
}: SubjectSessionsSectionProps) {
  const activeCount = groups.filter(
    (g) =>
      g.canonical &&
      g.canonical.status !== 'DONE' &&
      g.canonical.status !== 'LIVE' &&
      g.canonical.status !== 'REPLACED' &&
      g.canonical.status !== 'FAILED',
  ).length
  const totalPossible = groups.length + missingFormats.length

  // Cherche un tournage qui bloque l'ouverture d'un autre format — on
  // n'invite pas à démarrer autre chose tant qu'il n'est pas fini ou mis au
  // repos. Priorité au premier non-fini trouvé.
  const inProgressGroup = groups.find(
    (g) => g.canonical && IN_PROGRESS_STATUSES.has(g.canonical.status),
  )
  const inProgress = inProgressGroup?.canonical ?? null
  const inProgressFormatLabel = inProgressGroup
    ? formatLabels[inProgressGroup.format] ?? inProgressGroup.format
    : null

  const chipLabel =
    groups.length === 0 && missingFormats.length > 0
      ? `${missingFormats.length} format${missingFormats.length > 1 ? 's' : ''} possible${missingFormats.length > 1 ? 's' : ''}`
      : `${activeCount} actif${activeCount > 1 ? 's' : ''} · ${totalPossible} format${totalPossible > 1 ? 's' : ''} possible${totalPossible > 1 ? 's' : ''}`

  return (
    <SubjectSection
      number="04"
      title="Les tournages"
      subtitle="Un sujet, plusieurs incarnations. Choisis la forme qui colle."
      help={<SessionsHelp />}
      chip={<SectionChip>{chipLabel}</SectionChip>}
      defaultOpen={defaultOpen}
      id={id}
    >
      <div className="space-y-3">
        {groups.map((group) => (
          <FormatCard
            key={group.format}
            format={group.format}
            formatLabel={formatLabels[group.format] ?? group.format}
            formatEmoji={formatEmojis[group.format] ?? '🎬'}
            narrativeAnchor={narrativeAnchor}
            canonical={group.canonical}
            variants={group.variants}
            onToggleVariants={() => onToggleVariants(group.format)}
            variantsExpanded={expandedVariants.has(group.format)}
            onExplore={onExplore}
          />
        ))}

        {missingFormats.length > 0 && !inProgress && (
          <div className="rounded-xl border border-dashed border-border p-4 bg-surface-raised/20">
            <p className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground mb-3">
              Tenter un autre format
            </p>
            <div className="flex flex-wrap gap-2">
              {missingFormats.map((fmt) => (
                <div key={fmt.format} className="inline-flex items-center gap-0.5">
                  <FormatChipButton
                    format={fmt.format}
                    emoji={fmt.emoji}
                    label={fmt.label}
                    onExplore={onExplore}
                  />
                  <FormatHelp format={fmt.format} />
                </div>
              ))}
            </div>
          </div>
        )}

        {missingFormats.length > 0 && inProgress && (
          <div className="rounded-xl border border-dashed border-border p-3.5 bg-surface-raised/20 flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground/70 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] leading-relaxed">
                Tu as un tournage{' '}
                <strong>{inProgressFormatLabel}</strong> en cours — termine-le
                ou mets-le au repos avant d'ouvrir un autre format.
              </p>
              <p className="text-[11.5px] text-muted-foreground/80 mt-1">
                {missingFormats.length} autre
                {missingFormats.length > 1 ? 's formats restent' : ' format reste'}{' '}
                à explorer ensuite.
              </p>
            </div>
            <Link
              href={`/s/${inProgress.id}`}
              className="shrink-0 inline-flex items-center gap-1 text-[12px] text-primary hover:underline whitespace-nowrap"
            >
              Reprendre <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {groups.length === 0 && missingFormats.length === 0 && (
          <p className="text-sm italic text-muted-foreground">
            Aucun format disponible pour ce sujet pour l'instant.
          </p>
        )}
      </div>
    </SubjectSection>
  )
}
