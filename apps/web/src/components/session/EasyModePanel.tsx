'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Scissors, Type, Film, Sparkles, Loader2,
  Check, X, Smile, ZoomIn, RefreshCw, Captions as CaptionsIcon,
  Play, Eye, Volume2, Trash2, ChevronDown, ChevronUp,
  ArrowLeft, Clock, Layers, Settings, ChevronRight,
} from 'lucide-react'
import { type EnergyLevel } from '@/lib/easy-mode-presets'
import { CaptionEditor } from './CaptionEditor'
import { EasyModeSlideEditor } from './modules/EasyModeSlideEditor'
import type { SoundLibraryItem } from './modules/BookendsModule'
import type { SubtitleSettings } from '@/remotion/subtitleTypes'
import type { AudioSettings, MotionSettings, BRollItem, IntroSettings, OutroSettings, TransitionTheme } from '@/remotion/themeTypes'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface BRollSuggestion {
  timestamp: number
  duration: number
  searchQuery: string
  reason: string
  results?: { url: string; thumbnailUrl: string; title: string; pexelsId: string; duration: number }[]
}

export interface EasyModePanelProps {
  energyLevel: EnergyLevel
  silenceCutEnabled: boolean
  silenceCutDone: boolean
  silenceRemovedSec: number
  brandKitApplied: boolean
  subtitleSettings: SubtitleSettings
  audioSettings: AudioSettings
  motionSettings: MotionSettings
  coldOpenEnabled: boolean
  coldOpenPhrase: string | null
  coldOpenCandidates: Array<{ hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string; angle?: string; why?: string }>
  coldOpenSelectedPhrase: string | null
  coldOpenLoading: boolean
  onSelectColdOpenCandidate: (idx: number) => void
  onRegenerateColdOpen: () => void
  bRollSuggestions: BRollSuggestion[]
  bRollItems: BRollItem[]
  autoApplying: boolean
  format: string
  animatedEmojis: boolean
  inlaysEnabled: boolean
  regenerating: boolean
  ready: boolean
  onEnergyChange: (level: EnergyLevel) => void
  onSubtitleStyleChange: (style: string) => void
  onMusicChange: (mood: string) => void
  onColdOpenToggle: () => void
  onBRollSelect: (sugIndex: number, resultIndex: number) => void
  onBRollRemove: (sugIndex: number) => void
  onFormatChange: (format: string) => void
  onMotionToggle: (key: keyof MotionSettings) => void
  onTransitionChange: (style: string) => void
  onAnimatedEmojisToggle: () => void
  onInlaysToggle: () => void
  onApplyChanges: () => void
  onRunAiSuggestions: () => void
  cleanAudioEnabled: boolean
  onCleanAudioToggle: () => void
  onSilenceCutToggle?: () => void
  onBRollsAutoToggle?: () => void
  badTakesEnabled?: boolean
  badTakesRemovedCount?: number
  onBadTakesToggle?: () => void
  onBRollReplace?: (itemId: string, replacement: Partial<BRollItem>) => void
  onBRollReAsk?: (itemId: string) => Promise<void>
  onBRollAddAtTime?: (timestampSec: number, durationSec: number, data: Partial<BRollItem>) => void
  // Caption editor
  wordsByRecording: Record<string, import('@/remotion/themeTypes').WordTimestamp[]>
  recordingsList: { id: string; questionText: string }[]
  onSubtitleSettingsPartial: (partial: Partial<SubtitleSettings>) => void
  onWordEdit: (recordingId: string, wordIndex: number, newWord: string) => void
  onSeek?: (recordingId: string, timeSec: number) => void
  onDeleteWord?: (recordingId: string, wordIndex: number) => void
  onAddWord?: (recordingId: string, afterWordIndex: number) => void
  onDeleteChunk?: (recordingId: string, startIdx: number, endIdx: number) => void
  getActiveRecordingTime?: () => { recordingId: string; timeSec: number } | null
  wordEmojisBySegmentId?: Record<string, { word: string; emoji: string }[]>
  onEmojiSet?: (recordingId: string, word: string, emoji: string) => void
  onEmojiRemove?: (recordingId: string, word: string) => void
  // Trim state (lifted to parent so timeline can be rendered outside)
  trimSelected: Record<string, Set<number>>
  setTrimSelected: React.Dispatch<React.SetStateAction<Record<string, Set<number>>>>
  trimDeleted: Set<string>
  setTrimDeleted: React.Dispatch<React.SetStateAction<Set<string>>>
  onEditSubViewChange?: (v: 'none' | 'captions' | 'scenes' | 'trim') => void
  // Hook editor (cold-open inline edition)
  coldOpenStart?: number
  coldOpenEnd?: number
  coldOpenFontSize?: number
  coldOpenTextPosition?: 'top' | 'center' | 'bottom'
  coldOpenTextColor?: string
  onColdOpenPhraseChange?: (newPhrase: string) => void
  onColdOpenFontSizeChange?: (size: number) => void
  onColdOpenTextPositionChange?: (pos: 'top' | 'center' | 'bottom') => void
  onColdOpenTextColorChange?: (color: string) => void
  onColdOpenDurationChange?: (durationSeconds: number) => void
  // Intro / Outro slides (exposed in Edit Scenes + Expert panel)
  intro: IntroSettings
  setIntro: React.Dispatch<React.SetStateAction<IntroSettings>>
  outro: OutroSettings
  setOutro: React.Dispatch<React.SetStateAction<OutroSettings>>
  theme: TransitionTheme
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>
  soundLibrary: SoundLibraryItem[]
  soundPreviewAudioRef: React.MutableRefObject<HTMLAudioElement | null>
  // B-roll AI dropdown
  onBRollsAutoApply?: (percent: number) => Promise<void>
  onBRollsClear?: () => void
  // Intro hook suggestions (AI)
  onRequestIntroHookSuggestions?: () => Promise<string[]>
  // Brand kit auto-apply for intro/outro slides
  onApplyBrandKitToSlide?: (target: 'intro' | 'outro') => Promise<{ ok: boolean; message?: string }>
}

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */

const C = {
  accent: '#FF4D1C',
  accentBg: 'rgba(255,77,28,0.06)',
  text: '#111827',
  textSec: '#6B7280',
  textDim: '#9CA3AF',
  border: '#F3F4F6',
  surface: '#F9FAFB',
  bg: '#FFFFFF',
  toggle: { on: '#FF4D1C', off: '#E5E7EB' },
  blue: '#3B82F6',
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
      background: on ? C.toggle.on : C.toggle.off, transition: 'background 0.2s',
      position: 'relative', flexShrink: 0, padding: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: on ? 20 : 2,
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }} />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Feature row (main Submagic pattern)                                  */
/* ------------------------------------------------------------------ */

function Feature({
  icon, title, desc, on, onToggle, editLabel, onEdit, editLabel2, onEdit2,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  on: boolean
  onToggle: () => void
  editLabel?: string
  onEdit?: () => void
  editLabel2?: string
  onEdit2?: () => void
}) {
  const editButtonStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: C.text, background: 'none',
    border: 'none', cursor: 'pointer', flexShrink: 0, textDecoration: 'underline',
    textDecorationColor: C.border, textUnderlineOffset: 2,
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 0',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: C.surface, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0, lineHeight: 1.2 }}>{title}</p>
        <p style={{ fontSize: 12, color: C.textDim, margin: '2px 0 0', lineHeight: 1.3 }}>{desc}</p>
      </div>
      {editLabel && onEdit && (
        <button onClick={onEdit} style={editButtonStyle}>
          {editLabel}
        </button>
      )}
      {editLabel2 && onEdit2 && (
        <button onClick={onEdit2} style={editButtonStyle}>
          {editLabel2}
        </button>
      )}
      <Toggle on={on} onClick={onToggle} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cold open feature (AI Hook Title with 3 candidates)                 */
/* ------------------------------------------------------------------ */

const ANGLE_LABELS: Record<string, { label: string; color: string }> = {
  chiffre: { label: 'Chiffre', color: '#10B981' },
  aveu: { label: 'Aveu', color: '#EF4444' },
  contradiction: { label: 'Contradiction', color: '#F59E0B' },
  promesse: { label: 'Promesse', color: '#3B82F6' },
  punchline: { label: 'Punchline', color: '#A855F7' },
}

function ColdOpenFeature({
  coldOpenEnabled, coldOpenLoading, coldOpenCandidates, coldOpenSelectedPhrase,
  onToggle, onSelect, onRegenerate,
}: {
  coldOpenEnabled: boolean
  coldOpenLoading: boolean
  coldOpenCandidates: Array<{ hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string; angle?: string; why?: string }>
  coldOpenSelectedPhrase: string | null
  onToggle: () => void
  onSelect: (idx: number) => void
  onRegenerate: () => void
}) {
  const [open, setOpen] = useState(false)
  const hasCandidates = coldOpenCandidates.length > 0
  const showPicker = open || (hasCandidates && !coldOpenSelectedPhrase)
  const desc = coldOpenLoading
    ? 'Génération de 3 propositions...'
    : coldOpenSelectedPhrase
      ? `"${coldOpenSelectedPhrase.slice(0, 50)}${coldOpenSelectedPhrase.length > 50 ? '...' : ''}"`
      : hasCandidates
        ? `${coldOpenCandidates.length} propositions prêtes`
        : 'Générer 3 accroches et choisir la meilleure'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: C.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {coldOpenLoading
            ? <Loader2 size={18} style={{ color: C.accent, animation: 'spin 1s linear infinite' }} />
            : <Sparkles size={18} color={C.textSec} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0, lineHeight: 1.2 }}>
            AI Hook Title
          </p>
          <p style={{ fontSize: 12, color: C.textDim, margin: '2px 0 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {desc}
          </p>
        </div>
        {hasCandidates && !coldOpenLoading && (
          <button onClick={() => setOpen(o => !o)} style={{
            fontSize: 12, fontWeight: 600, color: C.text, background: 'none',
            border: 'none', cursor: 'pointer', flexShrink: 0, textDecoration: 'underline',
            textDecorationColor: C.border, textUnderlineOffset: 2,
          }}>
            {showPicker ? 'Fermer' : 'Choisir'}
          </button>
        )}
        {!hasCandidates && !coldOpenLoading && (
          <button onClick={onRegenerate} style={{
            fontSize: 12, fontWeight: 600, color: C.text, background: 'none',
            border: 'none', cursor: 'pointer', flexShrink: 0, textDecoration: 'underline',
            textDecorationColor: C.border, textUnderlineOffset: 2,
          }}>
            Générer
          </button>
        )}
        <Toggle on={coldOpenEnabled} onClick={onToggle} />
      </div>

      {coldOpenLoading && (
        <div style={{
          padding: '18px 0 22px 54px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Loader2 size={14} style={{ color: C.accent, animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 12, color: C.textSec }}>
            Analyse du transcript et génération des hooks...
          </span>
        </div>
      )}

      {showPicker && !coldOpenLoading && hasCandidates && (
        <div style={{ padding: '6px 0 14px 54px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {coldOpenCandidates.map((c, i) => {
            const selected = c.hookPhrase === coldOpenSelectedPhrase
            const angle = c.angle ? ANGLE_LABELS[c.angle] : null
            const duration = Math.max(0, c.endInSeconds - c.startInSeconds)
            return (
              <button
                key={`${c.hookPhrase}-${i}`}
                onClick={() => onSelect(i)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                  background: selected ? C.accentBg : C.surface,
                  border: `1.5px solid ${selected ? C.accent : C.border}`,
                  cursor: 'pointer', transition: 'all 0.15s', width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: C.textDim,
                    letterSpacing: '0.04em',
                  }}>
                    #{i + 1}
                  </span>
                  {angle && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px',
                      borderRadius: 6, background: angle.color + '15', color: angle.color,
                      letterSpacing: '0.02em',
                    }}>
                      {angle.label}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>
                    {duration.toFixed(1)}s
                  </span>
                  {selected && (
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: C.accent, fontSize: 11, fontWeight: 700 }}>
                      <Check size={12} /> Sélectionné
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.35, fontWeight: 500 }}>
                  &ldquo;{c.hookPhrase}&rdquo;
                </p>
                {c.why && (
                  <p style={{ fontSize: 11, color: C.textDim, margin: '4px 0 0', lineHeight: 1.3 }}>
                    {c.why}
                  </p>
                )}
              </button>
            )
          })}
          <button
            onClick={onRegenerate}
            style={{
              alignSelf: 'flex-start', marginTop: 4,
              padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: C.surface, color: C.textSec, border: `1px solid ${C.border}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <RefreshCw size={10} /> Régénérer 3 nouvelles propositions
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Hook editor (Submagic-style)                                        */
/* ------------------------------------------------------------------ */

function HookEditor({
  phrase, durationSec, fontSize, position, textColor, loading,
  onPhraseChange, onFontSizeChange, onPositionChange, onTextColorChange, onDurationChange,
  onRegenerate, onDelete,
}: {
  phrase: string
  durationSec: number
  fontSize: number
  position: 'top' | 'center' | 'bottom'
  textColor: string
  loading: boolean
  onPhraseChange: (newPhrase: string) => void
  onFontSizeChange: (size: number) => void
  onPositionChange: (pos: 'top' | 'center' | 'bottom') => void
  onTextColorChange: (color: string) => void
  onDurationChange: (sec: number) => void
  onRegenerate: () => void
  onDelete: () => void
}) {
  const words = phrase.split(/\s+/).filter(Boolean)

  const updateWord = (idx: number, value: string) => {
    const next = [...words]
    next[idx] = value
    onPhraseChange(next.join(' '))
  }

  return (
    <div style={{
      padding: 14, borderRadius: 12, border: `1px solid ${C.border}`,
      background: C.bg, marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={14} color={C.accent} />
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>
          Hook Title
        </p>
        <button
          onClick={onRegenerate}
          disabled={loading}
          title="Régénérer"
          style={{
            width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`,
            background: C.surface, color: C.textSec, cursor: loading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
        </button>
        <button
          onClick={onDelete}
          title="Supprimer le hook"
          style={{
            width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`,
            background: C.surface, color: '#EF4444', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Editable words */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14, minHeight: 32 }}>
        {words.length === 0 ? (
          <p style={{ fontSize: 12, color: C.textDim, margin: 0 }}>Aucun hook généré</p>
        ) : (
          words.map((w, i) => (
            <span
              key={i}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateWord(i, e.currentTarget.innerText.trim() || w)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              style={{
                padding: '4px 8px', borderRadius: 6, background: C.surface,
                border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600,
                color: C.text, outline: 'none', cursor: 'text', userSelect: 'text',
                minWidth: 16, display: 'inline-block',
              }}
            >
              {w}
            </span>
          ))
        )}
      </div>

      {/* Position */}
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: C.textSec, margin: '0 0 4px' }}>Position Y</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['top', 'center', 'bottom'] as const).map(p => (
            <button
              key={p}
              onClick={() => onPositionChange(p)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
                border: position === p ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                background: position === p ? C.accentBg : C.bg,
                color: position === p ? C.accent : C.textSec,
              }}
            >
              {p === 'top' ? 'Haut' : p === 'center' ? 'Centre' : 'Bas'}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec, minWidth: 48 }}>Taille</span>
        <input
          type="range" min={32} max={120} step={2}
          value={fontSize}
          onChange={e => onFontSizeChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: C.accent }}
        />
        <span style={{ fontSize: 11, color: C.textDim, minWidth: 36, textAlign: 'right' }}>
          {fontSize}px
        </span>
      </div>

      {/* Duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec, minWidth: 48 }}>Durée</span>
        <input
          type="range" min={1} max={6} step={0.5}
          value={Math.min(6, Math.max(1, durationSec))}
          onChange={e => onDurationChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: C.accent }}
        />
        <span style={{ fontSize: 11, color: C.textDim, minWidth: 36, textAlign: 'right' }}>
          {durationSec.toFixed(1)}s
        </span>
      </div>

      {/* Text color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec, minWidth: 48 }}>Couleur</span>
        <input
          type="color"
          value={textColor}
          onChange={e => onTextColorChange(e.target.value)}
          style={{ width: 32, height: 28, padding: 0, borderRadius: 6, border: `1px solid ${C.border}`, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{textColor.toUpperCase()}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section header                                                      */
/* ------------------------------------------------------------------ */

function Section({ title }: { title: string }) {
  return (
    <p style={{
      fontSize: 12, fontWeight: 700, color: C.textSec,
      margin: '24px 0 4px', padding: 0, letterSpacing: '0.01em',
    }}>
      {title}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Divider                                                             */
/* ------------------------------------------------------------------ */

function Divider() {
  return <div style={{ height: 1, background: C.border }} />
}

/* ------------------------------------------------------------------ */
/* Expandable background music picker                                  */
/* ------------------------------------------------------------------ */

export function BgMusicPicker({
  soundLibrary, selectedId, volume,
  onSelect, onVolumeChange, previewRef,
}: {
  soundLibrary: { id: string; name: string; tag: string; signedUrl: string }[]
  selectedId: string | null
  volume: number
  onSelect: (id: string | null) => void
  onVolumeChange: (v: number) => void
  previewRef: React.MutableRefObject<HTMLAudioElement | null>
}) {
  const bgSounds = soundLibrary.filter(s => s.tag === 'BACKGROUND')

  const playPreview = (url: string) => {
    if (previewRef.current) { previewRef.current.pause(); previewRef.current = null }
    const a = new Audio(url)
    previewRef.current = a
    a.onended = () => { previewRef.current = null }
    a.play().catch(() => {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bgSounds.length === 0 ? (
        <p style={{ fontSize: 11, color: C.textDim, margin: 0 }}>
          Aucun son "Background" dans la bibliothèque.
        </p>
      ) : (
        <>
          <button
            onClick={() => onSelect(null)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              border: selectedId === null ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
              background: selectedId === null ? C.accentBg : C.bg,
              color: selectedId === null ? C.accent : C.textSec,
              fontSize: 12, fontWeight: 500,
            }}
          >
            <span>Aucune musique</span>
            {selectedId === null && <span style={{ fontSize: 10 }}>actif</span>}
          </button>
          {bgSounds.map(s => {
            const isActive = selectedId === s.id
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => onSelect(isActive ? null : s.id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: isActive ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                    background: isActive ? C.accentBg : C.bg,
                    color: isActive ? C.accent : C.text,
                    fontSize: 12, fontWeight: 500,
                  }}
                >
                  <span>{s.name}</span>
                  {isActive && <span style={{ fontSize: 10 }}>actif</span>}
                </button>
                <button
                  onClick={() => playPreview(s.signedUrl)}
                  title="Écouter"
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.surface, color: C.textSec, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <Play size={12} />
                </button>
              </div>
            )
          })}
          {selectedId !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: C.textSec, minWidth: 48 }}>Volume</span>
              <input
                type="range" min={0} max={100} step={5}
                value={Math.round(volume * 100)}
                onChange={e => onVolumeChange(Number(e.target.value) / 100)}
                style={{ flex: 1, accentColor: C.accent }}
              />
              <span style={{ fontSize: 11, color: C.textDim, minWidth: 36, textAlign: 'right' }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Top tabs                                                            */
/* ------------------------------------------------------------------ */

type Tab = 'edit' | 'ai-boost' | 'ai-tools'

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'edit', label: 'Edit' },
    { id: 'ai-boost', label: 'AI Boost' },
    { id: 'ai-tools', label: 'AI Tools' },
  ]
  return (
    <div style={{
      display: 'flex', gap: 2, background: C.surface, borderRadius: 10,
      padding: 3, marginBottom: 20,
    }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 8,
            fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            transition: 'all 0.15s',
            background: active === t.id ? C.bg : 'transparent',
            color: active === t.id ? C.text : C.textDim,
            boxShadow: active === t.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Edit card (3-card grid)                                             */
/* ------------------------------------------------------------------ */

function EditCard({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '18px 8px', borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${C.border}`, background: C.surface, color: C.text,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.borderColor = '#D1D5DB' }}
      onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.border }}
    >
      {icon}
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-view header with back button                                    */
/* ------------------------------------------------------------------ */

function SubViewHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
    }}>
      <button
        onClick={onBack}
        style={{
          width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
          background: C.surface, color: C.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ArrowLeft size={14} />
      </button>
      <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{title}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Scene editor (B-roll per timestamp)                                 */
/* ------------------------------------------------------------------ */

function SceneEditor({
  recordings, wordsByRecording, subtitleSettings,
  bRollSuggestions, bRollItems,
  onBack, onRunAiSuggestions, onBRollSelect, onBRollRemove, onSeek, getActiveRecordingTime,
  onBRollReplace, onBRollReAsk, onBRollAddAtTime,
  intro, setIntro, outro, setOutro, theme,
  audioSettings, setAudioSettings,
  soundLibrary, soundPreviewAudioRef,
  motionSettings, onTransitionChange,
  onBRollsAutoApply, onBRollsClear,
  onRequestIntroHookSuggestions,
  onApplyBrandKitToSlide,
}: {
  recordings: { id: string; questionText: string }[]
  wordsByRecording: Record<string, import('@/remotion/themeTypes').WordTimestamp[]>
  subtitleSettings: SubtitleSettings
  bRollSuggestions: BRollSuggestion[]
  bRollItems: BRollItem[]
  onBack: () => void
  onRunAiSuggestions: () => void
  onBRollSelect: (sugIdx: number, resIdx: number) => void
  onBRollRemove: (sugIdx: number) => void
  onSeek?: (recordingId: string, timeSec: number) => void
  getActiveRecordingTime?: () => { recordingId: string; timeSec: number } | null
  onBRollReplace?: (itemId: string, replacement: Partial<BRollItem>) => void
  onBRollReAsk?: (itemId: string) => Promise<void>
  onBRollAddAtTime?: (timestampSec: number, durationSec: number, data: Partial<BRollItem>) => void
  intro: IntroSettings
  setIntro: React.Dispatch<React.SetStateAction<IntroSettings>>
  outro: OutroSettings
  setOutro: React.Dispatch<React.SetStateAction<OutroSettings>>
  theme: TransitionTheme
  audioSettings: AudioSettings
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>
  soundLibrary: SoundLibraryItem[]
  soundPreviewAudioRef: React.MutableRefObject<HTMLAudioElement | null>
  motionSettings: MotionSettings
  onTransitionChange: (style: string) => void
  onBRollsAutoApply?: (percent: number) => Promise<void>
  onBRollsClear?: () => void
  onRequestIntroHookSuggestions?: () => Promise<string[]>
  onApplyBrandKitToSlide?: (target: 'intro' | 'outro') => Promise<{ ok: boolean; message?: string }>
}) {
  const [openActions, setOpenActions] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [reAsking, setReAsking] = useState<string | null>(null)
  const [introExpanded, setIntroExpanded] = useState(false)
  const [outroExpanded, setOutroExpanded] = useState(false)

  // B-roll AI dropdown state
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [bRollPercent, setBRollPercent] = useState(50)
  const [videoTypeOpen, setVideoTypeOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [searchError, setSearchError] = useState<string | null>(null)

  const doSearch = async (itemId: string, query: string) => {
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/admin/broll/search?q=${encodeURIComponent(query)}&perPage=8`, { credentials: 'include' })
      if (!res.ok) {
        const text = await res.text()
        setSearchError(`Erreur ${res.status}: ${text.slice(0, 100)}`)
        setSearchResults([])
        return
      }
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) {
        setSearchError('Aucun resultat (cle PEXELS_API_KEY manquante ou requete vide)')
        setSearchResults([])
        return
      }
      setSearchResults(data)
    } catch (e: any) {
      setSearchError(e?.message ?? 'Erreur de recherche')
      setSearchResults([])
    }
    finally { setSearching(false) }
  }

  const uploadFile = async (itemId: string, file: File) => {
    const blobUrl = URL.createObjectURL(file)
    if (onBRollReplace) {
      onBRollReplace(itemId, {
        videoUrl: blobUrl,
        thumbnailUrl: blobUrl,
        pexelsId: undefined,
        searchQuery: file.name,
      })
    }
    setOpenActions(null)
  }

  const slideCardBaseStyle: React.CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: 12, background: C.bg,
    marginBottom: 12, overflow: 'hidden',
  }

  const renderSlideSection = (target: 'intro' | 'outro') => {
    const isIntro = target === 'intro'
    const expanded = isIntro ? introExpanded : outroExpanded
    const setExpanded = isIntro ? setIntroExpanded : setOutroExpanded
    const data = isIntro ? intro : outro
    const setData = (isIntro ? setIntro : setOutro) as React.Dispatch<React.SetStateAction<any>>

    const title = isIntro ? 'Slide intro' : 'Slide outro'
    const subtitle = isIntro
      ? 'Après le hook, avant le contenu'
      : 'Après le contenu, avant le générique Lavidz'
    const summary = isIntro
      ? ((data as IntroSettings).hookText || 'Phrase d\'accroche non définie')
      : ((data as OutroSettings).ctaText || 'CTA non défini')

    return (
      <div style={slideCardBaseStyle}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: C.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Layers size={16} color={C.text} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{title}</p>
            <p style={{ fontSize: 11, color: C.textDim, margin: '2px 0 0' }}>{subtitle}</p>
            {data.enabled && (
              <p style={{ fontSize: 11, color: C.textSec, margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {summary}
              </p>
            )}
          </div>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
            padding: '3px 8px', borderRadius: 6,
            background: data.enabled ? 'rgba(52,211,153,0.12)' : C.surface,
            color: data.enabled ? '#059669' : C.textDim,
          }}>
            {data.enabled ? 'ON' : 'OFF'}
          </span>
          {expanded ? <ChevronUp size={14} color={C.textSec} /> : <ChevronDown size={14} color={C.textSec} />}
        </button>
        {expanded && (
          <div style={{ padding: 14, borderTop: `1px solid ${C.border}` }}>
            <EasyModeSlideEditor
              target={target}
              data={data}
              setData={setData}
              theme={theme}
              audioSettings={audioSettings}
              setAudioSettings={setAudioSettings}
              soundLibrary={soundLibrary}
              soundPreviewAudioRef={soundPreviewAudioRef}
              onRequestHookSuggestions={isIntro ? onRequestIntroHookSuggestions : undefined}
              onApplyBrandKit={onApplyBrandKitToSlide}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <SubViewHeader title="Edit Scenes" onBack={onBack} />

      {/* Intro slide (après le hook, avant le contenu) */}
      {renderSlideSection('intro')}

      {/* AI Auto B-rolls action + settings dropdown */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, position: 'relative' }}>
        <button
          onClick={async () => {
            if (!onBRollsAutoApply) return onRunAiSuggestions()
            setGenerating(true)
            try { await onBRollsAutoApply(bRollPercent) }
            finally { setGenerating(false) }
          }}
          disabled={generating}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none',
            cursor: generating ? 'default' : 'pointer',
            background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {generating ? 'Generation…' : 'AI Auto B-rolls'}
        </button>
        <button
          onClick={() => setAiMenuOpen(o => !o)}
          aria-label="Paramètres AI B-rolls"
          style={{
            padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${C.border}`, background: C.bg, color: C.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Settings size={14} />
        </button>

        {aiMenuOpen && (
          <>
            {/* Overlay to close on outside click */}
            <div
              onClick={() => { setAiMenuOpen(false); setVideoTypeOpen(false) }}
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            />
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              minWidth: 280, background: C.bg,
              border: `1px solid ${C.border}`, borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)', padding: 6, zIndex: 50,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px 4px', margin: 0 }}>
                AI Auto B-rolls
              </p>

              {/* Percent slider */}
              <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={14} color={C.textSec} />
                <span style={{ fontSize: 12, color: C.text, flex: 1 }}>Percent of B-rolls</span>
                <input
                  type="range" min={0} max={100} step={5}
                  value={bRollPercent}
                  onChange={(e) => setBRollPercent(Number(e.target.value))}
                  style={{ width: 90, accentColor: C.accent }}
                />
                <span style={{ fontSize: 11, fontWeight: 600, color: C.text, width: 34, textAlign: 'right' }}>
                  {bRollPercent}%
                </span>
              </div>

              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />

              {/* Video Type (submenu) */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setVideoTypeOpen(o => !o)}
                  style={{
                    width: '100%', padding: '10px 12px', background: 'transparent',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 12, color: C.text,
                  }}
                >
                  <span style={{ flex: 1, textAlign: 'left' }}>Video Type</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>Pexels</span>
                  <ChevronRight size={14} color={C.textDim} />
                </button>
                {videoTypeOpen && (
                  <div style={{
                    position: 'absolute', top: 0, right: 'calc(100% + 6px)',
                    minWidth: 160, background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4,
                  }}>
                    <div style={{
                      padding: '8px 12px', fontSize: 12, color: C.text,
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: C.surface, borderRadius: 6,
                    }}>
                      <Check size={12} color={C.accent} />
                      Pexels (gratuit)
                    </div>
                  </div>
                )}
              </div>

              {/* Enable Transitions */}
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 12, color: C.text }}>Enable Transitions</span>
                <Toggle
                  on={motionSettings.transitionStyle !== 'none'}
                  onClick={() => onTransitionChange(motionSettings.transitionStyle === 'none' ? 'zoom-punch' : 'none')}
                />
              </div>

              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />

              {/* Generate + Delete */}
              <div style={{ display: 'flex', gap: 6, padding: 8 }}>
                <button
                  onClick={async () => {
                    if (!onBRollsAutoApply) return
                    setAiMenuOpen(false)
                    setGenerating(true)
                    try { await onBRollsAutoApply(bRollPercent) }
                    finally { setGenerating(false) }
                  }}
                  disabled={generating}
                  style={{
                    flex: 1, padding: '9px 10px', borderRadius: 8, border: 'none',
                    cursor: generating ? 'default' : 'pointer',
                    background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                    opacity: generating ? 0.7 : 1,
                  }}
                >
                  {generating ? 'Generation…' : 'Generate'}
                </button>
                <button
                  onClick={() => { onBRollsClear?.(); setAiMenuOpen(false) }}
                  disabled={bRollItems.length === 0}
                  style={{
                    flex: 1, padding: '9px 10px', borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.bg,
                    color: bRollItems.length === 0 ? C.textDim : C.text,
                    fontSize: 12, fontWeight: 600,
                    cursor: bRollItems.length === 0 ? 'default' : 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <p style={{ fontSize: 11, color: C.textDim, margin: '0 0 12px' }}>
        {bRollItems.length} B-roll{bRollItems.length > 1 ? 's' : ''} applique{bRollItems.length > 1 ? 's' : ''}
        {bRollSuggestions.length > 0 && ` / ${bRollSuggestions.length} suggestion${bRollSuggestions.length > 1 ? 's' : ''} IA`}
      </p>

      {/* Per-recording chunks with B-roll hints */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {recordings.map((rec, recIdx) => {
          const words = wordsByRecording[rec.id] ?? []
          if (!words.length) {
            return (
              <div key={rec.id} style={{
                padding: 12, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`,
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>Video {recIdx + 1}</p>
                <p style={{ fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>Transcription indisponible</p>
              </div>
            )
          }

          // Compute time offset (each recording starts after the previous ends)
          let timeOffset = 0
          for (let i = 0; i < recIdx; i++) {
            const prevWords = wordsByRecording[recordings[i].id] ?? []
            if (prevWords.length) timeOffset += (prevWords[prevWords.length - 1].end) + 1
          }

          // Group words into chunks of ~3.5s duration (time-based instead of word-count)
          const TARGET_DURATION = 3.5
          const chunks: { start: number; end: number; words: typeof words; startIdx: number }[] = []
          if (words.length > 0) {
            let cur: { start: number; end: number; words: typeof words; startIdx: number } = {
              start: words[0].start,
              end: words[0].end,
              words: [],
              startIdx: 0,
            }
            for (let i = 0; i < words.length; i++) {
              const w = words[i]
              if (cur.words.length === 0) {
                cur.startIdx = i
                cur.start = w.start
              }
              cur.words.push(w)
              cur.end = w.end
              if (cur.end - cur.start >= TARGET_DURATION) {
                chunks.push(cur)
                cur = { start: 0, end: 0, words: [], startIdx: 0 }
              }
            }
            if (cur.words.length > 0) chunks.push(cur)
          }

          return (
            <div key={rec.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ padding: '8px 4px 6px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {recIdx + 1}. {rec.questionText || `Video ${recIdx + 1}`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {chunks.map((chunk, ci) => {
                  const globalStart = chunk.start + timeOffset
                  const globalEnd = chunk.end + timeOffset
                  const applied = bRollItems.find(b => b.timestampSeconds >= globalStart - 1 && b.timestampSeconds <= globalEnd + 1)
                  const suggestion = bRollSuggestions.findIndex(s =>
                    s.timestamp >= globalStart - 1 && s.timestamp <= globalEnd + 1,
                  )
                  const sug = suggestion >= 0 ? bRollSuggestions[suggestion] : null
                  const chunkKey = `${rec.id}-${ci}`

                  return (
                    <div
                      key={ci}
                      style={{
                        display: 'flex', gap: 10, padding: '10px 8px',
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      {/* LEFT: transition + thumbnail */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {/* Transition button (top) */}
                        <button
                          title="Transition"
                          style={{
                            width: 22, height: 22, borderRadius: 5, border: 'none', cursor: 'pointer',
                            background: 'transparent', color: C.textDim,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <svg width="12" height="10" viewBox="0 0 16 14" fill="currentColor">
                            <path d="M12.709.695a2.52 2.52 0 0 0-2.1 1.125L8 5.733 5.389 1.82a2.525 2.525 0 0 0-4.622 1.4v7.55a2.525 2.525 0 0 0 4.622 1.4L8 8.259l2.611 3.913a2.525 2.525 0 0 0 4.622-1.4V3.22A2.527 2.527 0 0 0 12.71.695M4.225 11.396a1.125 1.125 0 0 1-2.058-.625V3.22a1.125 1.125 0 0 1 2.058-.623l2.933 4.398zm9.608-.625a1.122 1.122 0 0 1-2.058.623L8.842 6.995l2.933-4.4a1.125 1.125 0 0 1 2.058.625z" />
                          </svg>
                        </button>

                        {/* Thumbnail slot */}
                        <div style={{
                          position: 'relative',
                          width: 64, height: 64, borderRadius: 8,
                          border: `1px solid ${applied ? C.accent + '66' : C.border}`,
                          background: applied ? C.bg : C.surface,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden',
                        }}>
                          {applied ? (
                            <img
                              src={applied.thumbnailUrl}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{ color: C.textDim, fontSize: 18 }}>+</span>
                          )}
                          {/* Hover overlay with search + zoom icons */}
                          <div style={{
                            position: 'absolute', bottom: 2, right: 2,
                            display: 'flex', gap: 2,
                          }}>
                            <label
                              title="Importer"
                              style={{
                                width: 18, height: 18, borderRadius: 4,
                                background: 'rgba(255,255,255,0.9)', color: C.text,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontSize: 10,
                              }}
                            >
                              📁
                              <input
                                type="file"
                                accept="image/*,video/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file && applied) uploadFile(applied.id, file)
                                  else if (file && suggestion >= 0 && sug) {
                                    // Apply via selection: use the first result then replace
                                    onBRollSelect(suggestion, 0)
                                  }
                                }}
                              />
                            </label>
                            {applied && (
                              <button
                                onClick={() => {
                                  const willOpen = openActions !== applied.id
                                  setOpenActions(willOpen ? applied.id : null)
                                  setSearchQuery(applied.searchQuery || '')
                                  setSearchResults([])
                                }}
                                title="Rechercher Pexels"
                                style={{
                                  width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer',
                                  background: 'rgba(255,255,255,0.9)', color: C.text,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                                }}
                              >
                                🔍
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT: timestamp + words + actions */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          onClick={() => onSeek?.(rec.id, chunk.start)}
                          style={{
                            alignSelf: 'flex-start',
                            padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                            fontFamily: 'monospace', background: C.surface, color: C.textSec,
                            border: `1px solid ${C.border}`, cursor: 'pointer',
                          }}
                        >
                          {globalStart.toFixed(2)} - {globalEnd.toFixed(2)}
                        </button>

                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                          {chunk.words.map(w => w.word).join(' ')}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!applied && (
                            <>
                              <label style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                background: C.surface, color: C.textSec, border: `1px solid ${C.border}`,
                                cursor: 'pointer',
                              }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M2.9918 21C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918ZM20 15V5H4V19L14 9L20 15Z" />
                                </svg>
                                Add Image
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    const blobUrl = URL.createObjectURL(file)
                                    if (onBRollAddAtTime) {
                                      onBRollAddAtTime(globalStart, Math.max(globalEnd - globalStart, 2), {
                                        videoUrl: blobUrl,
                                        thumbnailUrl: blobUrl,
                                        searchQuery: file.name,
                                      })
                                    }
                                  }}
                                />
                              </label>
                              <button
                                onClick={() => {
                                  setOpenActions(chunkKey)
                                  setSearchQuery('')
                                  setSearchResults([])
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  background: C.surface, color: C.textSec, border: `1px solid ${C.border}`,
                                  cursor: 'pointer',
                                }}
                              >
                                🔍 Pexels
                              </button>
                              <button
                                onClick={async () => {
                                  // Ask AI for a suggestion at this timestamp using the chunk text as prompt
                                  setReAsking(chunkKey)
                                  try {
                                    const q = chunk.words.map(w => w.word).join(' ').slice(0, 50)
                                    const res = await fetch(`/api/admin/broll/search?q=${encodeURIComponent(q)}&perPage=1`, { credentials: 'include' })
                                    if (res.ok) {
                                      const results = await res.json()
                                      if (results[0] && onBRollAddAtTime) {
                                        onBRollAddAtTime(globalStart, Math.max(globalEnd - globalStart, 2), {
                                          videoUrl: results[0].url,
                                          thumbnailUrl: results[0].thumbnailUrl,
                                          pexelsId: results[0].pexelsId,
                                          searchQuery: q,
                                        })
                                      }
                                    }
                                  } catch { /* */ }
                                  setReAsking(null)
                                }}
                                disabled={reAsking === chunkKey}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
                                }}
                              >
                                {reAsking === chunkKey ? '⏳' : '✨'} IA
                              </button>
                            </>
                          )}
                          {applied && (
                            <button
                              onClick={async () => {
                                if (onBRollReAsk) {
                                  setReAsking(applied.id)
                                  try { await onBRollReAsk(applied.id) } catch { /* */ }
                                  setReAsking(null)
                                }
                              }}
                              disabled={reAsking === applied.id}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                background: C.surface, color: C.textSec, border: `1px solid ${C.border}`,
                                cursor: 'pointer',
                              }}
                            >
                              <span>{reAsking === applied.id ? '⏳' : '✨'}</span>
                              Autre B-roll
                            </button>
                          )}
                          {applied && (
                            <button
                              onClick={() => {
                                const sugIdx = bRollSuggestions.findIndex(s => Math.abs(s.timestamp - applied.timestampSeconds) < 1)
                                if (sugIdx >= 0) onBRollRemove(sugIdx)
                                else if (onBRollReplace) onBRollReplace(applied.id, { videoUrl: '__REMOVE__' })
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                background: 'rgba(239,68,68,0.08)', color: '#EF4444',
                                border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={11} /> Retirer
                            </button>
                          )}
                        </div>

                        {/* Inline search panel (works for both applied + not applied) */}
                        {(openActions === (applied?.id ?? chunkKey)) && (
                          <div style={{ padding: '6px 0' }}>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') doSearch(chunkKey, searchQuery) }}
                                placeholder="Recherche Pexels..."
                                style={{
                                  flex: 1, padding: '5px 8px', borderRadius: 5, fontSize: 11,
                                  border: `1px solid ${C.border}`, background: C.bg, color: C.text, outline: 'none',
                                }}
                              />
                              <button
                                onClick={() => doSearch(chunkKey, searchQuery)}
                                disabled={searching}
                                style={{
                                  padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                                  background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
                                }}
                              >
                                {searching ? '...' : 'Chercher'}
                              </button>
                            </div>
                            {searchError && (
                              <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0', padding: '6px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 5 }}>
                                {searchError}
                              </p>
                            )}
                            {searchResults.length > 0 && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                                {searchResults.map((res: any, ri: number) => (
                                  <button
                                    key={ri}
                                    onClick={() => {
                                      if (applied && onBRollReplace) {
                                        onBRollReplace(applied.id, {
                                          videoUrl: res.url,
                                          thumbnailUrl: res.thumbnailUrl,
                                          pexelsId: res.pexelsId,
                                          searchQuery,
                                        })
                                      } else if (onBRollAddAtTime) {
                                        onBRollAddAtTime(globalStart, Math.max(globalEnd - globalStart, 2), {
                                          videoUrl: res.url,
                                          thumbnailUrl: res.thumbnailUrl,
                                          pexelsId: res.pexelsId,
                                          searchQuery,
                                        })
                                      }
                                      setOpenActions(null)
                                    }}
                                    style={{
                                      aspectRatio: '16/9', borderRadius: 4, overflow: 'hidden',
                                      border: `1px solid ${C.border}`, padding: 0, cursor: 'pointer', background: '#eee',
                                    }}
                                  >
                                    <img src={res.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* IA suggestion quick pick */}
                        {!applied && sug?.results && sug.results.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                            {sug.results.slice(0, 4).map((res: any, ri: number) => (
                              <button
                                key={ri}
                                onClick={() => onBRollSelect(suggestion, ri)}
                                style={{
                                  aspectRatio: '16/9', borderRadius: 5, overflow: 'hidden',
                                  border: `1px solid ${C.border}`, cursor: 'pointer', padding: 0, background: '#eee',
                                }}
                              >
                                <img src={res.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Outro slide (après le contenu, avant le générique Lavidz) */}
      <div style={{ marginTop: 16 }}>
        {renderSlideSection('outro')}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Trim editor (cut chunks)                                            */
/* ------------------------------------------------------------------ */

function TrimEditor({
  recordings, wordsByRecording, subtitleSettings,
  onBack, onDeleteChunk, onSeek, getActiveRecordingTime,
  selected, setSelected, deleted, setDeleted,
}: {
  recordings: { id: string; questionText: string }[]
  wordsByRecording: Record<string, import('@/remotion/themeTypes').WordTimestamp[]>
  subtitleSettings: SubtitleSettings
  onBack: () => void
  onDeleteChunk?: (recordingId: string, startIdx: number, endIdx: number) => void
  onSeek?: (recordingId: string, timeSec: number) => void
  getActiveRecordingTime?: () => { recordingId: string; timeSec: number } | null
  selected: Record<string, Set<number>>
  setSelected: React.Dispatch<React.SetStateAction<Record<string, Set<number>>>>
  deleted: Set<string>
  setDeleted: React.Dispatch<React.SetStateAction<Set<string>>>
}) {

  // Regroupe les mots en phrases courtes et porteuses de sens.
  // Règles (dans l'ordre de priorité) :
  //  - Split fort : ponctuation finale . ! ? ; ou silence >= 0.6s
  //  - Split doux : virgule/deux-points uniquement si la phrase courante fait >= 8 mots
  //  - Cap dur : au-delà de 16 mots, on force un split au prochain silence >= 0.3s ou virgule,
  //    ou à 20 mots absolus si rien ne vient
  //  - Post-traitement : les fragments < 3 mots sont fusionnés avec la phrase précédente
  const getSentences = (words: import('@/remotion/themeTypes').WordTimestamp[]) => {
    const sentences: {
      items: { kind: 'word' | 'silence' | 'punct'; w?: import('@/remotion/themeTypes').WordTimestamp; idx: number; duration?: number }[]
      startIdx: number
      endIdx: number
      start: number
      end: number
    }[] = []

    let current: typeof sentences[number] = { items: [], startIdx: 0, endIdx: 0, start: 0, end: 0 }
    const SILENCE_SHOW = 0.15
    const SILENCE_HARD_SPLIT = 0.6
    const SILENCE_SOFT_SPLIT = 0.3
    const SOFT_SPLIT_MIN_WORDS = 8
    const SOFT_CAP_WORDS = 16
    const HARD_CAP_WORDS = 20
    const MIN_WORDS_FOR_STANDALONE = 3

    const wordCount = () => current.items.filter(it => it.kind === 'word').length

    const pushCurrent = () => {
      if (current.items.length && current.items.some(i => i.kind !== 'silence')) {
        sentences.push(current)
      }
      current = { items: [], startIdx: 0, endIdx: 0, start: 0, end: 0 }
    }

    words.forEach((w, i) => {
      const prev = i > 0 ? words[i - 1] : null
      const gap = prev ? w.start - prev.end : 0
      const wc = wordCount()

      if (gap >= SILENCE_HARD_SPLIT) {
        pushCurrent()
        current.items.push({ kind: 'silence', idx: -1, duration: gap })
      } else if (gap >= SILENCE_SOFT_SPLIT && wc >= SOFT_SPLIT_MIN_WORDS) {
        pushCurrent()
        current.items.push({ kind: 'silence', idx: -1, duration: gap })
      } else if (gap >= SILENCE_SHOW) {
        current.items.push({ kind: 'silence', idx: -1, duration: gap })
      }

      if (!current.items.length || current.items.every(it => it.kind === 'silence')) {
        current.startIdx = i
        current.start = w.start
      }

      const wordStr = w.word.trim()
      const isPunctOnly = /^[.,!?;:]+$/.test(wordStr)
      if (isPunctOnly) {
        current.items.push({ kind: 'punct', w, idx: i })
      } else {
        current.items.push({ kind: 'word', w, idx: i })
      }
      current.endIdx = i
      current.end = w.end

      const wcAfter = wordCount()
      const endsInStrongPunct = /[.!?;]$/.test(wordStr)
      const endsInSoftPunct = /[,:]$/.test(wordStr)

      if (endsInStrongPunct) {
        pushCurrent()
      } else if (endsInSoftPunct && wcAfter >= SOFT_SPLIT_MIN_WORDS) {
        pushCurrent()
      } else if (wcAfter >= HARD_CAP_WORDS) {
        pushCurrent()
      } else if (wcAfter >= SOFT_CAP_WORDS) {
        const next = words[i + 1]
        const nextGap = next ? next.start - w.end : 0
        if (endsInSoftPunct || nextGap >= SILENCE_SOFT_SPLIT) pushCurrent()
      }
    })
    pushCurrent()

    // Fusionne les fragments trop courts avec la phrase précédente
    const merged: typeof sentences = []
    for (const s of sentences) {
      const wc = s.items.filter(it => it.kind === 'word').length
      if (wc < MIN_WORDS_FOR_STANDALONE && merged.length) {
        const prev = merged[merged.length - 1]
        prev.items.push(...s.items)
        prev.endIdx = s.endIdx
        prev.end = s.end
      } else {
        merged.push(s)
      }
    }
    return merged
  }

  const toggleWord = (recId: string, idx: number) => {
    setSelected(prev => {
      const s = new Set(prev[recId] ?? [])
      if (s.has(idx)) s.delete(idx)
      else s.add(idx)
      return { ...prev, [recId]: s }
    })
  }

  const totalSelected = Object.values(selected).reduce((sum, s) => sum + s.size, 0)

  const deleteSelected = () => {
    if (!totalSelected || !onDeleteChunk) return
    // For each recording, find contiguous ranges of selected words and delete them (reverse order)
    for (const recId of Object.keys(selected)) {
      const arr = [...selected[recId]].sort((a, b) => b - a)
      if (!arr.length) continue
      // Group consecutive indices
      let end = arr[0], start = arr[0]
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] === start - 1) start = arr[i]
        else {
          onDeleteChunk(recId, start, end)
          end = arr[i]; start = arr[i]
        }
      }
      onDeleteChunk(recId, start, end)
    }
    setSelected({})
  }

  const deleteAllSilences = () => {
    // Placeholder: toggle selection of all silences (we mark these as deleted visually)
    const next: Set<string> = new Set(deleted)
    for (const rec of recordings) {
      const words = wordsByRecording[rec.id] ?? []
      words.forEach((w, i) => {
        const prev = i > 0 ? words[i - 1] : null
        if (prev && w.start - prev.end >= 0.15) next.add(`${rec.id}-sil-${i}`)
      })
    }
    setDeleted(next)
  }

  const resetAll = () => {
    setSelected({})
    setDeleted(new Set())
  }

  return (
    <div>
      <SubViewHeader title="Trim Video" onBack={onBack} />

      {/* Top action bar (Submagic-style) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={deleteAllSilences}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer',
          }}
        >
          <Scissors size={12} /> Remove Silences
        </button>
        <button
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer',
          }}
        >
          <Trash2 size={12} /> Remove Bad Takes
        </button>
        <button
          onClick={resetAll}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Reset
        </button>

        {totalSelected > 0 && (
          <button
            onClick={deleteSelected}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
              border: 'none', background: C.accent, color: '#fff', cursor: 'pointer',
            }}
          >
            <Trash2 size={12} /> Supprimer {totalSelected}
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: C.textDim, margin: '0 0 14px' }}>
        Cliquez sur un mot ou un silence pour le selectionner, puis supprimez-le.
      </p>

      {/* Sentences */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {recordings.map((rec, recIdx) => {
          const words = wordsByRecording[rec.id] ?? []
          if (!words.length) {
            return (
              <div key={rec.id} style={{
                padding: 12, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`,
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>Video {recIdx + 1}</p>
                <p style={{ fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>Transcription indisponible</p>
              </div>
            )
          }

          const sentences = getSentences(words)
          const recSelected = selected[rec.id] ?? new Set<number>()

          return (
            <div key={rec.id} style={{
              borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 12px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>
                  {recIdx + 1}. {rec.questionText || `Video ${recIdx + 1}`}
                </p>
              </div>
              <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column' }}>
                {sentences.map((sentence, si) => {
                  const sentenceKey = `${rec.id}-sent-${si}`
                  const isDeleted = deleted.has(sentenceKey)

                  return (
                    <div
                      key={si}
                      className="trim-sentence"
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget.querySelector('.sentence-delete') as HTMLElement
                        if (btn) btn.style.opacity = '1'
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget.querySelector('.sentence-delete') as HTMLElement
                        if (btn) btn.style.opacity = '0'
                      }}
                      style={{
                        position: 'relative',
                        padding: '8px 10px 8px 34px', borderRadius: 8,
                        opacity: isDeleted ? 0.3 : 1,
                      }}
                    >
                      {/* Hover delete button (X on left) */}
                      <button
                        className="sentence-delete"
                        onClick={() => {
                          setDeleted(prev => {
                            const next = new Set(prev)
                            if (next.has(sentenceKey)) next.delete(sentenceKey)
                            else {
                              next.add(sentenceKey)
                              if (onDeleteChunk) onDeleteChunk(rec.id, sentence.startIdx, sentence.endIdx)
                            }
                            return next
                          })
                        }}
                        title={isDeleted ? 'Restaurer' : 'Supprimer'}
                        style={{
                          position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                          width: 22, height: 22, borderRadius: 5, border: 'none', cursor: 'pointer',
                          background: isDeleted ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                          color: isDeleted ? '#10B981' : '#EF4444',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: isDeleted ? 1 : 0, transition: 'opacity 0.15s',
                        }}
                      >
                        {isDeleted ? <RefreshCw size={11} /> : <X size={11} />}
                      </button>

                      {/* Inline items: silences + words + punctuation */}
                      <div style={{
                        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                        gap: 3, lineHeight: 1.9,
                      }}>
                        {sentence.items.map((item, ii) => {
                          if (item.kind === 'silence') {
                            return (
                              <span
                                key={`sil-${ii}`}
                                style={{
                                  display: 'inline-flex', alignItems: 'center',
                                  padding: '1px 6px', borderRadius: 4, fontSize: 10,
                                  fontFamily: 'monospace', fontWeight: 600,
                                  background: 'rgba(156,163,175,0.12)', color: '#6B7280',
                                  border: '1px dashed rgba(156,163,175,0.35)',
                                }}
                              >
                                {item.duration!.toFixed(2)}s
                              </span>
                            )
                          }
                          if (item.kind === 'punct') {
                            return (
                              <span key={`punct-${ii}`} style={{ fontSize: 13, color: C.textDim, marginLeft: -2 }}>
                                {item.w!.word}
                              </span>
                            )
                          }
                          const isSelected = recSelected.has(item.idx)
                          return (
                            <span
                              key={`w-${ii}`}
                              onClick={() => {
                                if (!isDeleted) toggleWord(rec.id, item.idx)
                                else onSeek?.(rec.id, item.w!.start)
                              }}
                              style={{
                                display: 'inline-block', padding: '1px 5px', borderRadius: 4,
                                fontSize: 13, lineHeight: 1.4, cursor: 'pointer',
                                background: isSelected ? C.accentBg : 'transparent',
                                color: isSelected ? C.accent : C.text,
                                border: isSelected ? `1px solid ${C.accent}` : '1px solid transparent',
                                textDecoration: isDeleted ? 'line-through' : 'none',
                                transition: 'all 0.1s',
                              }}
                            >
                              {item.w!.word}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Video timeline (Submagic-style, full width)                         */
/* ------------------------------------------------------------------ */

export function TrimTimeline({
  recordings, wordsByRecording, deleted, selected, onSeek, getActiveRecordingTime,
  onDeleteRange,
}: {
  recordings: { id: string; questionText: string }[]
  wordsByRecording: Record<string, import('@/remotion/themeTypes').WordTimestamp[]>
  deleted: Set<string>
  selected: Record<string, Set<number>>
  onSeek?: (recordingId: string, timeSec: number) => void
  getActiveRecordingTime?: () => { recordingId: string; timeSec: number } | null
  onDeleteRange?: (ranges: { recordingId: string; startSec: number; endSec: number }[]) => void
}) {
  const [activeInfo, setActiveInfo] = useState<{ recordingId: string; timeSec: number } | null>(null)
  const [zoom, setZoom] = useState(60) // pixels per second
  // 2-click range: first click sets cutStart, second sets cutEnd
  const [cutStart, setCutStart] = useState<number | null>(null)
  const [cutEnd, setCutEnd] = useState<number | null>(null)
  // Applied cuts (visible in red on the timeline)
  const [appliedCuts, setAppliedCuts] = useState<{ start: number; end: number }[]>([])

  useEffect(() => {
    if (!getActiveRecordingTime) return
    let raf: number
    const tick = () => {
      setActiveInfo(getActiveRecordingTime())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getActiveRecordingTime])

  // Compute total duration and per-recording offsets
  let totalDuration = 0
  const offsets: Record<string, number> = {}
  for (const rec of recordings) {
    offsets[rec.id] = totalDuration
    const words = wordsByRecording[rec.id] ?? []
    if (words.length) totalDuration += words[words.length - 1].end
    else totalDuration += 1
  }
  if (totalDuration === 0) return null

  const totalWidth = totalDuration * zoom
  const activeTimeGlobal = activeInfo ? (offsets[activeInfo.recordingId] ?? 0) + activeInfo.timeSec : 0
  const playheadPx = activeTimeGlobal * zoom

  const fmtTime = (sec: number) => {
    const mm = Math.floor(sec / 60)
    const ss = Math.floor(sec % 60)
    const ms = Math.floor((sec - Math.floor(sec)) * 1000)
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

  // Determine tick interval based on zoom (smaller interval if high zoom)
  const tickInterval = zoom >= 80 ? 0.5 : zoom >= 40 ? 1 : zoom >= 20 ? 2 : 5
  const ticks = Math.ceil(totalDuration / tickInterval) + 1

  // Find the recording under a given global time
  const findRecAtTime = (globalTime: number): { rec: { id: string; questionText: string }; localTime: number } | null => {
    for (const rec of recordings) {
      const start = offsets[rec.id] ?? 0
      const words = wordsByRecording[rec.id] ?? []
      const dur = words.length ? words[words.length - 1].end : 1
      if (globalTime >= start && globalTime < start + dur) {
        return { rec, localTime: globalTime - start }
      }
    }
    return null
  }

  // 2-click range selection
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const globalTime = Math.max(0, Math.min(totalDuration, x / zoom))

    // Seek the player at this point
    const info = findRecAtTime(globalTime)
    if (info) onSeek?.(info.rec.id, info.localTime)

    if (cutStart === null) {
      // First click → set start
      setCutStart(globalTime)
      setCutEnd(null)
    } else if (cutEnd === null) {
      // Second click → set end (and order start/end)
      if (globalTime < cutStart) {
        setCutEnd(cutStart)
        setCutStart(globalTime)
      } else {
        setCutEnd(globalTime)
      }
    } else {
      // Third click → reset and start a new selection
      setCutStart(globalTime)
      setCutEnd(null)
    }
  }

  const hasRange = cutStart !== null && cutEnd !== null && cutEnd > cutStart
  const rangeStart = cutStart ?? 0
  const rangeEnd = cutEnd ?? 0

  const clearSelection = () => {
    setCutStart(null)
    setCutEnd(null)
  }

  const deleteRange = useCallback(() => {
    if (!hasRange || cutStart === null || cutEnd === null) return
    const ranges: { recordingId: string; startSec: number; endSec: number }[] = []
    for (const rec of recordings) {
      const recStart = offsets[rec.id] ?? 0
      const words = wordsByRecording[rec.id] ?? []
      const recDur = words.length ? words[words.length - 1].end : 1
      const overlapStart = Math.max(cutStart, recStart)
      const overlapEnd = Math.min(cutEnd, recStart + recDur)
      if (overlapEnd > overlapStart) {
        ranges.push({
          recordingId: rec.id,
          startSec: overlapStart - recStart,
          endSec: overlapEnd - recStart,
        })
      }
    }
    if (ranges.length && onDeleteRange) onDeleteRange(ranges)
    setAppliedCuts(prev => [...prev, { start: cutStart, end: cutEnd }])
    clearSelection()
  }, [hasRange, cutStart, cutEnd, recordings, offsets, wordsByRecording, onDeleteRange]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: Delete/Backspace to remove the selected range
  useEffect(() => {
    if (!hasRange) return
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteRange()
      } else if (e.key === 'Escape') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasRange, deleteRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetAll = () => {
    clearSelection()
    setAppliedCuts([])
  }

  return (
    <div style={{
      position: 'sticky', bottom: 0, marginTop: 16,
      background: '#FFFFFF', border: `1px solid ${C.border}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderBottom: `1px solid ${C.border}`,
        background: '#FAFAFA',
      }}>
        {/* Left: undo/redo/split/delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button title="Annuler" style={iconBtn}>↶</button>
          <button title="Refaire" style={iconBtn}>↷</button>
        </div>

        <div style={{ width: 1, height: 18, background: C.border }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: C.textDim, padding: '0 4px' }}>
            {cutStart === null
              ? '1er clic : debut de coupe'
              : cutEnd === null
                ? '2e clic : fin de coupe'
                : `Del pour supprimer · Esc pour annuler`
            }
          </span>
          {appliedCuts.length > 0 && (
            <button
              onClick={resetAll}
              title="Reinitialiser les coupes"
              style={iconBtn}
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {hasRange && (
          <>
            <button
              onClick={clearSelection}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'transparent', color: C.textSec, border: `1px solid ${C.border}`, cursor: 'pointer',
              }}
              title="Esc"
            >
              Annuler
            </button>
            <button
              onClick={deleteRange}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
              }}
              title="Del"
            >
              <Trash2 size={11} />
              Supprimer {(rangeEnd - rangeStart).toFixed(2)}s
            </button>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Center: time */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontFamily: 'monospace',
        }}>
          <span style={{ color: C.text, fontWeight: 600 }}>{fmtTime(activeTimeGlobal)}</span>
          <span style={{ color: C.textDim }}>/</span>
          <span style={{ color: C.textDim }}>{fmtTime(totalDuration)}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Right: zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setZoom(z => Math.max(10, z - 20))}
            style={iconBtn}
            title="Dezoomer"
          >
            −
          </button>
          <input
            type="range"
            min={10}
            max={300}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ width: 80, accentColor: C.accent }}
          />
          <button
            onClick={() => setZoom(z => Math.min(300, z + 20))}
            style={iconBtn}
            title="Zoomer"
          >
            +
          </button>
          <button
            onClick={() => setZoom(60)}
            style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
              border: `1px solid ${C.border}`, background: C.bg, color: C.textSec, cursor: 'pointer',
            }}
          >
            Fit
          </button>
        </div>
      </div>

      {/* Timeline scrollable area */}
      <div
        style={{
          overflow: 'auto',
          height: 110, background: C.surface,
        }}
      >
        <div
          id="trim-timeline-track"
          onClick={handleTimelineClick}
          style={{
            position: 'relative',
            width: totalWidth, minWidth: '100%', height: '100%',
            cursor: 'crosshair',
            userSelect: 'none',
          }}
        >
          {/* Ruler with ticks */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 2,
            display: 'flex', height: 24, background: '#FAFAFA',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {Array.from({ length: ticks }, (_, i) => {
              const t = i * tickInterval
              if (t > totalDuration) return null
              return (
                <div key={i} style={{
                  position: 'absolute', left: t * zoom, top: 0, height: '100%',
                  display: 'flex', alignItems: 'flex-end', paddingBottom: 2, paddingLeft: 3,
                }}>
                  <div style={{ width: 1, height: 6, background: C.textDim, position: 'absolute', left: 0, bottom: 0 }} />
                  <span style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>
                    {fmtTime(t)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Video track — one block per recording */}
          <div style={{
            position: 'absolute', top: 32, left: 0,
            height: 60, width: '100%',
          }}>
            {recordings.map((rec, ri) => {
              const recStart = offsets[rec.id] ?? 0
              const words = wordsByRecording[rec.id] ?? []
              const dur = words.length ? words[words.length - 1].end : 1
              const leftPx = recStart * zoom
              const widthPx = dur * zoom
              const colors = ['#DBEAFE', '#FEE2E2', '#FEF3C7', '#D1FAE5', '#EDE9FE']
              const bg = colors[ri % colors.length]
              return (
                <div
                  key={rec.id}
                  title={rec.questionText}
                  style={{
                    position: 'absolute', top: 0, height: '100%',
                    left: leftPx, width: widthPx,
                    background: bg, borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center',
                    padding: '0 8px', overflow: 'hidden',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {ri + 1}. {rec.questionText || `Video`}
                  </span>
                </div>
              )
            })}

            {/* Applied cuts (red overlays) */}
            {appliedCuts.map((r, i) => (
              <div
                key={`applied-${i}`}
                style={{
                  position: 'absolute', top: -2, height: 'calc(100% + 4px)',
                  left: r.start * zoom, width: (r.end - r.start) * zoom,
                  background: 'rgba(239,68,68,0.22)',
                  border: '2px solid rgba(239,68,68,0.6)',
                  borderRadius: 4, pointerEvents: 'none', zIndex: 2,
                }}
              />
            ))}

            {/* Active cut range (between 2 clicks) */}
            {hasRange && (
              <div
                style={{
                  position: 'absolute', top: -2, height: 'calc(100% + 4px)',
                  left: rangeStart * zoom, width: (rangeEnd - rangeStart) * zoom,
                  background: 'rgba(255,77,28,0.22)',
                  border: `2px solid ${C.accent}`,
                  borderRadius: 4, pointerEvents: 'none', zIndex: 3,
                }}
              />
            )}

            {/* First click marker (waiting for second click) */}
            {cutStart !== null && cutEnd === null && (
              <>
                <div
                  style={{
                    position: 'absolute', top: -8, height: 'calc(100% + 16px)',
                    left: cutStart * zoom - 1, width: 2,
                    background: C.accent, pointerEvents: 'none', zIndex: 4,
                  }}
                />
                <div
                  style={{
                    position: 'absolute', top: -14, left: cutStart * zoom - 20,
                    fontSize: 9, fontWeight: 700, color: C.accent,
                    padding: '1px 5px', borderRadius: 3,
                    background: '#FFFFFF', border: `1px solid ${C.accent}`,
                    pointerEvents: 'none', zIndex: 4, whiteSpace: 'nowrap',
                  }}
                >
                  Debut
                </div>
              </>
            )}

            {/* Selected words overlay (from TrimEditor word selection) */}
            {Object.entries(selected).flatMap(([recId, set]) => {
              const words = wordsByRecording[recId] ?? []
              const recStart = offsets[recId] ?? 0
              return [...set].map(idx => {
                const w = words[idx]
                if (!w) return null
                const leftPx = (recStart + w.start) * zoom
                const widthPx = Math.max((w.end - w.start) * zoom, 2)
                return (
                  <div
                    key={`${recId}-${idx}`}
                    style={{
                      position: 'absolute', top: 60, height: 3,
                      left: leftPx, width: widthPx,
                      background: C.accent, pointerEvents: 'none',
                    }}
                  />
                )
              })
            })}
          </div>

          {/* Playhead */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: playheadPx, width: 2, background: '#1A1A1A',
            pointerEvents: 'none', zIndex: 3,
          }}>
            <div style={{
              position: 'absolute', top: -2, left: -5,
              width: 12, height: 12, background: '#1A1A1A',
              clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 5, border: 'none', cursor: 'pointer',
  background: 'transparent', color: '#6B7280',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 14,
}

/* ------------------------------------------------------------------ */
/* Main panel                                                          */
/* ------------------------------------------------------------------ */

export function EasyModePanel(props: EasyModePanelProps) {
  const {
    silenceCutDone, silenceRemovedSec,
    subtitleSettings, motionSettings,
    coldOpenEnabled, coldOpenPhrase, coldOpenCandidates, coldOpenSelectedPhrase,
    coldOpenLoading, onSelectColdOpenCandidate, onRegenerateColdOpen,
    bRollSuggestions, bRollItems,
    autoApplying, format, animatedEmojis, inlaysEnabled,
    regenerating,
    onSubtitleStyleChange,
    onColdOpenToggle, onBRollSelect, onBRollRemove, onFormatChange,
    onMotionToggle, onAnimatedEmojisToggle,
    onApplyChanges, onRunAiSuggestions,
  } = props

  const [showBRollDetails, setShowBRollDetails] = useState(false)
  const [editSubView, setEditSubViewState] = useState<'none' | 'captions' | 'scenes' | 'trim'>('none')
  const [captionsInitialTab, setCaptionsInitialTab] = useState<'style' | 'settings' | 'transcript'>('style')
  const setEditSubView = useCallback((v: 'none' | 'captions' | 'scenes' | 'trim') => {
    setEditSubViewState(v)
    props.onEditSubViewChange?.(v)
  }, [props.onEditSubViewChange]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Loading */
  if (autoApplying) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 14, padding: '80px 20px', textAlign: 'center',
      }}>
        <Loader2 size={28} style={{ color: C.accent, animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Montage en cours...</p>
        <p style={{ fontSize: 12, color: C.textDim, margin: 0 }}>Brand Kit, silences, analyse IA</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>


      {/* ── Sub-view: Captions ── */}
      {editSubView === 'captions' && (
        <div>
          <SubViewHeader title="Captions" onBack={() => setEditSubView('none')} />
          {coldOpenEnabled && (coldOpenSelectedPhrase || coldOpenPhrase) && (
            <HookEditor
              phrase={(coldOpenSelectedPhrase ?? coldOpenPhrase) as string}
              durationSec={Math.max(0, (props.coldOpenEnd ?? 0) - (props.coldOpenStart ?? 0))}
              fontSize={props.coldOpenFontSize ?? 72}
              position={props.coldOpenTextPosition ?? 'bottom'}
              textColor={props.coldOpenTextColor ?? '#FFFFFF'}
              loading={coldOpenLoading}
              onPhraseChange={(v) => props.onColdOpenPhraseChange?.(v)}
              onFontSizeChange={(v) => props.onColdOpenFontSizeChange?.(v)}
              onPositionChange={(v) => props.onColdOpenTextPositionChange?.(v)}
              onTextColorChange={(v) => props.onColdOpenTextColorChange?.(v)}
              onDurationChange={(v) => props.onColdOpenDurationChange?.(v)}
              onRegenerate={onRegenerateColdOpen}
              onDelete={onColdOpenToggle}
            />
          )}
          <Feature
            icon={<Type size={18} color={C.textSec} />}
            title="Activer les sous-titres"
            desc="Afficher les sous-titres auto"
            on={subtitleSettings.enabled}
            onToggle={() => onSubtitleStyleChange(subtitleSettings.enabled ? '' : 'hormozi')}
          />
          {subtitleSettings.enabled && (
            <CaptionEditor
              wordsByRecording={props.wordsByRecording}
              recordings={props.recordingsList}
              subtitleSettings={subtitleSettings}
              onSubtitleSettingsChange={props.onSubtitleSettingsPartial}
              onWordEdit={props.onWordEdit}
              onSeek={props.onSeek}
              onDeleteWord={props.onDeleteWord}
              onAddWord={props.onAddWord}
              onDeleteChunk={props.onDeleteChunk}
              getActiveRecordingTime={props.getActiveRecordingTime}
              wordEmojisBySegmentId={props.wordEmojisBySegmentId}
              onEmojiSet={props.onEmojiSet}
              onEmojiRemove={props.onEmojiRemove}
              initialTab={captionsInitialTab}
            />
          )}
        </div>
      )}

      {/* ── Sub-view: Edit Scenes ── */}
      {editSubView === 'scenes' && (
        <SceneEditor
          recordings={props.recordingsList}
          wordsByRecording={props.wordsByRecording}
          subtitleSettings={subtitleSettings}
          bRollSuggestions={bRollSuggestions}
          bRollItems={bRollItems}
          onBack={() => setEditSubView('none')}
          onRunAiSuggestions={onRunAiSuggestions}
          onBRollSelect={onBRollSelect}
          onBRollRemove={onBRollRemove}
          onSeek={props.onSeek}
          getActiveRecordingTime={props.getActiveRecordingTime}
          onBRollReplace={props.onBRollReplace}
          onBRollReAsk={props.onBRollReAsk}
          onBRollAddAtTime={props.onBRollAddAtTime}
          intro={props.intro}
          setIntro={props.setIntro}
          outro={props.outro}
          setOutro={props.setOutro}
          theme={props.theme}
          audioSettings={props.audioSettings}
          setAudioSettings={props.setAudioSettings}
          soundLibrary={props.soundLibrary}
          soundPreviewAudioRef={props.soundPreviewAudioRef}
          motionSettings={motionSettings}
          onTransitionChange={(style) => props.onTransitionChange(style)}
          onBRollsAutoApply={props.onBRollsAutoApply}
          onBRollsClear={props.onBRollsClear}
          onRequestIntroHookSuggestions={props.onRequestIntroHookSuggestions}
          onApplyBrandKitToSlide={props.onApplyBrandKitToSlide}
        />
      )}

      {/* ── Sub-view: Trim Video ── */}
      {editSubView === 'trim' && (
        <TrimEditor
          recordings={props.recordingsList}
          wordsByRecording={props.wordsByRecording}
          subtitleSettings={subtitleSettings}
          onBack={() => setEditSubView('none')}
          onDeleteChunk={props.onDeleteChunk}
          onSeek={props.onSeek}
          getActiveRecordingTime={props.getActiveRecordingTime}
          selected={props.trimSelected}
          setSelected={props.setTrimSelected}
          deleted={props.trimDeleted}
          setDeleted={props.setTrimDeleted}
        />
      )}

      {/* ─────────────────────── ROOT VIEW (single scrollable flow) ─────────── */}
      {editSubView === 'none' && (
        <div>
          {/* Edit section (3-card grid) */}
          <Section title="Edit" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8, marginBottom: 8 }}>
            <EditCard
              icon={<CaptionsIcon size={22} color={C.text} />}
              label="Captions"
              onClick={() => setEditSubView('captions')}
            />
            <EditCard
              icon={<Layers size={22} color={C.text} />}
              label="Edit Scenes"
              onClick={() => setEditSubView('scenes')}
            />
            <EditCard
              icon={<Scissors size={22} color={C.text} />}
              label="Trim Video"
              onClick={() => setEditSubView('trim')}
            />
          </div>

          {/* AI Boost section */}
          <Section title="AI Boost" />

          <Feature
            icon={<Type size={18} color={C.textSec} />}
            title="AI Captions"
            desc="Sous-titres styles automatiques"
            on={subtitleSettings.enabled}
            onToggle={() => onSubtitleStyleChange(subtitleSettings.enabled ? '' : 'hormozi')}
            editLabel="Style"
            onEdit={() => {
              setCaptionsInitialTab('style')
              if (!subtitleSettings.enabled) onSubtitleStyleChange('hormozi')
              setEditSubView('captions')
            }}
            editLabel2="Edit"
            onEdit2={() => {
              setCaptionsInitialTab('transcript')
              if (!subtitleSettings.enabled) onSubtitleStyleChange('hormozi')
              setEditSubView('captions')
            }}
          />
          <Divider />

          <Feature
            icon={<Scissors size={18} color={C.textSec} />}
            title="Remove Silences"
            desc={(() => {
              // Compute detected silences >= 0.5s across all recordings
              let count = 0
              let totalSec = 0
              for (const rec of props.recordingsList) {
                const words = props.wordsByRecording[rec.id] ?? []
                for (let i = 1; i < words.length; i++) {
                  const gap = words[i].start - words[i - 1].end
                  if (gap >= 0.5) { count++; totalSec += gap }
                }
              }
              if (count === 0) return 'Couper les pauses pour resserrer le rythme'
              if (props.silenceCutEnabled) {
                return `${count} silence${count > 1 ? 's' : ''} (${totalSec.toFixed(1)}s) — cliquer Appliquer`
              }
              return `${count} silence${count > 1 ? 's' : ''} detecte${count > 1 ? 's' : ''} (${totalSec.toFixed(1)}s)`
            })()}
            on={props.silenceCutEnabled}
            onToggle={props.onSilenceCutToggle ?? (() => {})}
          />
          <Divider />

          <Feature
            icon={<ZoomIn size={18} color={C.textSec} />}
            title="AI Auto Zooms"
            desc="Zoom automatique sur les moments cles"
            on={!!motionSettings.dynamicZoom}
            onToggle={() => onMotionToggle('dynamicZoom')}
          />
          <Divider />

          <Feature
            icon={<Film size={18} color={C.textSec} />}
            title="AI Auto B-rolls"
            desc={bRollItems.length > 0
              ? `${bRollItems.length} B-roll${bRollItems.length > 1 ? 's' : ''} applique${bRollItems.length > 1 ? 's' : ''}`
              : 'Illustrer avec des plans contextuels'}
            on={bRollItems.length > 0}
            onToggle={props.onBRollsAutoToggle ?? (() => {})}
            editLabel={bRollSuggestions.length > 0 ? 'Edit' : undefined}
            onEdit={() => setShowBRollDetails(!showBRollDetails)}
          />

          {/* B-roll details expandable */}
          {showBRollDetails && bRollSuggestions.length > 0 && (
            <div style={{ padding: '4px 0 12px 54px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bRollSuggestions.map((sug, sugIdx) => {
                const appliedItem = bRollItems.find(b => Math.abs(b.timestampSeconds - sug.timestamp) < 1)
                const results = sug.results ?? []
                return (
                  <div key={sugIdx} style={{
                    padding: 10, borderRadius: 10, background: C.surface,
                    border: appliedItem ? `1px solid ${C.accent}22` : `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: C.text, margin: 0, flex: 1, lineHeight: 1.3 }}>
                        {sug.reason}
                      </p>
                      <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>
                        {Math.floor(sug.timestamp / 60)}:{String(Math.floor(sug.timestamp % 60)).padStart(2, '0')}
                      </span>
                      {appliedItem && (
                        <button onClick={() => onBRollRemove(sugIdx)} style={{
                          width: 20, height: 20, borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: 'rgba(239,68,68,0.06)', color: '#EF4444',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    {results.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                        {results.slice(0, 4).map((res: any, resIdx: number) => {
                          const isSelected = appliedItem?.videoUrl === res.url
                          return (
                            <button key={resIdx} onClick={() => onBRollSelect(sugIdx, resIdx)} style={{
                              position: 'relative', aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden',
                              border: isSelected ? `2px solid ${C.accent}` : `1.5px solid ${C.border}`,
                              cursor: 'pointer', padding: 0, background: '#eee',
                            }}>
                              <img src={res.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              {isSelected && (
                                <div style={{
                                  position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
                                  background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <Check size={8} color="#fff" />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={onRunAiSuggestions} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                background: C.surface, color: C.textSec, border: `1px solid ${C.border}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
              }}>
                <RefreshCw size={10} /> Relancer
              </button>
            </div>
          )}

          {/* AI Tools section */}
          <Section title="AI Tools" />

          <ColdOpenFeature
            coldOpenEnabled={coldOpenEnabled}
            coldOpenLoading={coldOpenLoading}
            coldOpenCandidates={coldOpenCandidates}
            coldOpenSelectedPhrase={coldOpenSelectedPhrase ?? coldOpenPhrase}
            onToggle={onColdOpenToggle}
            onSelect={onSelectColdOpenCandidate}
            onRegenerate={onRegenerateColdOpen}
          />
          <Divider />

          <Feature
            icon={<Volume2 size={18} color={C.textSec} />}
            title="Clean Audio"
            desc="Isolation vocale par ElevenLabs"
            on={props.cleanAudioEnabled}
            onToggle={props.onCleanAudioToggle}
          />
          <Divider />

          <Feature
            icon={<Trash2 size={18} color={C.textSec} />}
            title="Remove Bad Takes"
            desc={props.badTakesEnabled && props.badTakesRemovedCount
              ? `${props.badTakesRemovedCount} mot${props.badTakesRemovedCount > 1 ? 's' : ''} retire${props.badTakesRemovedCount > 1 ? 's' : ''}`
              : 'Detecter et retirer les prises ratees (fillers, doublons)'}
            on={!!props.badTakesEnabled}
            onToggle={props.onBadTakesToggle ?? (() => {})}
          />
          <Divider />

          <Feature
            icon={<Smile size={18} color={C.textSec} />}
            title="Animated Emojis"
            desc="Emojis animés sur les mots clés"
            on={!!animatedEmojis && inlaysEnabled}
            onToggle={onAnimatedEmojisToggle}
          />
          <Divider />

          <Feature
            icon={<ZoomIn size={18} color={C.textSec} />}
            title="Ken Burns"
            desc="Mouvement cinematique lent"
            on={!!motionSettings.kenBurns}
            onToggle={() => onMotionToggle('kenBurns')}
          />
          <Divider />

          <Feature
            icon={<Play size={18} color={C.textSec} />}
            title="Word Pop"
            desc="Zoom subtil sur chaque mot"
            on={!!motionSettings.wordPop}
            onToggle={() => onMotionToggle('wordPop')}
          />
        </div>
      )}
    </div>
  )
}
