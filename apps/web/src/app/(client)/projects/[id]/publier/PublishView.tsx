'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LinkedInPostsSection } from '@/components/social/LinkedInPostsSection'
import { POST_RECORDING_COPY, KABOU_TOASTS } from '@/lib/kabou-voice'

interface PublishViewProps {
  projectId: string
  /** Source session (Project.sessionId). Alimente publish flag, video, LinkedIn. */
  sessionId: string
  themeName: string | null
  topic: { id: string; name: string; pillar: string | null } | null
  status: string
  hasFinalVideo: boolean
  authorName: string
  publishedAt: string | null
}

/**
 * Publish view — rendue sous `/projects/[id]/publier`. La publication est
 * désormais un attribut de Project (pas Session) : Project peut à terme
 * aggréger des rushes multi-sessions. Pour V1, la source demeure la
 * session canonique (`Project.sessionId`) — l'agrégation multi-session
 * arrive en Task 11.4 (dehors du scope de cette phase).
 */
export function PublishView({
  projectId,
  sessionId,
  themeName,
  topic,
  status,
  hasFinalVideo,
  authorName,
  publishedAt,
}: PublishViewProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [publishedAtLocal, setPublishedAtLocal] = useState<string | null>(publishedAt)
  const [publishTogglePending, setPublishTogglePending] = useState(false)

  const flashToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const handleTogglePublished = useCallback(async () => {
    setPublishTogglePending(true)
    try {
      const method = publishedAtLocal ? 'DELETE' : 'POST'
      const res = await fetch(`/api/sessions/${sessionId}/publish`, {
        method,
        credentials: 'include',
      })
      if (!res.ok) {
        flashToast(KABOU_TOASTS.oops)
        return
      }
      const data = (await res.json()) as { publishedAt: string | null }
      setPublishedAtLocal(data.publishedAt)
      flashToast(data.publishedAt ? 'Noté — bravo.' : 'Marqué non-publié.')
    } finally {
      setPublishTogglePending(false)
    }
  }, [publishedAtLocal, sessionId, flashToast])

  useEffect(() => {
    if (!hasFinalVideo) return
    let cancelled = false
    setLoadingVideo(true)
    fetch(`/api/sessions/${sessionId}/final-url`, { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setVideoError(await res.text())
          return
        }
        const data = await res.json()
        const url = typeof data === 'string' ? data : (data?.url ?? null)
        if (url) setVideoUrl(url)
      })
      .catch((err) => setVideoError(err instanceof Error ? err.message : String(err)))
      .finally(() => {
        if (!cancelled) setLoadingVideo(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, hasFinalVideo])

  const displayTitle = topic?.name ?? themeName ?? 'Ton contenu'
  const isDone = status === 'DONE' || status === 'LIVE'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      {/* Back link — remonte vers le Project (nouvelle archi) */}
      <div className="mb-5">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au projet
        </Link>
      </div>

      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          {isDone ? 'Ton contenu est prêt' : 'Encore quelques minutes'}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {isDone ? "Ton contenu est prêt — on le lance ?" : 'Presque prêt'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isDone
            ? "Tu l'as bien porté. Voici ta vidéo et trois façons de la raconter en mots — tu choisis comment tu veux la partager."
            : 'Ton montage finalise — reviens dans un instant ou continue à préparer tes prochains sujets.'}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{displayTitle}</span>
          {topic?.pillar && (
            <span className="ml-2 rounded-full bg-surface-raised/60 px-2 py-0.5 text-xs">
              🎯 {topic.pillar}
            </span>
          )}
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-border/50 bg-black overflow-hidden">
        {loadingVideo && (
          <div className="flex aspect-video items-center justify-center text-sm text-white/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Je charge ta vidéo…
          </div>
        )}
        {!loadingVideo && videoError && (
          <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-white/60">
            {KABOU_TOASTS.oops}
            <span className="ml-2 text-white/40">({videoError})</span>
          </div>
        )}
        {!loadingVideo && !videoError && videoUrl && (
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full"
          />
        )}
        {!loadingVideo && !videoError && !videoUrl && !hasFinalVideo && (
          <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-white/60">
            Le montage finalise. L'aperçu apparaîtra ici dès qu'il sera prêt.
          </div>
        )}
      </section>

      {isDone && videoUrl && (
        <section className="mb-10 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <a href={videoUrl} download={`${displayTitle}.mp4`}>
              <Download className="h-4 w-4" /> Télécharger la vidéo
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled
            title="Bientôt : programmer la publication via un outil tiers (Buffer, Metricool…)"
          >
            <Clock className="h-4 w-4" /> Programmer — bientôt
          </Button>
        </section>
      )}

      {isDone && (
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Trois façons de le raconter
            </h2>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <LinkedInPostsSection
            endpoint={`/api/sessions/${sessionId}/linkedin-posts`}
            authorName={authorName}
            generateLabel="Proposer trois variantes LinkedIn"
          />
        </section>
      )}

      <section className="mb-8 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
        {publishedAtLocal ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">Publié</p>
                <p className="text-xs text-muted-foreground">
                  Mis en ligne le{' '}
                  {new Date(publishedAtLocal).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleTogglePublished}
              disabled={publishTogglePending}
            >
              {publishTogglePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              Marquer non-publié
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Tu l'as publié ?</p>
              <p className="text-xs text-muted-foreground">
                Dis-le-moi — ça me permet de tenir ton arche narrative à jour.
              </p>
            </div>
            <Button size="sm" onClick={handleTogglePublished} disabled={publishTogglePending}>
              {publishTogglePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              C'est en ligne
            </Button>
          </div>
        )}
      </section>

      <section className="mt-10 border-t border-border/40 pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {POST_RECORDING_COPY.nextSteps.heading}
        </p>
        <div className="flex flex-wrap gap-2">
          {topic && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/sujets/${topic.id}`}>Retour au sujet</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}`}>Retour au projet</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">Voir le calendrier</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/chat">Préparer le prochain avec Kabou</Link>
          </Button>
        </div>
      </section>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border/40 bg-card px-4 py-2 text-xs shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
