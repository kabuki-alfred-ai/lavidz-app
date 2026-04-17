'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FORMAT_CONFIGS, type ContentFormat } from '@lavidz/types'

type CalendarEntry = {
  id: string
  scheduledDate: string
  topic: string
  description?: string | null
  format: ContentFormat
  platforms: string[]
  status: string
  aiSuggestions?: { hook?: string } | null
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PLANNED: { label: 'Planifie', className: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400' },
  RECORDED: { label: 'Enregistre', className: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
  EDITING: { label: 'Montage', className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' },
  DELIVERED: { label: 'Livre', className: 'border-green-500/40 bg-green-500/10 text-green-400' },
  PUBLISHED: { label: 'Publie', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
  SKIPPED: { label: 'Annule', className: 'border-red-500/40 bg-red-500/10 text-red-400' },
}

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
]

function getWeekDates(offset: number) {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7
  const monday = new Date(now.getFullYear(), now.getMonth(), diff)
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }
  return dates
}

function formatDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CalendarClient() {
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genPlatforms, setGenPlatforms] = useState<string[]>(['linkedin'])
  const [genWeeks, setGenWeeks] = useState(4)
  const [genVideosPerWeek, setGenVideosPerWeek] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/content-calendar', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setEntries(Array.isArray(data) ? data : data.entries ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  async function handleGenerate() {
    if (genPlatforms.length === 0) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ai/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platforms: genPlatforms,
          weeksCount: genWeeks,
          videosPerWeek: genVideosPerWeek,
        }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Erreur lors de la generation')
      }
      setShowGenerateModal(false)
      await fetchEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setGenerating(false)
    }
  }

  const weekDates = getWeekDates(weekOffset)

  function togglePlatform(id: string) {
    setGenPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[1px] bg-primary/40" />
            <p className="text-xs text-primary/60">
              Planification
            </p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Calendrier de contenu
          </h1>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Planifie et visualise ton contenu semaine par semaine
          </p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Sparkles size={13} />
          Generer
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-2 border border-border rounded-lg hover:bg-surface-raised transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <p className="text-xs text-muted-foreground">
          {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
        </p>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-2 border border-border rounded-lg hover:bg-surface-raised transition-colors"
        >
          <ChevronRight size={14} />
        </button>
        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs text-primary hover:underline"
          >
            Aujourd&apos;hui
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Chargement...</span>
        </div>
      )}

      {/* Week grid */}
      {!loading && (
        <div className="grid grid-cols-7 gap-3">
          {weekDates.map((date) => {
            const dayEntries = entries.filter((e) => isSameDay(new Date(e.scheduledDate), date))
            const isToday = isSameDay(date, new Date())
            return (
              <div key={date.toISOString()} className="min-h-[160px]">
                <div
                  className={`text-xs mb-2 px-1 py-1 ${
                    isToday ? 'text-primary font-bold' : 'text-muted-foreground'
                  }`}
                >
                  {formatDate(date)}
                </div>
                <div className="space-y-2">
                  {dayEntries.map((entry) => {
                    const fmt = FORMAT_CONFIGS[entry.format]
                    const status = STATUS_STYLES[entry.status] ?? STATUS_STYLES.PLANNED
                    return (
                      <Card key={entry.id} className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedEntry(entry)}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-1.5">
                            {fmt && <span className="text-xs">{fmt.icon}</span>}
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                              {fmt?.label ?? entry.format}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-foreground leading-snug">{entry.topic}</p>
                          {entry.aiSuggestions?.hook && (
                            <p className="text-xs text-muted-foreground italic leading-snug line-clamp-2">
                              {entry.aiSuggestions.hook}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {entry.platforms?.map((p) => (
                              <Badge key={p} variant="outline" className="text-[8px] px-1.5 py-0">
                                {p}
                              </Badge>
                            ))}
                          </div>
                          <Badge className={status.className}>{status.label}</Badge>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="border border-dashed border-border/30 p-20 text-center rounded-lg bg-surface/10">
          <CalendarDays size={32} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="font-bold text-lg text-foreground mb-2">Aucun contenu planifie</p>
          <p className="text-xs text-muted-foreground/80 mb-8">
            Genere ton calendrier IA pour commencer
          </p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Sparkles size={13} />
            Generer un calendrier
          </button>
        </div>
      )}

      {/* Entry detail panel */}
      {selectedEntry && (() => {
        const fmt = FORMAT_CONFIGS[selectedEntry.format]
        const status = STATUS_STYLES[selectedEntry.status] ?? STATUS_STYLES.PLANNED
        const scheduledDate = new Date(selectedEntry.scheduledDate)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedEntry(null)}>
            <div className="bg-card border border-border rounded-lg p-0 w-full max-w-lg shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header with format accent */}
              <div className="px-6 pt-6 pb-4 border-b border-border/40">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {fmt && <span className="text-lg">{fmt.icon}</span>}
                    <span className="text-xs font-medium text-primary">
                      {fmt?.label ?? selectedEntry.format}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={status.className}>{status.label}</Badge>
                    <button onClick={() => setSelectedEntry(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <h2 className="text-lg font-black tracking-tight text-foreground leading-snug">
                  {selectedEntry.topic}
                </h2>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-5">
                {/* Date & Platforms */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Date</p>
                    <p className="text-sm text-foreground">
                      {scheduledDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Plateformes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEntry.platforms?.map((p) => (
                        <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedEntry.description && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{selectedEntry.description}</p>
                  </div>
                )}

                {/* Hook */}
                {selectedEntry.aiSuggestions?.hook && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Hook suggere</p>
                    <div className="border border-primary/20 bg-primary/5 rounded-lg p-3">
                      <p className="text-sm text-foreground italic leading-relaxed">
                        &ldquo;{selectedEntry.aiSuggestions.hook}&rdquo;
                      </p>
                    </div>
                  </div>
                )}

                {/* Format details */}
                {fmt && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">A propos du format</p>
                    <div className="border border-border/40 bg-surface/40 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs text-foreground/70">{fmt.description}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Duree : ~{fmt.defaultDurationSec}s</span>
                        <span>Mode : {fmt.recordingMode}</span>
                        {fmt.hasTTS && <span>TTS : oui</span>}
                        {fmt.hasTeleprompter && <span>Teleprompter : oui</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-border/40 flex items-center gap-3">
                {selectedEntry.status === 'PLANNED' && (
                  <button
                    onClick={() => {
                      window.location.href = '/admin/ai-session'
                      setSelectedEntry(null)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Sparkles size={12} />
                    Creer la session
                  </button>
                )}
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="px-4 py-2.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Generate modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black uppercase tracking-tight">Generer un calendrier</h2>
              <button onClick={() => setShowGenerateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Plateformes
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2 p-3 border rounded-lg text-left transition-colors text-xs ${
                      genPlatforms.includes(p.id)
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border bg-surface/40 text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weeks slider */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre de semaines : {genWeeks}
              </label>
              <input
                type="range"
                min={1}
                max={8}
                value={genWeeks}
                onChange={(e) => setGenWeeks(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>8</span>
              </div>
            </div>

            {/* Videos per week slider */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Videos par semaine : {genVideosPerWeek}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={genVideosPerWeek}
                onChange={(e) => setGenVideosPerWeek(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>5</span>
              </div>
            </div>

            {error && (
              <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating || genPlatforms.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <>
                  <span className="w-3 h-3 border border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Generation en cours...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Generer
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
