'use client'

import { useMemo } from 'react'
import { History } from 'lucide-react'
import { SubjectSection, SectionChip } from './SubjectSection'
import { TimelineHelp } from './SubjectHelp'

export type SubjectTimelineEvent = {
  id: string
  type: string
  actor: string
  metadata: unknown
  createdAt: string
}

interface SubjectTimelineSectionProps {
  events?: SubjectTimelineEvent[]
  defaultOpen?: boolean
}

const TYPE_LABEL: Record<string, string> = {
  topic_created: 'Sujet créé',
  brief_edited: "Angle retravaillé",
  status_changed: 'Statut changé',
  pillar_changed: 'Domaine mis à jour',
  narrative_anchor_edited: 'Piliers enrichis',
  source_added: 'Source ajoutée',
  source_removed: 'Source retirée',
  sources_searched: 'Recherche de sources',
  session_created: 'Tournage créé',
  recording_added: 'Prise ajoutée',
  schedule_published: 'Planification calée',
  kabou_enriched: 'Kabou a enrichi',
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} j`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks} sem`
  const months = Math.round(days / 30)
  return `${months} mois`
}

function describe(event: SubjectTimelineEvent): React.ReactNode {
  const meta = (event.metadata ?? {}) as Record<string, unknown>
  const label =
    typeof meta.label === 'string' ? meta.label : TYPE_LABEL[event.type] ?? event.type

  const actorIsKabou = event.actor === 'kabou'
  const actorTag = actorIsKabou ? (
    <span className="text-primary font-medium">Kabou</span>
  ) : null

  switch (event.type) {
    case 'topic_created':
      return actorIsKabou ? (
        <p>
          {actorTag} a proposé le sujet depuis la conversation libre.
        </p>
      ) : (
        <p>Sujet créé.</p>
      )
    case 'brief_edited':
      return actorIsKabou ? (
        <p>
          {actorTag} a retravaillé l'angle.
        </p>
      ) : (
        <p>Angle retravaillé.</p>
      )
    case 'status_changed': {
      const to = typeof meta.to === 'string' ? meta.to : null
      const toLabel =
        to === 'READY' ? 'prêt à tourner' : to === 'ARCHIVED' ? 'archivé' : to === 'DRAFT' ? 'en exploration' : to
      return (
        <p>
          Sujet marqué <strong>{toLabel}</strong>.
        </p>
      )
    }
    case 'pillar_changed': {
      const pillar = typeof meta.pillar === 'string' ? meta.pillar : null
      return <p>Domaine : {pillar ? <em>{pillar}</em> : 'retiré'}.</p>
    }
    case 'narrative_anchor_edited': {
      const count = typeof meta.bulletsCount === 'number' ? meta.bulletsCount : null
      return actorIsKabou ? (
        <p>
          {actorTag} a enrichi les piliers
          {count !== null ? ` (${count} point${count > 1 ? 's' : ''})` : ''}.
        </p>
      ) : (
        <p>
          Piliers mis à jour
          {count !== null ? ` — ${count} point${count > 1 ? 's' : ''}` : ''}.
        </p>
      )
    }
    case 'source_added': {
      const title = typeof meta.title === 'string' ? meta.title : null
      return (
        <p>
          Source <em>{title ?? 'sans titre'}</em> ajoutée manuellement.
        </p>
      )
    }
    case 'source_removed':
      return <p>Source retirée.</p>
    case 'sources_searched': {
      const q = typeof meta.query === 'string' ? meta.query : null
      const n = typeof meta.resultCount === 'number' ? meta.resultCount : 0
      return (
        <p>
          {actorTag ?? 'Recherche'} de sources{q ? ` sur « ${q} »` : ''} —{' '}
          <strong>{n}</strong> résultat{n > 1 ? 's' : ''}.
        </p>
      )
    }
    case 'session_created': {
      const fmt = typeof meta.contentFormat === 'string' ? meta.contentFormat : null
      return actorIsKabou ? (
        <p>
          {actorTag} a préparé un tournage{fmt ? ` en ${fmt}` : ''}.
        </p>
      ) : (
        <p>
          Tournage{fmt ? ` ${fmt}` : ''} démarré.
        </p>
      )
    }
    case 'kabou_enriched':
      return (
        <p>
          {actorTag} a enrichi le sujet.
        </p>
      )
    default:
      return <p>{label}</p>
  }
}

export function SubjectTimelineSection({
  events,
  defaultOpen = false,
}: SubjectTimelineSectionProps) {
  const sorted = useMemo(() => {
    if (!events) return []
    return [...events].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [events])

  const count = sorted.length

  return (
    <SubjectSection
      number="05"
      title="Le fil du sujet"
      subtitle="L'historique des décisions, mutations, tournages."
      help={<TimelineHelp />}
      chip={
        count > 0 ? (
          <SectionChip>
            {count} événement{count > 1 ? 's' : ''}
          </SectionChip>
        ) : (
          <SectionChip>Aucun événement</SectionChip>
        )
      }
      defaultOpen={defaultOpen}
    >
      {count === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-raised/20 p-5 max-w-[680px] flex items-start gap-3">
          <History className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Pas encore d'événements tracés. Chaque décision (édition d'angle,
            ajout de source, tournage) viendra s'inscrire ici au fil des actions.
          </p>
        </div>
      ) : (
        <ul className="rounded-xl border border-border bg-surface-raised/40 p-5 space-y-3 text-[13px] max-w-[680px]">
          {sorted.map((ev) => (
            <li key={ev.id} className="flex gap-3 items-baseline">
              <span className="font-mono text-[10px] text-muted-foreground/70 w-14 shrink-0">
                {formatRelative(ev.createdAt)}
              </span>
              <div className="flex-1 min-w-0">{describe(ev)}</div>
            </li>
          ))}
        </ul>
      )}
    </SubjectSection>
  )
}
