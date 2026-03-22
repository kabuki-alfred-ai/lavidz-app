'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { CheckCircle, Video, FileText, RotateCcw, Scissors } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Recording {
  id: string
  questionId: string
  status: string
  transcript: string | null
  rawVideoKey: string | null
}

interface Question {
  id: string
  text: string
}

interface Session {
  id: string
  theme: { name: string; slug: string; questions: Question[] }
  recordings: Recording[]
  status: string
}


export function ResultView({ session, slug }: { session: Session | null; slug: string }) {
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Auto-fetch all video URLs on mount
  useEffect(() => {
    if (!session) return
    session.recordings
      .filter((r) => r.rawVideoKey)
      .forEach((r) => getVideoUrl(r))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono text-sm">Session introuvable.</p>
      </div>
    )
  }

  const getVideoUrl = async (recording: Recording) => {
    if (videoUrls[recording.id]) return
    setLoadingId(recording.id)
    try {
      const res = await fetch(
        `${API}/api/sessions/${session.id}/recordings/${recording.id}/url`,
      )
      const url = await res.text()
      setVideoUrls((prev) => ({ ...prev, [recording.id]: url }))
    } finally {
      setLoadingId(null)
    }
  }

  const completedCount = session.recordings.filter((r) => r.status !== 'FAILED').length
  const totalQuestions = session.theme.questions.length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-primary" />
          <span className="font-sans font-bold text-sm tracking-tight">{session.theme.name}</span>
        </div>
        <Badge variant="active">Terminé</Badge>
      </header>

      <div className="max-w-3xl mx-auto px-8 py-12 animate-fade-in">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="w-12 h-12 border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={20} className="text-emerald-400" />
          </div>
          <h1 className="font-sans font-extrabold text-3xl tracking-tight mb-2">Dans la boîte.</h1>
          <p className="text-sm text-muted-foreground">
            {completedCount} / {totalQuestions} réponses enregistrées
          </p>
        </div>

        {/* Recordings */}
        <div className="flex flex-col gap-4">
          {session.theme.questions.map((question, i) => {
            const recording = session.recordings.find((r) => r.questionId === question.id)
            const videoUrl = recording ? videoUrls[recording.id] : undefined
            const isLoading = recording?.id === loadingId

            return (
              <Card key={question.id}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-[10px] font-mono text-muted-foreground/50 mt-0.5 shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <CardTitle className="text-sm font-sans font-semibold leading-snug">
                        {question.text}
                      </CardTitle>
                    </div>
                    {recording && (
                      <Badge
                        variant={recording.status === 'DONE' ? 'active' : recording.status === 'FAILED' ? 'destructive' : 'secondary'}
                        className="shrink-0"
                      >
                        {recording.status === 'DONE' ? 'Transcrit' : recording.status === 'TRANSCRIBING' ? 'En cours...' : recording.status === 'FAILED' ? 'Échec' : 'En attente'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                {recording && (
                  <CardContent className="pt-0 flex flex-col gap-4">
                    {/* Transcript */}
                    {recording.transcript && (
                      <div className="bg-surface-raised border border-border p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={11} className="text-muted-foreground" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                            Transcription
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{recording.transcript}</p>
                      </div>
                    )}

                    {/* Video */}
                    {videoUrl ? (
                      <video
                        src={videoUrl}
                        controls
                        className="w-full border border-border bg-black"
                        style={{ aspectRatio: '16/9' }}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        <Video size={11} className={isLoading ? 'animate-pulse' : ''} />
                        {isLoading ? 'Chargement...' : 'Vidéo non disponible'}
                      </div>
                    )}
                  </CardContent>
                )}

                {!recording && (
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground font-mono">Non enregistré</p>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-12">
          {session.recordings.length > 0 && (
            <Button asChild>
              <Link href={`/process/${session.id}`}>
                <Scissors size={12} />
                Monter la vidéo
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/session/${slug}`}>
              <RotateCcw size={12} />
              Nouvelle session
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
