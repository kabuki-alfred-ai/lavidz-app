import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import Link from 'next/link'
import { Clock, Video, ArrowRight, Mic, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const FORMAT_LABELS: Record<string, string> = {
  QUESTION_BOX: 'Interview',
  TELEPROMPTER: 'Guide',
  HOT_TAKE: 'Réaction',
  STORYTELLING: 'Histoire',
  DAILY_TIP: 'Conseil',
  MYTH_VS_REALITY: 'Mythe vs Réalité',
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DONE:      { label: 'Terminé',    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  LIVE:      { label: 'Publié',     className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  RECORDING: { label: 'En cours',   className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  PENDING:   { label: 'Démarré',    className: 'bg-muted text-muted-foreground' },
}

function estimateDurationFromWords(wordTimestamps: unknown): number {
  if (!Array.isArray(wordTimestamps) || wordTimestamps.length === 0) return 0
  const last = wordTimestamps[wordTimestamps.length - 1] as Record<string, unknown> | undefined
  if (!last) return 0
  const end = typeof last.end === 'number' ? last.end : typeof last.endTime === 'number' ? last.endTime : null
  return end !== null ? Math.round(end * 1000) : 0
}

function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes} min ${seconds.toString().padStart(2, '0')}s`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function TournagesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  if (!user.organizationId) redirect('/home')

  const sessions = await prisma.session.findMany({
    where: {
      theme: { organizationId: user.organizationId },
      recordings: { some: {} },
    },
    include: {
      theme: { select: { name: true } },
      topicEntity: { select: { id: true, name: true } },
      recordings: {
        where: { supersededAt: null, status: { not: 'FAILED' } },
        select: { id: true, wordTimestamps: true },
      },
      analysis: { select: { status: true, standoutMoment: true } },
    },
    orderBy: { lastActivityAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground mb-1">Mes tournages</h1>
        <p className="text-sm text-muted-foreground">
          {sessions.length === 0
            ? 'Aucun tournage pour le moment.'
            : `${sessions.length} tournage${sessions.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
            <Video className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Pas encore de tournage</p>
            <p className="text-xs text-muted-foreground">
              Lance un tournage depuis un sujet pour le voir apparaître ici.
            </p>
          </div>
          <Link
            href="/topics"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Voir mes sujets <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => {
            const durationMs = session.recordings.reduce(
              (sum, r) => sum + estimateDurationFromWords(r.wordTimestamps),
              0,
            )
            const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.PENDING
            const format = session.contentFormat ? FORMAT_LABELS[session.contentFormat] : null
            const hasAnalysis = session.analysis?.status === 'READY'
            const standout = session.analysis?.standoutMoment

            const topicId = session.topicEntity?.id ?? null
            const topicName = session.topicEntity?.name ?? null

            return (
              <div
                key={session.id}
                className="group flex flex-col rounded-2xl border border-border/60 bg-surface/50 overflow-hidden transition-colors hover:bg-surface-raised/60"
              >
                {/* Sujet associé — lien distinct vers le sujet */}
                {topicId && topicName ? (
                  <Link
                    href={`/sujets/${topicId}`}
                    className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/40 hover:bg-primary/5 transition-colors"
                  >
                    <FileText className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[11px] font-medium text-primary truncate">{topicName}</span>
                    <ArrowRight className="h-3 w-3 text-primary/50 shrink-0 ml-auto" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/40">
                    <FileText className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <span className="text-[11px] text-muted-foreground/50 truncate">{session.theme?.name ?? 'Tournage libre'}</span>
                  </div>
                )}

                {/* Contenu principal — lien vers l'après-tournage */}
                <Link
                  href={`/sujets/${session.id}/apres-tournage`}
                  className="flex flex-col gap-3 px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Mic className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                        {format && (
                          <span className="text-[10px] text-muted-foreground">{format}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-1">
                        {durationMs > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(durationMs)}
                          </span>
                        )}
                        {durationMs > 0 && session.recordings.length > 0 && (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                        {session.recordings.length > 0 && (
                          <span>{session.recordings.length} prise{session.recordings.length > 1 ? 's' : ''}</span>
                        )}
                        {session.lastActivityAt && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{formatDate(new Date(session.lastActivityAt))}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-muted-foreground transition-colors" />
                  </div>

                  {hasAnalysis && standout && (
                    <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-primary/30 pl-3">
                      &laquo;&nbsp;{standout}&nbsp;&raquo;
                    </p>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
