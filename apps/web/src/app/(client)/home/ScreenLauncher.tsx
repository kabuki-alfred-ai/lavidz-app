'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { T, FULL_H, TOP_SAFE } from './constants'
import { KabouAvatar } from './KabouAvatar'
import type { KabouProposal, ContentFormat } from './types'
import type { RecordingScript } from '@/lib/recording-script'
import { recordingScriptHasSubstance } from '@/lib/recording-script'

type LauncherPhase = 'q1' | 'q2' | 'q3' | 'format' | 'script'

const QS: Record<'q1' | 'q2' | 'q3', { label: string; placeholder: string }> = {
  q1: {
    label: "Quelle est l'anecdote ou le fait concret derrière ce sujet ?",
    placeholder: 'Ex : Un client m\'a dit que…',
  },
  q2: {
    label: 'Quel est le résultat ou la leçon clé ?',
    placeholder: 'Ex : Depuis, j\'ai réalisé que…',
  },
  q3: {
    label: 'Pour qui est ce contenu ? Quel problème ça résout ?',
    placeholder: 'Ex : Pour les freelances qui…',
  },
}

const FORMATS: Array<{ format: ContentFormat; emoji: string; label: string; description: string }> = [
  { format: 'STORYTELLING',   emoji: '📖', label: 'Histoire',           description: 'Raconte une histoire avec rebondissements' },
  { format: 'HOT_TAKE',       emoji: '🔥', label: 'Prise de position',  description: 'Un angle fort qui crée la discussion' },
  { format: 'QUESTION_BOX',   emoji: '❓', label: 'Questions-Réponses', description: 'Réponds à des questions concrètes' },
  { format: 'DAILY_TIP',      emoji: '💡', label: 'Conseil du jour',    description: 'Un conseil actionnable et direct' },
  { format: 'MYTH_VS_REALITY', emoji: '🪞', label: 'Mythe vs Réalité',  description: 'Démonte un mythe dans ton domaine' },
  { format: 'TELEPROMPTER',   emoji: '📜', label: 'Téléprompteur',      description: 'Un texte complet à lire à la caméra' },
]

const LOADING_TEXTS = ['Kabou analyse…', 'Kabou structure…', 'Kabou peaufine…', 'Presque prêt…']

const BEAT_LABELS: Record<string, string> = {
  setup: 'Mise en situation', tension: 'Tension', climax: 'Point fort', resolution: 'Résolution',
}

function getScriptSections(script: RecordingScript): Array<{ key: string; title: string; content: string }> {
  switch (script.kind) {
    case 'storytelling':
      return script.beats.map(b => ({ key: b.label, title: BEAT_LABELS[b.label] ?? b.label, content: b.text }))
    case 'hot_take':
      return [
        { key: 'thesis', title: 'Thèse', content: script.thesis },
        ...script.arguments.map((a, i) => ({ key: `arg${i}`, title: `Argument ${i + 1}`, content: a })),
        { key: 'punchline', title: 'Punchline', content: script.punchline },
      ]
    case 'qa':
      return script.items.flatMap((item, i) => [
        { key: `q${i}`, title: `Question ${i + 1}`, content: item.question },
        { key: `kp${i}`, title: 'Points clés', content: item.keyPoints.join('\n') },
      ])
    case 'daily_tip':
      return [
        { key: 'problem', title: 'Problème', content: script.problem },
        { key: 'tip', title: 'Conseil', content: script.tip },
        { key: 'application', title: 'Application', content: script.application },
      ]
    case 'myth_vs_reality':
      return script.pairs.flatMap((pair, i) => [
        { key: `myth${i}`, title: `Mythe ${i + 1}`, content: pair.myth },
        { key: `reality${i}`, title: `Réalité ${i + 1}`, content: pair.reality },
      ])
    case 'teleprompter':
      return [{ key: 'script', title: 'Script complet', content: script.script }]
    default:
      return []
  }
}

function QuestionPhase({ q, value, onChange, nextLabel, onNext }: {
  q: { label: string; placeholder: string }
  value: string
  onChange: (v: string) => void
  nextLabel: string
  onNext: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.4, marginBottom: 20 }}>
        {q.label}
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={q.placeholder}
        rows={4}
        style={{
          width: '100%', padding: 14, fontSize: 14, lineHeight: 1.55,
          background: T.surface, border: `2px solid ${T.border}`, borderRadius: 14,
          color: T.ink, resize: 'none' as const, boxSizing: 'border-box' as const,
          fontFamily: 'inherit', outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = T.primary }}
        onBlur={e => { e.target.style.borderColor = T.border }}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && value.trim()) onNext() }}
      />
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onNext}
        disabled={!value.trim()}
        style={{
          background: value.trim() ? T.primary : 'rgba(0,0,0,0.08)',
          color: value.trim() ? '#fff' : T.muted,
          border: 'none', borderRadius: 16, padding: 17,
          fontSize: 15, fontWeight: 700,
          cursor: value.trim() ? 'pointer' : 'default',
          transition: 'background 0.15s, color 0.15s',
          boxShadow: value.trim() ? `0 10px 28px ${T.primary}50` : 'none',
        }}
      >
        {nextLabel}
      </button>
    </div>
  )
}

export function ScreenLauncher({
  proposal, saving, error,
  onFilmer, onBack,
}: {
  proposal: KabouProposal
  saving: boolean
  error: string | null
  onFilmer: (script: RecordingScript, format: ContentFormat) => void
  onBack: () => void
}) {
  const [phase, setPhase] = useState<LauncherPhase>('q1')
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward')
  const [a1, setA1] = useState('')
  const [a2, setA2] = useState('')
  const [a3, setA3] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<ContentFormat>(proposal.contentFormat)
  const [script, setScript] = useState<RecordingScript | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState(LOADING_TEXTS[0])
  const [expanded, setExpanded] = useState<string | null>(null)

  const scriptCache = useRef<Map<ContentFormat, RecordingScript>>(new Map())
  const abortRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    abortRef.current?.abort()
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  useEffect(() => {
    if (script) {
      const sections = getScriptSections(script)
      setExpanded(sections[0]?.key ?? null)
    }
  }, [script])

  const go = useCallback((to: LauncherPhase, dir: 'forward' | 'back') => {
    setSlideDir(dir)
    setPhase(to)
  }, [])

  const generateScript = useCallback(async (format: ContentFormat) => {
    const cached = scriptCache.current.get(format)
    if (cached) {
      setScript(cached)
      setSelectedFormat(format)
      go('script', 'forward')
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setSelectedFormat(format)
    setScript(null)
    setLoading(true)
    setLoadingText(LOADING_TEXTS[0])
    go('script', 'forward')

    let i = 0
    intervalRef.current = setInterval(() => {
      i = (i + 1) % LOADING_TEXTS.length
      setLoadingText(LOADING_TEXTS[i])
    }, 1400)

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: ctrl.signal,
        body: JSON.stringify({ answers: { a1, a2, a3 }, format, proposalContext: proposal }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      scriptCache.current.set(format, data.script)
      setScript(data.script)
    } catch (err: any) {
      if (err.name !== 'AbortError') go('format', 'back')
    } finally {
      // Only update loading state if this controller is still active (not superseded by a newer call)
      if (abortRef.current === ctrl) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setLoading(false)
      }
    }
  }, [a1, a2, a3, proposal, go])

  const handleBack = () => {
    if (phase === 'q1') {
      onBack()
    } else if (phase === 'q2') {
      scriptCache.current.clear()
      go('q1', 'back')
    } else if (phase === 'q3') {
      scriptCache.current.clear()
      go('q2', 'back')
    } else if (phase === 'format') {
      go('q3', 'back')
    } else if (phase === 'script') {
      abortRef.current?.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
      setLoading(false)
      go('format', 'back')
    }
  }

  const currentQ = phase === 'q1' || phase === 'q2' || phase === 'q3' ? phase : null
  const currentVal = phase === 'q1' ? a1 : phase === 'q2' ? a2 : phase === 'q3' ? a3 : ''
  const setCurrentVal = phase === 'q1' ? setA1 : phase === 'q2' ? setA2 : setA3
  const qProgress = phase === 'q1' ? 1 : phase === 'q2' ? 2 : phase === 'q3' ? 3 : null

  const formatMeta = FORMATS.find(f => f.format === selectedFormat)

  return (
    <div style={{ background: T.bg, minHeight: FULL_H, display: 'flex', flexDirection: 'column', paddingTop: TOP_SAFE, boxSizing: 'border-box' }}>
      <style>{`
        @keyframes slideFromRight { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromLeft  { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes kabouDot { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 18, marginBottom: 20 }}>
        <button
          onClick={handleBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 24, padding: '4px 8px', lineHeight: 1 }}
        >
          ‹
        </button>
        <KabouAvatar size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Kabou</div>
          <div style={{ fontSize: 11, color: T.muted }}>approfondissons ton sujet</div>
        </div>
        {qProgress && (
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{qProgress} / 3</div>
        )}
      </div>

      {/* Animated phase container */}
      <div
        key={phase}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          animation: `${slideDir === 'forward' ? 'slideFromRight' : 'slideFromLeft'} 0.22s ease`,
          paddingLeft: 18, paddingRight: 18, paddingBottom: 24,
        }}
      >
        {/* QUESTION PHASES */}
        {currentQ && (
          <QuestionPhase
            q={QS[currentQ]}
            value={currentVal}
            onChange={setCurrentVal}
            nextLabel={phase === 'q3' ? 'Voir les formats →' : 'Suivant →'}
            onNext={() => {
              if (phase === 'q1') go('q2', 'forward')
              else if (phase === 'q2') go('q3', 'forward')
              else go('format', 'forward')
            }}
          />
        )}

        {/* FORMAT PHASE */}
        {phase === 'format' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Quel format ?</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>
              Kabou recommande <b>{FORMATS.find(f => f.format === proposal.contentFormat)?.label}</b>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
              {FORMATS.map(f => {
                const isRec = f.format === proposal.contentFormat
                return (
                  <button
                    key={f.format}
                    type="button"
                    onClick={() => generateScript(f.format)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      background: T.surface, border: `2px solid ${isRec ? T.primary : T.border}`,
                      borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{f.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {f.label}
                        {isRec && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: T.primary, background: '#FFF0E8', borderRadius: 999, padding: '2px 7px' }}>
                            Recommandé
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{f.description}</div>
                    </div>
                    <span style={{ color: T.muted, fontSize: 16 }}>›</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* SCRIPT PHASE */}
        {phase === 'script' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <KabouAvatar size={48} ring />
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: T.primary,
                      animation: `kabouDot 1.2s ease-in-out infinite`,
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 14, color: T.muted, fontWeight: 500 }}>{loadingText}</div>
              </div>
            ) : script ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 10 }}>
                  {formatMeta?.emoji} {formatMeta?.label}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {getScriptSections(script).map(section => {
                    const isOpen = expanded === section.key
                    return (
                      <div
                        key={section.key}
                        style={{
                          background: T.surface, borderRadius: 14,
                          border: `2px solid ${isOpen ? T.primary : T.border}`,
                          overflow: 'hidden', transition: 'border-color 0.15s',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : section.key)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 700, color: isOpen ? T.primary : T.ink }}>
                            {section.title}
                          </span>
                          <span style={{ color: T.muted, fontSize: 12 }}>{isOpen ? '▼' : '▶'}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0 14px 14px', fontSize: 13, color: T.ink, lineHeight: 1.55, whiteSpace: 'pre-line' as const }}>
                            {section.content || (
                              <span style={{ color: T.muted, fontStyle: 'italic' }}>À compléter…</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {error && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
                      {error}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onFilmer(script, selectedFormat)}
                    disabled={saving || !recordingScriptHasSubstance(script)}
                    style={{
                      background: T.primary, color: '#fff', border: 'none', borderRadius: 16,
                      padding: 17, fontSize: 15, fontWeight: 700,
                      cursor: (saving || !recordingScriptHasSubstance(script)) ? 'default' : 'pointer',
                      boxShadow: `0 10px 28px ${T.primary}50`,
                      opacity: (saving || !recordingScriptHasSubstance(script)) ? 0.5 : 1,
                    }}
                  >
                    {saving ? '…' : recordingScriptHasSubstance(script) ? 'Commencer à filmer →' : 'Script vide — réessaie'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
