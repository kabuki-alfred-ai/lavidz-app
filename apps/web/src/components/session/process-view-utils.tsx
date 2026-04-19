'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { TransitionStyle } from '@/remotion/themeTypes'
import type { SubtitleStyle } from '@/remotion/subtitleTypes'

// ─── Design System ────────────────────────────────────────────────────────────

export const S = {
  // Background layers
  bg:           '#0a0a0a',
  panel:        '#111111',
  card:         '#161616',
  cardHover:    '#1e1e1e',
  // Surfaces
  surface:      'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.07)',
  surfaceActive:'rgba(255,255,255,0.12)',
  // Borders
  border:       'rgba(255,255,255,0.06)',
  borderHover:  'rgba(255,255,255,0.12)',
  borderActive: 'rgba(255,255,255,0.15)',
  // Text
  text:         '#ffffff',
  muted:        'rgba(255,255,255,0.5)',
  dim:          'rgba(255,255,255,0.25)',
  // Accent
  accent:       '#FF4D1C',
  accentSoft:   'rgba(255,77,28,0.15)',
  accentHover:  '#ff6a3d',
  // Status
  success:      'rgba(52,211,153,0.9)',
  successSoft:  'rgba(52,211,153,0.1)',
  error:        '#f87171',
  errorSoft:    'rgba(248,113,113,0.08)',
  warning:      '#f59e0b',
  warningSoft:  'rgba(245,158,11,0.08)',
  // Spacing
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const,
  // Radius
  radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, pill: 9999 } as const,
}

export function selectableStyle(selected: boolean, hovered = false): React.CSSProperties {
  return {
    background: selected ? S.surfaceActive : hovered ? S.surfaceHover : S.surface,
    border: `1px solid ${selected ? S.borderActive : hovered ? S.borderHover : S.border}`,
    color: selected ? S.text : S.muted,
    transition: 'all 0.15s',
    cursor: 'pointer',
  }
}

// ─── Reusable UI primitives ───────────────────────────────────────────────────

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        background: value ? S.accent : 'rgba(255,255,255,0.1)',
        transition: 'background 0.2s',
        flexShrink: 0,
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          width: 18,
          height: 18,
          borderRadius: 9,
          background: '#ffffff',
          left: value ? 23 : 3,
          transition: 'left 0.18s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        color: S.dim,
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: S.gap.sm,
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  )
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.gap.sm }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label>{label}</Label>
        <span
          style={{
            fontSize: 10,
            color: S.muted,
            fontFamily: 'monospace',
            background: S.surface,
            padding: '2px 6px',
            borderRadius: S.radius.xs,
            border: `1px solid ${S.border}`,
          }}
        >
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: S.accent, height: 3 }}
      />
    </div>
  )
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 10,
        padding: '16px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** A flat section divider with a title — no accordion */
export function SectionHeader({
  children,
  description,
}: {
  children: React.ReactNode
  description?: string
}) {
  return (
    <div style={{ marginBottom: S.gap.md }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: S.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}
      >
        {children}
      </p>
      {description && (
        <p style={{ fontSize: 11, color: S.dim, marginTop: 3 }}>{description}</p>
      )}
    </div>
  )
}

/** Collapsible section — kept for backward compat */
export function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: S.gap.sm,
          width: '100%',
          padding: `${S.gap.sm}px 0`,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: S.dim,
          fontSize: 10,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        <ChevronRight
          size={11}
          style={{
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
            flexShrink: 0,
          }}
        />
        {title}
      </button>
      {open && <div style={{ paddingTop: S.gap.md }}>{children}</div>}
    </div>
  )
}

export function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: S.border,
        margin: `${S.gap.lg}px 0`,
      }}
    />
  )
}

export function useHover() {
  const [hovered, setHovered] = useState(false)
  return {
    hovered,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  }
}

export function NavButton({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  variant: 'back' | 'next' | 'export' | 'deliver'
  children: React.ReactNode
}) {
  const { hovered, onMouseEnter, onMouseLeave } = useHover()
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px',
    borderRadius: S.radius.md,
    fontSize: 13,
    fontWeight: 700,
    transition: 'all 0.15s',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
  const variantStyle: React.CSSProperties =
    variant === 'back'
      ? {
          padding: '12px 18px',
          background: hovered ? S.surfaceHover : S.surface,
          border: `1px solid ${hovered ? S.borderHover : S.border}`,
          color: S.muted,
        }
      : variant === 'next' || variant === 'export'
        ? {
            flex: 1,
            background: hovered ? 'rgba(255,255,255,0.88)' : '#fff',
            border: 'none',
            color: '#0a0a0a',
            boxShadow: hovered ? '0 4px 16px rgba(255,255,255,0.12)' : 'none',
          }
        : {
            padding: '12px',
            background: hovered ? 'rgba(52,211,153,0.18)' : 'rgba(52,211,153,0.12)',
            border: `1px solid ${hovered ? 'rgba(52,211,153,0.4)' : 'rgba(52,211,153,0.25)'}`,
            color: 'rgb(52,211,153)',
          }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...variantStyle }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const FPS = 30
export const QUESTION_CARD_FRAMES = 4 * FPS

export const FORMATS = {
  '16/9': { width: 1280, height: 720, label: '16/9', description: 'YouTube · LinkedIn' },
  '4/3':  { width: 960,  height: 720, label: '4/3',  description: 'Instagram · Reels' },
  '9/16': { width: 720,  height: 1280, label: '9/16', description: 'Stories · TikTok' },
} as const
export type FormatKey = keyof typeof FORMATS

export const STEPS = [
  { id: 'voice',       label: 'Voix',        desc: 'Voix IA & silences' },
  { id: 'transcripts', label: 'Transcripts', desc: 'V\u00e9rifier & r\u00e9g\u00e9n\u00e9rer' },
  { id: 'intro',       label: 'Intro',       desc: 'Slide d\'accroche' },
  { id: 'outro',       label: 'Outro',       desc: 'CTA final' },
  { id: 'theme',       label: 'Transitions', desc: 'Style visuel' },
  { id: 'music',       label: 'Musique',     desc: 'Ambiance sonore' },
  { id: 'subtitles',   label: 'Sous-titres', desc: 'Texte & position' },
  { id: 'preview',     label: 'Aper\u00e7u',      desc: 'Format & export' },
]

export const PHASES = [
  { id: 'prepare',   label: 'Pr\u00e9parer',      desc: 'Voix IA & traitement audio' },
  { id: 'customize', label: 'Personnaliser',  desc: 'Style, bookends, musique' },
  { id: 'export',    label: 'Exporter',       desc: 'Format & rendu final' },
]

export const STANDARD_VOICE_IDS = new Set([
  'Hy28BjVfgieDVMiyQpQe','MmafIMKg28Wr0yMh8CEB','KSyQzmsYhFbuOhqj1Xxv',
  'jGpnMdbhtKgQbVrYezOx','k1w1SeihHyKDJXr7nZRX',
])

export const AUDIO_SUGGESTIONS: Record<string, { bgMusic: string[]; transitionSfx: string[] }> = {
  'fast-curious': {
    bgMusic: [
      'dark trap instrumental, hard hitting bass, high energy interview music',
      'aggressive hip-hop beat, 95 BPM, no vocals',
      'intense electronic music, punchy kick, cinematic energy',
    ],
    transitionSfx: [
      'hard bass punch impact sound effect',
      'deep cinematic boom hit transition',
      'rapid whoosh slam impact sound effect',
    ],
  },
  'konbini': {
    bgMusic: [
      'fun upbeat pop music, playful and colorful, background interview music',
      'cheerful synth pop, light and positive vibes, no vocals',
      'bouncy indie pop background music, bright and energetic',
    ],
    transitionSfx: [
      'bright camera flash pop sound effect',
      'quick playful whoosh transition, fun and light',
      'short swipe swoosh sound effect, crisp',
    ],
  },
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RawRecording {
  id: string
  questionText: string
  videoUrl: string
  transcript: string | null
  wordTimestamps?: { word: string; start: number; end: number }[] | null
  ttsAudioKey: string | null
  ttsVoiceId: string | null
  processedVideoKey: string | null
  processingHash: string | null
  /** Per-segment question card duration override (frames). Used in project mode. */
  _questionDurationFrames?: number
}

export interface Voice {
  id: string
  name: string
  previewUrl: string
  accent: string
  gender: string
  language: string
  provider?: 'elevenlabs' | 'minimax'
}

export interface CleanvoiceConfig {
  fillers: boolean
  hesitations: boolean
  stutters: boolean
  muted: boolean
  long_silences: boolean
  mouth_sounds: boolean
  breath: boolean
  remove_noise: boolean
  normalize: boolean
  studio_sound: 'nightly' | false
}

export const DEFAULT_CLEANVOICE_CONFIG: CleanvoiceConfig = {
  fillers: true,
  hesitations: true,
  stutters: false,
  muted: true,
  long_silences: true,
  mouth_sounds: true,
  breath: true,
  remove_noise: false,
  normalize: true,
  studio_sound: false,
}

// ─── Utility functions ────────────────────────────────────────────────────────

export function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const cleanup = (dur: number) => {
      video.onloadedmetadata = null
      video.ontimeupdate = null
      video.onerror = null
      video.src = ''
      video.load()
      resolve(dur)
    }
    const timer = setTimeout(() => cleanup(60), 8000)
    video.onloadedmetadata = () => {
      clearTimeout(timer)
      const dur = video.duration
      if (!isFinite(dur)) {
        cleanup(60)
      } else {
        cleanup(dur)
      }
    }
    video.onerror = () => { clearTimeout(timer); cleanup(30) }
    video.src = url
  })
}

export function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio()
    const cleanup = (dur: number) => {
      a.onloadedmetadata = null; a.onerror = null
      a.src = ''; a.load(); resolve(dur)
    }
    a.onloadedmetadata = () => cleanup(isFinite(a.duration) ? a.duration : 4)
    a.onerror = () => cleanup(4)
    a.src = url
  })
}

export async function downloadAsBlob(url: string): Promise<string> {
  const res = await fetch(url); const blob = await res.blob(); return URL.createObjectURL(blob)
}

export async function generateTTS(text: string, voiceId: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voiceId }) })
      if (res.ok) { const blob = await res.blob(); return URL.createObjectURL(blob) }
      if (res.status === 429 && attempt < retries) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue }
      return null
    } catch { if (attempt < retries) await new Promise(r => setTimeout(r, 1000)) }
  }
  return null
}

// ─── Style Presets ────────────────────────────────────────────────────────────

export const STYLE_PRESETS = [
  {
    id: 'fast-curious',
    label: 'Fast & Curious',
    desc: 'Dark \u00b7 Impact \u00b7 Zoom punch',
    format: '9/16' as FormatKey,
    theme: {
      backgroundColor: '#0A0A0A',
      textColor: '#FFFFFF',
      fontFamily: "Impact, 'Arial Narrow', sans-serif",
      fontWeight: 400,
    },
    motionSettings: {
      transitionStyle: 'zoom-punch' as TransitionStyle,
      wordPop: true,
      progressBar: true,
      kenBurns: false,
    },
    subtitleSettings: {
      enabled: true,
      style: 'hormozi' as SubtitleStyle,
      size: 72,
      position: 75,
      wordsPerLine: 3,
      offsetMs: 0,
    },
    questionCardFrames: Math.round(2.5 * FPS),
  },
  {
    id: 'konbini',
    label: 'Konbini',
    desc: 'Couleurs vives \u00b7 Flash cut',
    format: '9/16' as FormatKey,
    theme: {
      backgroundColor: '#FF2D55',
      textColor: '#FFFFFF',
      fontFamily: "'Arial Black', Gadget, sans-serif",
      fontWeight: 400,
    },
    motionSettings: {
      transitionStyle: 'flash' as TransitionStyle,
      wordPop: true,
      progressBar: false,
      kenBurns: false,
      questionCardColors: ['#FF2D55', '#FFD60A', '#30D158', '#0A84FF', '#FF6B35'],
    },
    subtitleSettings: {
      enabled: true,
      style: 'hormozi' as SubtitleStyle,
      size: 68,
      position: 75,
      wordsPerLine: 2,
      offsetMs: 0,
    },
    questionCardFrames: 2 * FPS,
  },
]
