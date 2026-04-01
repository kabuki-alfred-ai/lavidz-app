'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Star, MessageSquare, TrendingUp } from 'lucide-react'
import type { FeedbackDto } from '@lavidz/types'

interface Props {
  feedbacks: FeedbackDto[]
  stats: { count: number; avgOverall: number; avgQuestion: number }
}

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ fontSize: size, color: s <= value ? '#facc15' : 'currentColor', opacity: s <= value ? 1 : 0.15 }}>
          &#9733;
        </span>
      ))}
    </span>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className="bg-card/50 border-border/40">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <p className="text-2xl font-black tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function FeedbacksClient({ feedbacks, stats }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">Feedbacks</h1>
        <p className="text-sm text-muted-foreground mt-1">Retours des participants après chaque session</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total feedbacks" value={String(stats.count)} icon={MessageSquare} />
        <StatCard label="Note globale moyenne" value={stats.avgOverall ? `${stats.avgOverall}/5` : '—'} icon={TrendingUp} />
        <StatCard label="Note questions moyenne" value={stats.avgQuestion ? `${stats.avgQuestion}/5` : '—'} icon={Star} />
      </div>

      {/* Feedback list */}
      {feedbacks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Aucun feedback pour le moment
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map(fb => (
            <Card key={fb.id} className="bg-card/50 border-border/40">
              <CardContent className="p-5 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                      {(fb.session?.recipientName ?? fb.session?.recipientEmail ?? '?')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {fb.session?.recipientName || fb.session?.recipientEmail || 'Anonyme'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fb.session?.theme?.name ?? '—'} &middot; {formatDate(fb.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ratings */}
                <div className="flex gap-6">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Global</p>
                    <Stars value={fb.overallRating} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Questions</p>
                    <Stars value={fb.questionRating} />
                  </div>
                </div>

                {/* Comment */}
                {fb.comment && (
                  <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 italic font-medium">
                    &ldquo;{fb.comment}&rdquo;
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
