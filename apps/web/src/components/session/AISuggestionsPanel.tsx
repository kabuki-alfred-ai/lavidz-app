'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Film, Zap, Type, Clock, RefreshCw, Check, ChevronDown, ChevronUp, Loader2, ExternalLink, Plus, Trash2 } from 'lucide-react'

interface BRollSuggestion {
  timestamp: number
  duration: number
  searchQuery: string
  reason: string
  accepted?: boolean
}

interface HookAnalysis {
  currentHookEndTime: number
  hookQuality: 'strong' | 'medium' | 'weak'
  suggestion: string
}

interface PaceAnalysis {
  averageSentenceDuration: number
  slowSections: { startTime: number; endTime: number; suggestion: string }[]
}

interface SubtitleHighlight {
  word: string
  reason: string
}

interface Suggestions {
  brollSuggestions: BRollSuggestion[]
  hookAnalysis: HookAnalysis
  paceAnalysis: PaceAnalysis
  subtitleHighlights: SubtitleHighlight[]
}

interface SelectedBRoll {
  id: string
  timestampSeconds: number
  durationSeconds: number
  videoUrl: string
  thumbnailUrl: string
  pexelsId?: string
  searchQuery: string
}

interface Props {
  transcript: string | null
  wordTimestamps: { word: string; start: number; end: number }[] | null
  duration: number
  platform?: string
  format?: string
  accentColor?: string
  onSeekTo?: (timeInSeconds: number) => void
  onBRollSearch?: (query: string, timestamp: number) => void
  selectedBRolls?: SelectedBRoll[]
  onSelectBRoll?: (broll: SelectedBRoll) => void
  onRemoveBRoll?: (id: string) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const HOOK_QUALITY_CONFIG = {
  strong: { color: '#22c55e', label: 'Fort', icon: '💪' },
  medium: { color: '#f59e0b', label: 'Moyen', icon: '⚡' },
  weak: { color: '#ef4444', label: 'Faible', icon: '⚠️' },
} as const

export default function AISuggestionsPanel({
  transcript,
  wordTimestamps,
  duration,
  platform,
  format,
  accentColor = '#FF4D1C',
  onSeekTo,
  onBRollSearch,
  selectedBRolls = [],
  onSelectBRoll,
  onRemoveBRoll,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>('broll')
  const [pexelsResults, setPexelsResults] = useState<Record<number, { loading: boolean; results: { pexelsId: string; url: string; thumbnailUrl: string; duration: number; title: string }[] }>>({})

  const searchPexels = useCallback(async (query: string, idx: number) => {
    setPexelsResults(prev => ({ ...prev, [idx]: { loading: true, results: [] } }))
    try {
      const res = await fetch(`/api/admin/broll/search?q=${encodeURIComponent(query)}&perPage=4`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const results = Array.isArray(data) ? data : data.results ?? data.videos ?? []
        setPexelsResults(prev => ({ ...prev, [idx]: { loading: false, results } }))
      } else {
        setPexelsResults(prev => ({ ...prev, [idx]: { loading: false, results: [] } }))
      }
    } catch {
      setPexelsResults(prev => ({ ...prev, [idx]: { loading: false, results: [] } }))
    }
  }, [])

  const analyze = useCallback(async () => {
    if (!transcript) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, wordTimestamps, duration, platform, format }),
      })

      if (!res.ok) throw new Error('Erreur lors de l\'analyse')
      const data = await res.json()
      setSuggestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [transcript, wordTimestamps, duration, platform, format])

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section))
  }

  if (!transcript) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-white/40 font-mono">La transcription est necessaire pour les suggestions IA.</p>
      </div>
    )
  }

  if (!suggestions) {
    return (
      <div className="p-4 flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: accentColor + '20' }}>
          <Sparkles size={20} style={{ color: accentColor }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">Suggestions IA</p>
          <p className="text-xs text-white/40 mt-1">
            Analyse ta video pour obtenir des suggestions de B-rolls, coupes et sous-titres optimises.
          </p>
        </div>
        {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
          style={{ background: accentColor }}
        >
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Analyser avec l&apos;IA
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {/* Refresh button */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Suggestions IA</p>
        <button
          onClick={analyze}
          disabled={loading}
          className="text-white/40 hover:text-white transition-colors disabled:opacity-30"
          title="Re-analyser"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Hook Analysis */}
      <SectionHeader
        icon={<Zap size={13} />}
        title="Hook"
        badge={
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: HOOK_QUALITY_CONFIG[suggestions.hookAnalysis.hookQuality].color + '20',
              color: HOOK_QUALITY_CONFIG[suggestions.hookAnalysis.hookQuality].color,
            }}
          >
            {HOOK_QUALITY_CONFIG[suggestions.hookAnalysis.hookQuality].icon}{' '}
            {HOOK_QUALITY_CONFIG[suggestions.hookAnalysis.hookQuality].label}
          </span>
        }
        expanded={expandedSection === 'hook'}
        onToggle={() => toggleSection('hook')}
      />
      {expandedSection === 'hook' && (
        <div className="px-4 pb-3">
          <p className="text-xs text-white/60 leading-relaxed">{suggestions.hookAnalysis.suggestion}</p>
          <button
            onClick={() => onSeekTo?.(0)}
            className="mt-2 text-[10px] font-mono text-white/40 hover:text-white transition-colors"
          >
            ▶ Voir le hook ({formatTime(suggestions.hookAnalysis.currentHookEndTime)})
          </button>
        </div>
      )}

      {/* B-Roll Suggestions */}
      <SectionHeader
        icon={<Film size={13} />}
        title="B-Rolls suggeres"
        badge={<span className="text-[10px] text-white/30">{suggestions.brollSuggestions.length}</span>}
        expanded={expandedSection === 'broll'}
        onToggle={() => toggleSection('broll')}
      />
      {expandedSection === 'broll' && (
        <div className="px-4 pb-3 space-y-2">
          {suggestions.brollSuggestions.map((broll, idx) => {
            const pexels = pexelsResults[idx]
            return (
              <div
                key={idx}
                className="rounded-lg p-3 border border-white/5"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={() => onSeekTo?.(broll.timestamp)}
                    className="text-[10px] font-mono hover:text-white transition-colors"
                    style={{ color: accentColor }}
                  >
                    ▶ {formatTime(broll.timestamp)} ({broll.duration}s)
                  </button>
                  <button
                    onClick={() => searchPexels(broll.searchQuery, idx)}
                    disabled={pexels?.loading}
                    className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
                  >
                    {pexels?.loading ? <Loader2 size={10} className="animate-spin" /> : <Film size={10} />}
                    {pexels?.results?.length ? 'Relancer' : 'Chercher'}
                  </button>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{broll.reason}</p>
                <p className="text-[10px] text-white/25 mt-1 font-mono">&quot;{broll.searchQuery}&quot;</p>

                {/* Selected B-roll for this timestamp */}
                {selectedBRolls.filter(b => Math.abs(b.timestampSeconds - broll.timestamp) < 1).map(sel => (
                  <div key={sel.id} className="mt-2 flex items-center gap-2 rounded-lg p-1.5 border border-emerald-500/30 bg-emerald-500/10">
                    {sel.thumbnailUrl && (
                      <img src={sel.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-emerald-400 truncate flex items-center gap-1">
                        <Check size={10} /> B-Roll selectionne
                      </p>
                      <p className="text-[9px] text-white/30 truncate">{sel.searchQuery}</p>
                    </div>
                    {onRemoveBRoll && (
                      <button
                        onClick={() => onRemoveBRoll(sel.id)}
                        className="flex-shrink-0 p-1 text-white/30 hover:text-red-400 transition-colors"
                        title="Retirer ce B-Roll"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}

                {/* Pexels results grid */}
                {pexels?.results && pexels.results.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {pexels.results.map((video) => {
                      const isSelected = selectedBRolls.some(b => b.pexelsId === video.pexelsId)
                      return (
                        <div
                          key={video.pexelsId}
                          className={`relative group rounded overflow-hidden border transition-colors cursor-pointer ${isSelected ? 'border-emerald-500/50' : 'border-white/5 hover:border-white/20'}`}
                          onClick={() => {
                            if (isSelected) return
                            onSelectBRoll?.({
                              id: `broll-${video.pexelsId}-${broll.timestamp}`,
                              timestampSeconds: broll.timestamp,
                              durationSeconds: Math.min(video.duration || broll.duration, broll.duration),
                              videoUrl: video.url,
                              thumbnailUrl: video.thumbnailUrl,
                              pexelsId: video.pexelsId,
                              searchQuery: broll.searchQuery,
                            })
                          }}
                        >
                          {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} alt={video.title} className="w-full h-16 object-cover" />
                          ) : (
                            <div className="w-full h-16 bg-white/5 flex items-center justify-center">
                              <Film size={14} className="text-white/20" />
                            </div>
                          )}
                          <div className={`absolute inset-0 transition-opacity flex items-center justify-center ${isSelected ? 'bg-emerald-500/30 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'}`}>
                            {isSelected ? (
                              <Check size={16} className="text-emerald-400" />
                            ) : (
                              <Plus size={14} className="text-white" />
                            )}
                          </div>
                          {video.duration > 0 && (
                            <span className="absolute bottom-0.5 right-0.5 text-[8px] font-mono bg-black/70 text-white/70 px-1 rounded">
                              {video.duration}s
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {pexels?.loading && (
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-white/30">
                    <Loader2 size={10} className="animate-spin" /> Recherche Pexels...
                  </div>
                )}
                {pexels && !pexels.loading && pexels.results.length === 0 && (
                  <p className="text-[10px] text-white/20 mt-2">Aucun resultat</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pace Analysis */}
      <SectionHeader
        icon={<Clock size={13} />}
        title="Rythme"
        badge={
          suggestions.paceAnalysis.slowSections.length > 0 ? (
            <span className="text-[10px] text-amber-400">
              {suggestions.paceAnalysis.slowSections.length} section{suggestions.paceAnalysis.slowSections.length > 1 ? 's' : ''} lente{suggestions.paceAnalysis.slowSections.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-[10px] text-emerald-400">Bon rythme</span>
          )
        }
        expanded={expandedSection === 'pace'}
        onToggle={() => toggleSection('pace')}
      />
      {expandedSection === 'pace' && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-[10px] text-white/30 font-mono">
            Duree moyenne par phrase : {suggestions.paceAnalysis.averageSentenceDuration.toFixed(1)}s
          </p>
          {suggestions.paceAnalysis.slowSections.length === 0 ? (
            <p className="text-xs text-emerald-400/60">Le rythme est bon, pas de sections a accelerer.</p>
          ) : (
            suggestions.paceAnalysis.slowSections.map((section, idx) => (
              <div key={idx} className="rounded-lg p-2.5 border border-amber-500/10 bg-amber-500/5">
                <button
                  onClick={() => onSeekTo?.(section.startTime)}
                  className="text-[10px] font-mono text-amber-400 hover:text-amber-300 transition-colors"
                >
                  ▶ {formatTime(section.startTime)} → {formatTime(section.endTime)}
                </button>
                <p className="text-xs text-white/50 mt-1">{section.suggestion}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Subtitle Highlights */}
      <SectionHeader
        icon={<Type size={13} />}
        title="Mots-cles"
        badge={<span className="text-[10px] text-white/30">{suggestions.subtitleHighlights.length}</span>}
        expanded={expandedSection === 'subtitles'}
        onToggle={() => toggleSection('subtitles')}
      />
      {expandedSection === 'subtitles' && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.subtitleHighlights.map((h, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border border-white/10"
                style={{ background: accentColor + '15', color: accentColor }}
                title={h.reason}
              >
                {h.word}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-white/25 mt-2 font-mono">
            Survole un mot pour voir pourquoi il est suggere
          </p>
        </div>
      )}
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  badge,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
    >
      <span className="text-white/40">{icon}</span>
      <span className="text-xs font-bold text-white/70 flex-1 text-left">{title}</span>
      {badge}
      {expanded ? (
        <ChevronUp size={12} className="text-white/20" />
      ) : (
        <ChevronDown size={12} className="text-white/20" />
      )}
    </button>
  )
}
