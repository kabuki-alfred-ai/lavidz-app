'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles,
  CalendarDays,
  Play,
  Film,
  Loader2,
  ArrowRight,
  MessageSquare,
  Mic,
  Zap,
  BookOpen,
  TrendingUp,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'

interface HomeBriefData {
  userName: string
  nextSession: {
    title: string
    date: string
    format: string
    questionCount: number
  } | null
  lastVideo: {
    title: string
    date: string
    status: string
  } | null
  suggestions: {
    title: string
    format: string
    reason: string
  }[]
  trends: {
    title: string
    url: string
    snippet: string
  }[]
  trendsRecap: string | null
  hasProfile: boolean
}

const FORMAT_ICONS: Record<string, typeof Film> = {
  QUESTION_BOX: Mic,
  TELEPROMPTER: BookOpen,
  HOT_TAKE: Zap,
  STORYTELLING: MessageSquare,
  DAILY_TIP: Sparkles,
  MYTH_VS_REALITY: Zap,
}

const FORMAT_LABELS: Record<string, string> = {
  QUESTION_BOX: 'Interview',
  TELEPROMPTER: 'Guide',
  HOT_TAKE: 'Reaction',
  STORYTELLING: 'Histoire',
  DAILY_TIP: 'Conseil',
  MYTH_VS_REALITY: 'Myth vs Reality',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Demain'
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long' })
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export function HomeBrief() {
  const router = useRouter()
  const [data, setData] = useState<HomeBriefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [trendsRefreshing, setTrendsRefreshing] = useState(false)
  const [creatingTopic, setCreatingTopic] = useState<string | null>(null)

  const createTopicAndRedirect = useCallback(async (name: string, brief?: string) => {
    setCreatingTopic(name)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, brief }),
      })
      if (res.ok) {
        const topic = await res.json()
        router.push(`/sujets/${topic.id}`)
        return
      }
    } catch { /* */ }
    // Fallback to chat if topic creation fails
    router.push(`/chat?topic=${encodeURIComponent(name)}`)
    setCreatingTopic(null)
  }, [router])

  const fetchBrief = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/home-brief', { credentials: 'include' })
      if (res.ok) setData(await res.json())
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  const refreshTrends = useCallback(async () => {
    setTrendsRefreshing(true)
    try {
      const res = await fetch('/api/home-brief/trends', { credentials: 'include' })
      if (res.ok) {
        const { trends, trendsRecap } = await res.json()
        setData((prev) => prev ? { ...prev, trends, trendsRecap } : prev)
      }
    } catch { /* */ }
    finally { setTrendsRefreshing(false) }
  }, [])

  useEffect(() => { fetchBrief() }, [fetchBrief])

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-40 bg-muted animate-pulse rounded-2xl" />
        <div className="h-24 bg-muted animate-pulse rounded-2xl" />
        <div className="space-y-3">
          <div className="h-20 bg-muted animate-pulse rounded-xl" />
          <div className="h-20 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Impossible de charger le brief.</p>
      </div>
    )
  }

  const greeting = getGreeting()

  return (
    <div className="max-w-xl mx-auto px-4 py-8 md:py-12 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting} {data.userName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Next session — hero card */}
      {data.nextSession ? (
        <div className="rounded-2xl bg-primary/5 p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <CalendarDays size={16} />
            <span className="text-xs font-medium">{formatDate(data.nextSession.date)}</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{data.nextSession.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {FORMAT_LABELS[data.nextSession.format] || data.nextSession.format} · {data.nextSession.questionCount} questions
            </p>
          </div>
          <div className="pt-2">
            <Link href={`/chat?action=record&topic=${encodeURIComponent(data.nextSession.title)}&format=${data.nextSession.format}`}>
              <Button className="gap-2">
                <Play size={14} />
                Lancer la session
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-muted/30 p-6 space-y-3 text-center">
          <CalendarDays size={24} className="text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Aucune session planifiee</p>
          <Link href="/calendar">
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarDays size={14} />
              Voir le calendrier
            </Button>
          </Link>
        </div>
      )}

      {/* Last video */}
      {data.lastVideo && (
        <div className="rounded-xl bg-muted/20 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Film size={16} className="text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{data.lastVideo.title}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeDate(data.lastVideo.date)}</p>
            </div>
          </div>
          <Link href="/videos" className="text-xs text-primary hover:text-primary/80 transition-colors shrink-0 flex items-center gap-1">
            Voir <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Trends */}
      {data.trends?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp size={14} className="text-orange-500" />
              Tendances du jour
            </h3>
            <button
              onClick={refreshTrends}
              disabled={trendsRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} className={trendsRefreshing ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>
          {data.trendsRecap && (
            <div className="rounded-xl bg-orange-500/5 border border-orange-500/10 p-4 space-y-3">
              <div className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none [&_p]:my-1 [&_strong]:text-foreground">
                <ReactMarkdown>{data.trendsRecap}</ReactMarkdown>
              </div>
              <button
                onClick={() => createTopicAndRedirect('Tendance du jour', data.trendsRecap ?? undefined)}
                disabled={creatingTopic !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-500/90 transition-colors disabled:opacity-50"
              >
                {creatingTopic ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                Creer un sujet sur cette tendance
              </button>
            </div>
          )}
          <div className="space-y-2">
            {data.trends.map((t, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.snippet}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/50 hover:text-orange-500 transition-colors flex items-center gap-1">
                      Lire <ExternalLink size={9} />
                    </a>
                    <button
                      onClick={() => createTopicAndRedirect(t.title, t.snippet)}
                      disabled={creatingTopic !== null}
                      className="text-xs text-orange-500/70 hover:text-orange-500 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {creatingTopic === t.title ? <Loader2 size={9} className="animate-spin" /> : <Mic size={9} />} Creer un sujet
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            Idees pour toi
          </h3>
          <div className="space-y-2">
            {data.suggestions.map((s, i) => {
              const Icon = FORMAT_ICONS[s.format] || Sparkles
              return (
                <button
                  key={i}
                  onClick={() => createTopicAndRedirect(s.title, s.reason)}
                  disabled={creatingTopic !== null}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-muted/15 hover:bg-muted/30 transition-colors group text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    {creatingTopic === s.title ? <Loader2 size={16} className="text-primary/70 animate-spin" /> : <Icon size={16} className="text-primary/70" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* No profile CTA */}
      {!data.hasProfile && (
        <div className="rounded-2xl bg-muted/20 p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mx-auto">
            <MessageSquare size={20} className="text-primary/60" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            On ne se connait pas encore. Raconte-moi ton activite pour que je te prepare tes premiers sujets.
          </p>
          <Link href="/chat">
            <Button size="sm" className="gap-1.5">
              <MessageSquare size={14} />
              Discuter avec l&apos;IA
            </Button>
          </Link>
        </div>
      )}

      {/* Quick access */}
      <div className="flex items-center justify-center gap-3 pt-4">
        <Link href="/chat" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
          <MessageSquare size={12} /> Chat IA
        </Link>
        <span className="text-muted-foreground/30">·</span>
        <Link href="/calendar" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
          <CalendarDays size={12} /> Calendrier
        </Link>
        <span className="text-muted-foreground/30">·</span>
        <Link href="/videos" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
          <Film size={12} /> Videos
        </Link>
      </div>
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon apres-midi'
  return 'Bonsoir'
}
