'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Play, RefreshCw, Loader2, ChevronRight } from 'lucide-react'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import { END_CARD_FRAMES } from '@/remotion/LavidzComposition'
import type { SubtitleSettings, SubtitleStyle } from '@/remotion/subtitleTypes'
import { DEFAULT_SUBTITLE_SETTINGS } from '@/remotion/subtitleTypes'
import type { TransitionTheme, IntroSettings, OutroSettings, MotionSettings, TransitionStyle, QuestionCardStyle, AudioSettings, WordTimestamp, SlidePreset } from '@/remotion/themeTypes'
import { DEFAULT_TRANSITION_THEME, DEFAULT_INTRO_SETTINGS, DEFAULT_OUTRO_SETTINGS, DEFAULT_MOTION_SETTINGS, FONT_OPTIONS, THEME_PRESETS, SLIDE_PRESETS } from '@/remotion/themeTypes'
import { ServerRenderer, type ServerRendererHandle } from './ServerRenderer'
import { TranscriptEditor } from './TranscriptEditor'
import { Timeline, type ClipEdit } from './Timeline'
import { useClipEdits } from '@/hooks/useClipEdits'

// Remap word timestamps after silence/filler cuts.
// keepIntervals: segments of the original video that were kept (in original time).
// Returns timestamps relative to the new cut video.
function remapWordTimestamps(
  words: WordTimestamp[],
  keepIntervals: { start: number; end: number }[],
): WordTimestamp[] {
  const result: WordTimestamp[] = []
  let timeOffset = 0
  for (const seg of keepIntervals) {
    for (const w of words) {
      if (w.end <= seg.start || w.start >= seg.end) continue
      result.push({
        word: w.word,
        start: timeOffset + Math.max(0, w.start - seg.start),
        end: timeOffset + Math.min(seg.end - seg.start, w.end - seg.start),
      })
    }
    timeOffset += seg.end - seg.start
  }
  result.sort((a, b) => a.start - b.start)
  return result
}

import type { PlayerRef } from '@remotion/player'
const Player = dynamic(() => import('@remotion/player').then((m) => m.Player), { ssr: false })
const LavidzComposition = dynamic(
  () => import('@/remotion/LavidzComposition').then((m) => m.LavidzComposition),
  { ssr: false },
)

const FPS = 30
const QUESTION_CARD_FRAMES = 4 * FPS

const STYLE_PRESETS = [
  {
    id: 'fast-curious',
    label: 'Fast & Curious',
    desc: 'Dark · Impact · Zoom punch',
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
    desc: 'Couleurs vives · Flash cut',
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

const AUDIO_SUGGESTIONS: Record<string, { bgMusic: string[]; transitionSfx: string[] }> = {
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

const FORMATS = {
  '16/9': { width: 1280, height: 720, label: '16/9', description: 'YouTube · LinkedIn' },
  '4/3':  { width: 960,  height: 720, label: '4/3',  description: 'Instagram · Reels' },
  '9/16': { width: 720,  height: 1280, label: '9/16', description: 'Stories · TikTok' },
} as const
type FormatKey = keyof typeof FORMATS

interface RawRecording {
  id: string
  questionText: string
  videoUrl: string
  transcript: string | null
  wordTimestamps?: { word: string; start: number; end: number }[] | null
  ttsAudioKey: string | null
  ttsVoiceId: string | null
  processedVideoKey: string | null
  processingHash: string | null
}

const STANDARD_VOICE_IDS = new Set([
  'Hy28BjVfgieDVMiyQpQe','MmafIMKg28Wr0yMh8CEB','KSyQzmsYhFbuOhqj1Xxv',
  'jGpnMdbhtKgQbVrYezOx','k1w1SeihHyKDJXr7nZRX',
])

interface Voice { id: string; name: string; previewUrl: string; accent: string; gender: string; language: string; provider?: 'elevenlabs' | 'minimax' }

interface CleanvoiceConfig {
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

const DEFAULT_CLEANVOICE_CONFIG: CleanvoiceConfig = {
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

interface Props {
  recordings: RawRecording[]
  themeName: string
  sessionId: string
  themeSlug: string
  montageSettings?: Record<string, any> | null
}

function getVideoDuration(url: string): Promise<number> {
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
    // Timeout fallback — avoids blocking on unresolvable durations
    const timer = setTimeout(() => cleanup(60), 8000)
    video.onloadedmetadata = () => {
      clearTimeout(timer)
      const dur = video.duration
      if (!isFinite(dur)) {
        // Avoid expensive full-download seek — fall back immediately
        cleanup(60)
      } else {
        cleanup(dur)
      }
    }
    video.onerror = () => { clearTimeout(timer); cleanup(30) }
    video.src = url
  })
}

function getAudioDuration(url: string): Promise<number> {
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

async function downloadAsBlob(url: string): Promise<string> {
  const res = await fetch(url); const blob = await res.blob(); return URL.createObjectURL(blob)
}

async function generateTTS(text: string, voiceId: string, retries = 2): Promise<string | null> {
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

const STEPS = [
  { id: 'voice',       label: 'Voix',        desc: 'Voix IA & silences' },
  { id: 'transcripts', label: 'Transcripts', desc: 'Vérifier & régénérer' },
  { id: 'intro',       label: 'Intro',       desc: 'Slide d\'accroche' },
  { id: 'outro',       label: 'Outro',       desc: 'CTA final' },
  { id: 'theme',       label: 'Transitions', desc: 'Style visuel' },
  { id: 'music',       label: 'Musique',     desc: 'Ambiance sonore' },
  { id: 'subtitles',   label: 'Sous-titres', desc: 'Texte & position' },
  { id: 'preview',     label: 'Aperçu',      desc: 'Format & export' },
]

// ─── Design System ────────────────────────────────────────────────────────────

const S = {
  // Colors
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.07)',
  surfaceActive: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.08)',
  borderHover: 'rgba(255,255,255,0.15)',
  borderActive: 'rgba(255,255,255,0.25)',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.5)',
  dim: 'rgba(255,255,255,0.25)',
  accent: '#3B82F6',
  accentSoft: 'rgba(59,130,246,0.15)',
  success: 'rgba(52,211,153,0.9)',
  successSoft: 'rgba(52,211,153,0.12)',
  error: '#f87171',
  errorSoft: 'rgba(248,113,113,0.1)',
  // Spacing
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const,
  // Radius
  radius: { sm: 8, md: 12, lg: 16, pill: 9999 } as const,
}

function selectableStyle(selected: boolean, hovered = false): React.CSSProperties {
  return {
    background: selected ? S.surfaceActive : hovered ? S.surfaceHover : S.surface,
    border: `1px solid ${selected ? S.borderActive : hovered ? S.borderHover : S.border}`,
    color: selected ? S.text : S.muted,
    transition: 'all 0.15s',
    cursor: 'pointer',
  }
}

// ─── Reusable UI primitives ───────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      style={{
        position: 'relative', width: 44, height: 24, borderRadius: 12,
        background: value ? '#ffffff' : 'rgba(255,255,255,0.12)',
        transition: 'background 0.2s', flexShrink: 0, border: 'none', outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9,
        background: value ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
        left: value ? 23 : 3, transition: 'left 0.2s, background 0.2s',
      }} />
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 10, color: S.muted, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: S.gap.sm }}>{children}</p>
}

function SliderRow({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.gap.sm }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Label>{label}</Label>
        <span style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: S.accent, height: 3 }} />
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius.lg, padding: S.gap.lg, ...style }}>
      {children}
    </div>
  )
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: S.gap.sm, width: '100%',
          padding: `${S.gap.sm}px 0`, background: 'none', border: 'none', cursor: 'pointer',
          color: S.muted, fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em',
        }}
      >
        <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
        {title}
      </button>
      {open && <div style={{ paddingTop: S.gap.md }}>{children}</div>}
    </div>
  )
}

function useHover() {
  const [hovered, setHovered] = useState(false)
  return { hovered, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
}

function NavButton({ onClick, disabled, variant, children }: {
  onClick: () => void
  disabled?: boolean
  variant: 'back' | 'next' | 'export' | 'deliver'
  children: React.ReactNode
}) {
  const { hovered, onMouseEnter, onMouseLeave } = useHover()
  const baseStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px', borderRadius: 14, fontSize: 13, fontWeight: 700,
    transition: 'all 0.15s', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
  const variantStyle: React.CSSProperties =
    variant === 'back' ? {
      padding: '12px 18px', background: hovered ? S.surfaceHover : S.surface,
      border: `1px solid ${hovered ? S.borderHover : S.border}`, color: S.muted,
    } :
    variant === 'next' || variant === 'export' ? {
      flex: 1, background: hovered ? 'rgba(255,255,255,0.88)' : '#fff',
      border: 'none', color: '#0a0a0a',
      boxShadow: hovered ? '0 4px 16px rgba(255,255,255,0.12)' : 'none',
    } :
    {
      padding: '12px', background: hovered ? 'rgba(52,211,153,0.18)' : 'rgba(52,211,153,0.12)',
      border: `1px solid ${hovered ? 'rgba(52,211,153,0.4)' : 'rgba(52,211,153,0.25)'}`,
      color: 'rgb(52,211,153)',
    }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...baseStyle, ...variantStyle }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProcessView({ recordings, themeName, sessionId, themeSlug, montageSettings }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [segments, setSegments] = useState<CompositionSegment[] | null>(null)
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [ready, setReady] = useState(false)
  const [voices, setVoices] = useState<Voice[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('KSyQzmsYhFbuOhqj1Xxv')
  const [format, setFormat] = useState<FormatKey>('9/16')
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS)
  const [theme, setTheme] = useState<TransitionTheme>(DEFAULT_TRANSITION_THEME)
  const [intro, setIntro] = useState<IntroSettings>(DEFAULT_INTRO_SETTINGS)
  const [outro, setOutro] = useState<OutroSettings>(DEFAULT_OUTRO_SETTINGS)
  const [motionSettings, setMotionSettings] = useState<MotionSettings>(DEFAULT_MOTION_SETTINGS)
  const [questionCardFrames, setQuestionCardFrames] = useState(QUESTION_CARD_FRAMES)
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({})
  const [generatingSfx, setGeneratingSfx] = useState<{ bgMusic: boolean; transitionSfx: boolean }>({ bgMusic: false, transitionSfx: false })
  const [bgMusicPrompt, setBgMusicPrompt] = useState('upbeat background music for a fast-paced interview video')
  const [transitionSfxPrompt, setTransitionSfxPrompt] = useState('short cinematic whoosh transition sound effect')
  const [sfxLibrary, setSfxLibrary] = useState<{ filename: string; name: string }[]>([])
  const [soundLibrary, setSoundLibrary] = useState<{ id: string; name: string; tag: string; signedUrl: string }[]>([])
  const [localTranscripts, setLocalTranscripts] = useState<Record<string, string>>(() =>
    Object.fromEntries(recordings.map(r => [r.id, r.transcript ?? '']))
  )
  const [wordTimestampsMap, setWordTimestampsMap] = useState<Record<string, WordTimestamp[]>>({})
  const wordTimestampsRef = useRef<Record<string, WordTimestamp[]>>({})
  // Source timestamps = original pre-processing timestamps from transcription.
  // Never overwritten by remapping so we always remap from a clean base.
  const sourceWordTimestampsRef = useRef<Record<string, WordTimestamp[]>>({})
  const [transcribing, setTranscribing] = useState<Record<string, boolean>>({})
  const [silenceCutEnabled, setSilenceCutEnabled] = useState(false)
  const [silenceThreshold, setSilenceThreshold] = useState(-35)
  const [silenceCutError, setSilenceCutError] = useState('')
  const [fillerCutEnabled, setFillerCutEnabled] = useState(false)
  const [fillerCutError, setFillerCutError] = useState('')
  const [cleanvoiceEnabled, setCleanvoiceEnabled] = useState(false)
  const [cleanvoiceConfig, setCleanvoiceConfig] = useState<CleanvoiceConfig>(DEFAULT_CLEANVOICE_CONFIG)
  const [cleanvoiceError, setCleanvoiceError] = useState('')
  const [denoiseEnabled, setDenoiseEnabled] = useState(false)
  const [denoiseStrength, setDenoiseStrength] = useState<'light' | 'moderate' | 'strong' | 'isolate'>('moderate')
  const [smartCutLoading, setSmartCutLoading] = useState(false)
  const [smartCutError, setSmartCutError] = useState('')
  // Cold Open & Visual Inlays
  const [coldOpenEnabled, setColdOpenEnabled] = useState(false)
  const [coldOpenData, setColdOpenData] = useState<{ hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string } | null>(null)
  const [inlaysEnabled, setInlaysEnabled] = useState(false)
  const [inlaysData, setInlaysData] = useState<{ exactWord: string; category: string; timeInSeconds: number; label?: string }[]>([])
  const [coldOpenLoading, setColdOpenLoading] = useState(false)
  const [coldOpenError, setColdOpenError] = useState('')
  const [contextEmojisBySegmentId, setContextEmojisBySegmentId] = useState<Record<string, { startInSeconds: number; endInSeconds: number; emoji: string }[]>>({})
  const [swooshEnabled, setSwooshEnabled] = useState(true)
  const [popSoundEnabled, setPopSoundEnabled] = useState(true)
  // Cold Open style
  const [coldOpenTextColor, setColdOpenTextColor] = useState('#FFFFFF')
  const [coldOpenHighlightColor, setColdOpenHighlightColor] = useState('#FFD60A')
  const [coldOpenFontFamily, setColdOpenFontFamily] = useState("Impact, 'Arial Narrow', sans-serif")
  const [coldOpenFontSize, setColdOpenFontSize] = useState(72)
  const [coldOpenTextPosition, setColdOpenTextPosition] = useState<'bottom' | 'center' | 'top'>('bottom')
  const [coldOpenVideoStyle, setColdOpenVideoStyle] = useState<'bw' | 'desaturated' | 'color' | 'raw'>('desaturated')
  // Inlays style
  const [inlaysStyle, setInlaysStyle] = useState<'pill' | 'minimal' | 'bold'>('pill')
  const [inlaysDuration, setInlaysDuration] = useState(2)
  const [inlaysPopVolume, setInlaysPopVolume] = useState(0.5)
  const [regenerating, setRegenerating] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)

  const [renderOutputUrl, setRenderOutputUrl] = useState<string | null>(null)
  const [delivering, setDelivering] = useState(false)
  const [delivered, setDelivered] = useState(false)
  const [deliverError, setDeliverError] = useState('')

  // Non-destructive clip edits (split/delete)
  const { clipEdits, splitAt, deleteRange, resetClip, undo: undoClipEdit, restore: restoreClipEdits, applyRanges } = useClipEdits()
  const [timelineVisible, setTimelineVisible] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  // Hover states for option grids
  const [hoveredVoiceId, setHoveredVoiceId] = useState<string | null>(null)
  const [hoveredTransStyle, setHoveredTransStyle] = useState<string | null>(null)
  const [hoveredQCardStyle, setHoveredQCardStyle] = useState<string | null>(null)
  const [hoveredQCardTrans, setHoveredQCardTrans] = useState<string | null>(null)
  const [hoveredIntroPreset, setHoveredIntroPreset] = useState<string | null>(null)
  const [hoveredOutroPreset, setHoveredOutroPreset] = useState<string | null>(null)
  const [hoveredFont, setHoveredFont] = useState<string | null>(null)
  const [hoveredDenoiseStrength, setHoveredDenoiseStrength] = useState<string | null>(null)
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)
  const [currentPhase, setCurrentPhase] = useState(0)
  const [phase2Section, setPhase2Section] = useState<'style' | 'bookends' | 'audio' | 'transcripts'>('style')
  const [bookendTarget, setBookendTarget] = useState<'intro' | 'outro'>('intro')

  // Cache for processed assets (S3-backed)
  const [ttsCache, setTtsCache] = useState<Record<string, { voiceId: string; url: string }>>({})
  const [processedCache, setProcessedCache] = useState<Record<string, { hash: string; url: string }>>({})
  // Auto-save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // Responsive
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<'controls' | 'preview'>('controls')
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const localTranscriptsRef = useRef<Record<string, string>>({})
  const serverRendererRef = useRef<ServerRendererHandle | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const soundPreviewAudioRef = useRef<HTMLAudioElement | null>(null)
  const prepareAbortRef = useRef<AbortController | null>(null)
  const saveIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blobUrlsRef = useRef<string[]>([])
  const durationsRef = useRef<number[]>([])
  const effectiveVideoUrlsRef = useRef<string[]>([])
  const lastProcessingHashRef = useRef<string | null>(null)
  const renderOutputUrlRef = useRef<string | null>(null)
  const playerRef = useRef<PlayerRef | null>(null)
  // ref — no re-render on frame change
  const playerFrameRef = useRef(0)
  // Only update state when active SEGMENT changes (not every frame)
  const [activeSegmentInfo, setActiveSegmentInfo] = useState<{ id: string; localTimeSec: number } | null>(null)
  const activeSegIdRef = useRef<string | null>(null)
  const segmentTimelineRef = useRef<{ id: string; startFrame: number; endFrame: number }[]>([])
  const currentStepRef = useRef(0)

  // Revoke render output blob URL on unmount, stop audio, abort in-flight prepare
  useEffect(() => {
    return () => {
      if (renderOutputUrlRef.current) URL.revokeObjectURL(renderOutputUrlRef.current)
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null }
      if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null }
      if (saveIdleTimerRef.current) clearTimeout(saveIdleTimerRef.current)
      prepareAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => { currentStepRef.current = currentStep }, [currentStep])

  useEffect(() => {
    let rafId: number
    const tick = () => {
      const f = (playerRef.current as any)?.getCurrentFrame?.() ?? 0
      playerFrameRef.current = f
      // Compute active segment (used by TranscriptEditor for word highlighting)
      if (true) {
        const tl = segmentTimelineRef.current
        let found: { id: string; localTimeSec: number } | null = null
        for (const seg of tl) {
          if (f >= seg.startFrame && f < seg.endFrame) {
            found = { id: seg.id, localTimeSec: (f - seg.startFrame) / FPS }
            break
          }
        }
        // Only setState when the segment changes — avoids re-renders mid-segment
        if ((found?.id ?? null) !== activeSegIdRef.current) {
          activeSegIdRef.current = found?.id ?? null
          setActiveSegmentInfo(found)
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  useEffect(() => { localTranscriptsRef.current = localTranscripts }, [localTranscripts])
  useEffect(() => { wordTimestampsRef.current = wordTimestampsMap }, [wordTimestampsMap])

  // Restore settings from DB on mount
  useEffect(() => {
    fetchVoices()
    fetch('/api/sfx-library').then(r => r.ok ? r.json() : []).then(setSfxLibrary).catch(() => {})
    fetch('/api/admin/sounds').then(r => r.ok ? r.json() : []).then(setSoundLibrary).catch(() => {})

    // Restore montageSettings if present
    if (montageSettings) {
      const s = montageSettings
      if (s.selectedVoiceId) setSelectedVoiceId(s.selectedVoiceId)
      if (typeof s.voiceEnabled === 'boolean') setVoiceEnabled(s.voiceEnabled)
      if (s.format) setFormat(s.format)
      if (s.subtitleSettings) setSubtitleSettings(s.subtitleSettings)
      if (s.theme) setTheme(s.theme)
      if (s.intro) setIntro(s.intro)
      if (s.outro) setOutro(s.outro)
      if (s.motionSettings) setMotionSettings(s.motionSettings)
      if (s.questionCardFrames) setQuestionCardFrames(s.questionCardFrames)
      if (s.activePresetId !== undefined) setActivePresetId(s.activePresetId)
      if (s.audioSettings) setAudioSettings(s.audioSettings)
      if (s.bgMusicPrompt) setBgMusicPrompt(s.bgMusicPrompt)
      if (s.transitionSfxPrompt) setTransitionSfxPrompt(s.transitionSfxPrompt)
      if (typeof s.silenceCutEnabled === 'boolean') setSilenceCutEnabled(s.silenceCutEnabled)
      if (s.silenceThreshold !== undefined) setSilenceThreshold(s.silenceThreshold)
      if (typeof s.fillerCutEnabled === 'boolean') setFillerCutEnabled(s.fillerCutEnabled)
      if (typeof s.denoiseEnabled === 'boolean') setDenoiseEnabled(s.denoiseEnabled)
      if (s.denoiseStrength) setDenoiseStrength(s.denoiseStrength)
      if (typeof s.cleanvoiceEnabled === 'boolean') setCleanvoiceEnabled(s.cleanvoiceEnabled)
      if (s.cleanvoiceConfig) setCleanvoiceConfig(s.cleanvoiceConfig)
      if (s.localTranscripts) setLocalTranscripts(s.localTranscripts)
      if (s.wordTimestampsMap) setWordTimestampsMap(s.wordTimestampsMap)
      if (s.sourceWordTimestampsMap) sourceWordTimestampsRef.current = s.sourceWordTimestampsMap
      if (s.clipEdits?.length) restoreClipEdits(s.clipEdits)
      if (typeof s.coldOpenEnabled === 'boolean') setColdOpenEnabled(s.coldOpenEnabled)
      if (s.coldOpenData) setColdOpenData(s.coldOpenData)
      if (typeof s.inlaysEnabled === 'boolean') setInlaysEnabled(s.inlaysEnabled)
      if (s.inlaysData?.length) setInlaysData(s.inlaysData)
      if (typeof s.swooshEnabled === 'boolean') setSwooshEnabled(s.swooshEnabled)
      if (typeof s.popSoundEnabled === 'boolean') setPopSoundEnabled(s.popSoundEnabled)
      if (s.coldOpenTextColor) setColdOpenTextColor(s.coldOpenTextColor)
      if (s.coldOpenHighlightColor) setColdOpenHighlightColor(s.coldOpenHighlightColor)
      if (s.coldOpenFontFamily) setColdOpenFontFamily(s.coldOpenFontFamily)
      if (typeof s.coldOpenFontSize === 'number') setColdOpenFontSize(s.coldOpenFontSize)
      if (s.coldOpenTextPosition) setColdOpenTextPosition(s.coldOpenTextPosition)
      if (s.coldOpenVideoStyle) setColdOpenVideoStyle(s.coldOpenVideoStyle)
      if (s.inlaysStyle) setInlaysStyle(s.inlaysStyle)
      if (typeof s.inlaysDuration === 'number') setInlaysDuration(s.inlaysDuration)
      if (typeof s.inlaysPopVolume === 'number') setInlaysPopVolume(s.inlaysPopVolume)
    }

    // Initialize asset caches from recording DB fields
    const initTts: Record<string, { voiceId: string; url: string }> = {}
    const initProcessed: Record<string, { hash: string; url: string }> = {}
    const initWordTs: Record<string, WordTimestamp[]> = {}
    for (const r of recordings) {
      if (r.ttsAudioKey && r.ttsVoiceId) {
        // Fetch signed URL lazily when needed (stored as S3 key, resolved on demand)
        initTts[r.id] = { voiceId: r.ttsVoiceId, url: '' } // url filled lazily
      }
      if (r.processedVideoKey && r.processingHash) {
        initProcessed[r.id] = { hash: r.processingHash, url: '' } // url filled lazily
      }
      // Pre-load Deepgram word timestamps from DB (only if not already restored from montageSettings)
      if (r.wordTimestamps?.length && !sourceWordTimestampsRef.current[r.id]) {
        initWordTs[r.id] = r.wordTimestamps as WordTimestamp[]
        sourceWordTimestampsRef.current[r.id] = r.wordTimestamps as WordTimestamp[]
      }
    }
    if (Object.keys(initTts).length) setTtsCache(initTts)
    if (Object.keys(initProcessed).length) setProcessedCache(initProcessed)
    if (Object.keys(initWordTs).length) setWordTimestampsMap(prev => ({ ...initWordTs, ...prev }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save settings to DB (debounced 1500ms)
  // useMemo avoids blocking JSON.stringify on every render — only runs when deps change
  const settingsForSave = useMemo(() => JSON.stringify({
    selectedVoiceId, voiceEnabled, format, subtitleSettings, theme, intro, outro,
    motionSettings, questionCardFrames, activePresetId, audioSettings,
    bgMusicPrompt, transitionSfxPrompt, silenceCutEnabled, silenceThreshold,
    fillerCutEnabled, denoiseEnabled, denoiseStrength, cleanvoiceEnabled, cleanvoiceConfig,
    localTranscripts, wordTimestampsMap, clipEdits,
    sourceWordTimestampsMap: sourceWordTimestampsRef.current,
    coldOpenEnabled, coldOpenData, inlaysEnabled, inlaysData, swooshEnabled, popSoundEnabled,
    coldOpenTextColor, coldOpenHighlightColor, coldOpenFontFamily, coldOpenFontSize, coldOpenTextPosition, coldOpenVideoStyle,
    inlaysStyle, inlaysDuration, inlaysPopVolume,
  }), [
    selectedVoiceId, voiceEnabled, format, subtitleSettings, theme, intro, outro,
    motionSettings, questionCardFrames, activePresetId, audioSettings,
    bgMusicPrompt, transitionSfxPrompt, silenceCutEnabled, silenceThreshold,
    fillerCutEnabled, denoiseEnabled, denoiseStrength, cleanvoiceEnabled, cleanvoiceConfig,
    localTranscripts, wordTimestampsMap, clipEdits,
    coldOpenEnabled, coldOpenData, inlaysEnabled, inlaysData, swooshEnabled, popSoundEnabled,
    coldOpenTextColor, coldOpenHighlightColor, coldOpenFontFamily, coldOpenFontSize, coldOpenTextPosition, coldOpenVideoStyle,
    inlaysStyle, inlaysDuration, inlaysPopVolume,
  ])
  const settingsForSaveRef = useRef(settingsForSave)
  useEffect(() => {
    if (settingsForSave === settingsForSaveRef.current) return
    settingsForSaveRef.current = settingsForSave
    setSaveStatus('saving')
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/sessions/${sessionId}/montage-settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ montageSettings: JSON.parse(settingsForSaveRef.current) }),
        })
        setSaveStatus(res.ok ? 'saved' : 'error')
        if (res.ok) { saveIdleTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500) }
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
    return () => clearTimeout(timeout)
  }, [settingsForSave]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchVoices = async () => {
    try { const res = await fetch('/api/tts/voices'); if (res.ok) setVoices(await res.json()) } catch {}
  }

  const generateSfx = async (type: 'bgMusic' | 'transitionSfx', prompt: string) => {
    setGeneratingSfx(p => ({ ...p, [type]: true }))
    try {
      const res = await fetch('/api/sfx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt, durationSeconds: type === 'bgMusic' ? 22 : 3 }),
      })
      if (!res.ok) return
      const { id } = await res.json()
      const url = `${window.location.origin}/api/sfx-asset/${id}`
      setAudioSettings(p => ({
        ...p,
        [type]: { prompt, url, volume: type === 'bgMusic' ? 0.25 : 0.8 },
      }))
    } finally {
      setGeneratingSfx(p => ({ ...p, [type]: false }))
    }
  }

  // Fetch a signed URL for a cached recording asset
  const getCachedUrl = async (recordingId: string, type: 'tts' | 'processed'): Promise<string | null> => {
    try {
      const endpoint = type === 'tts' ? 'tts-url' : 'processed-url'
      const res = await fetch(`/api/admin/recordings/${recordingId}/${endpoint}?sessionId=${sessionId}`)
      if (!res.ok) return null
      const data = await res.json()
      return typeof data === 'string' ? data : null
    } catch { return null }
  }

  // Upload a processed asset to S3 via NestJS — server fetches the URL directly,
  // so the browser never holds large video bytes in memory.
  const uploadToCache = async (
    recordingId: string,
    sourceUrl: string,
    type: 'tts' | 'processed',
    extra: { voiceId?: string; processingHash?: string },
  ) => {
    try {
      const params = new URLSearchParams({ sessionId, type })
      if (extra.voiceId) params.set('voiceId', extra.voiceId)
      if (extra.processingHash) params.set('processingHash', extra.processingHash)
      const endpoint = `/api/admin/recordings/${recordingId}/cache?${params}`

      if (sourceUrl.startsWith('blob:')) {
        // blob: URLs are browser-only — fetch the bytes locally and send as multipart
        const blobRes = await fetch(sourceUrl)
        const blob = await blobRes.blob()
        const form = new FormData()
        form.append('file', blob, type === 'tts' ? 'audio.mp3' : 'video.mp4')
        form.append('type', type)
        if (extra.voiceId) form.append('voiceId', extra.voiceId)
        if (extra.processingHash) form.append('processingHash', extra.processingHash)
        await fetch(endpoint, { method: 'POST', body: form })
      } else {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceUrl, type, ...extra }),
        })
      }
    } catch (e) { console.warn('[cache] upload failed', e) }
  }

  const prepare = async (voiceId: string | null) => {
    prepareAbortRef.current?.abort()
    const abortCtrl = new AbortController()
    prepareAbortRef.current = abortCtrl

    setSilenceCutError('')
    setFillerCutError('')
    setCleanvoiceError('')

    const currentProcessingHash = cleanvoiceEnabled
      ? `cv-${JSON.stringify(cleanvoiceConfig)}`
      : `${silenceCutEnabled}-${silenceThreshold}-${fillerCutEnabled}-${denoiseEnabled}-${denoiseStrength}`

    const processingChanged = lastProcessingHashRef.current !== currentProcessingHash

    if (effectiveVideoUrlsRef.current.length === 0 || processingChanged) {
      effectiveVideoUrlsRef.current = []; durationsRef.current = []

      for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i]
        // Check processed video cache
        const cachedProcessed = processedCache[rec.id]
        if (cachedProcessed?.hash === currentProcessingHash && cachedProcessed.url) {
          console.log(`[cache] using cached processed video for recording ${rec.id}`)
          effectiveVideoUrlsRef.current.push(cachedProcessed.url)
          durationsRef.current.push(await getVideoDuration(cachedProcessed.url))
          continue
        }
        // If we have a cached entry with empty url, fetch the signed URL
        if (cachedProcessed?.hash === currentProcessingHash && !cachedProcessed.url) {
          const signedUrl = await getCachedUrl(rec.id, 'processed')
          if (signedUrl) {
            setProcessedCache(p => ({ ...p, [rec.id]: { hash: currentProcessingHash, url: signedUrl } }))
            console.log(`[cache] resolved processed URL for recording ${rec.id}`)
            effectiveVideoUrlsRef.current.push(signedUrl)
            durationsRef.current.push(await getVideoDuration(signedUrl))
            continue
          }
        }

        let realUrl = rec.videoUrl

        // Reset display timestamps to source (original pre-processing) so each run
        // remaps from a clean base, preventing double-remapping on settings change.
        const srcTs = sourceWordTimestampsRef.current[rec.id]
        if (srcTs?.length) wordTimestampsRef.current[rec.id] = srcTs

        if (cleanvoiceEnabled) {
          setLoadingStep(`Cleanvoice ${i+1}/${recordings.length}...`)
          try {
            // Step 1: submit the job (fast, < 120s including optional WebM conversion)
            const submitRes = await fetch('/api/cleanvoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl: realUrl, config: cleanvoiceConfig }),
            })
            if (!submitRes.ok) {
              setCleanvoiceError(await submitRes.text())
            } else {
              const { cleanvoiceJobId, id } = await submitRes.json()
              // Step 2: poll /api/cleanvoice/status until done (each call is < 30s)
              let done = false
              for (let attempt = 0; attempt < 120 && !done && !abortCtrl.signal.aborted; attempt++) {
                await new Promise<void>((res) => {
                  const t = setTimeout(res, 5000)
                  abortCtrl.signal.addEventListener('abort', () => { clearTimeout(t); res() }, { once: true })
                })
                if (abortCtrl.signal.aborted) break
                setLoadingStep(`Cleanvoice ${i+1}/${recordings.length} (${Math.round((attempt+1)*5)}s)...`)
                const statusRes = await fetch(`/api/cleanvoice/status?jobId=${cleanvoiceJobId}&id=${id}`, { signal: abortCtrl.signal })
                if (!statusRes.ok) { setCleanvoiceError(await statusRes.text()); break }
                const data = await statusRes.json()
                if (data.done) {
                  done = true
                  if (data.error) {
                    setCleanvoiceError(data.error)
                  } else if (data.id) {
                    realUrl = `${window.location.origin}/api/cleanvoice/${data.id}`
                    if (data.wordTimestamps?.length) {
                      setWordTimestampsMap(prev => ({ ...prev, [rec.id]: data.wordTimestamps }))
                      wordTimestampsRef.current[rec.id] = data.wordTimestamps
                    }
                  }
                }
              }
              if (!done) setCleanvoiceError('Cleanvoice timeout — vidéo trop longue pour être traitée dans le délai imparti')
            }
          } catch { setCleanvoiceError('Cleanvoice échoué') }

          // Fallback: normalize WebM to MP4 if Cleanvoice didn't update realUrl
          // (ensures correct duration metadata and smooth playback regardless of source format)
          if (realUrl === rec.videoUrl) {
            try {
              const res = await fetch('/api/normalize-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl }) })
              if (res.ok) { const d = await res.json(); if (d.normalized && d.id) realUrl = `${window.location.origin}/api/normalize-video/${d.id}` }
            } catch {}
          }
        } else {
          if (silenceCutEnabled) {
            setLoadingStep(`Coupure silences ${i+1}/${recordings.length}...`)
            try {
              const res = await fetch('/api/silence-cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl, threshold: silenceThreshold }) })
              if (res.ok) {
                const { id, keepIntervals } = await res.json()
                realUrl = `${window.location.origin}/api/silence-cut/${id}`
                if (keepIntervals?.length && wordTimestampsRef.current[rec.id]?.length) {
                  const remapped = remapWordTimestamps(wordTimestampsRef.current[rec.id], keepIntervals)
                  setWordTimestampsMap(prev => ({ ...prev, [rec.id]: remapped }))
                  wordTimestampsRef.current[rec.id] = remapped
                }
              } else setSilenceCutError(await res.text())
            } catch { setSilenceCutError('Coupure silences échouée') }
          } else {
            setLoadingStep(`Traitement vidéo ${i+1}/${recordings.length}...`)
            try {
              const res = await fetch('/api/normalize-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl }) })
              if (res.ok) { const d = await res.json(); if (d.normalized && d.id) realUrl = `${window.location.origin}/api/normalize-video/${d.id}` }
            } catch {}
          }

          if (fillerCutEnabled) {
            setLoadingStep(`Suppression tics de langage ${i+1}/${recordings.length}...`)
            try {
              const res = await fetch('/api/filler-cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl }) })
              if (res.ok) {
                const { id, wordTimestamps } = await res.json()
                if (id) {
                  realUrl = `${window.location.origin}/api/filler-cut/${id}`
                  if (wordTimestamps?.length) {
                    setWordTimestampsMap(prev => ({ ...prev, [rec.id]: wordTimestamps }))
                    wordTimestampsRef.current[rec.id] = wordTimestamps
                  }
                }
              } else setFillerCutError(await res.text())
            } catch { setFillerCutError('Suppression tics échouée') }
          }

          if (denoiseEnabled) {
            setLoadingStep(`Réduction bruit ${i+1}/${recordings.length}...`)
            try {
              const res = await fetch('/api/denoise-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl, strength: denoiseStrength }) })
              if (res.ok) { const { id } = await res.json(); realUrl = `${window.location.origin}/api/denoise-video/${id}` }
            } catch {}
          }
        }

        // Upload processed video to S3 cache and swap to stable S3 URL for the Player.
        // /tmp URLs are ephemeral — if the file is purged before the Player loads, video is black.
        let stableUrl = realUrl
        if (realUrl.includes('/api/normalize-video/') || realUrl.includes('/api/silence-cut/') || realUrl.includes('/api/denoise-video/') || realUrl.includes('/api/filler-cut/')) {
          try {
            await uploadToCache(rec.id, realUrl, 'processed', { processingHash: currentProcessingHash })
            const s3Url = await getCachedUrl(rec.id, 'processed')
            if (s3Url) {
              stableUrl = s3Url
              setProcessedCache(p => ({ ...p, [rec.id]: { hash: currentProcessingHash, url: s3Url } }))
            }
          } catch {}
        } else {
          setProcessedCache(p => ({ ...p, [rec.id]: { hash: currentProcessingHash, url: realUrl } }))
          uploadToCache(rec.id, realUrl, 'processed', { processingHash: currentProcessingHash })
        }

        effectiveVideoUrlsRef.current.push(stableUrl)
        const dur = await getVideoDuration(stableUrl)
        console.log(`[prepare] recording ${rec.id} duration=${dur}s url=${stableUrl}`)
        durationsRef.current.push(dur)
      }
      lastProcessingHashRef.current = currentProcessingHash
    }

    const ttsUrls: (string | null)[] = []
    if (voiceId) {
      for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i]
        const cachedTts = ttsCache[rec.id]
        if (cachedTts?.voiceId === voiceId && cachedTts.url) {
          console.log(`[cache] using cached TTS for recording ${rec.id}`)
          ttsUrls.push(cachedTts.url)
          continue
        }
        if (cachedTts?.voiceId === voiceId && !cachedTts.url) {
          const signedUrl = await getCachedUrl(rec.id, 'tts')
          if (signedUrl) {
            // Use same-origin proxy URL to avoid S3 CORS issues in Remotion player
            const proxyUrl = `/api/admin/recordings/${rec.id}/tts-audio?sessionId=${sessionId}`
            setTtsCache(p => ({ ...p, [rec.id]: { voiceId, url: proxyUrl } }))
            console.log(`[cache] resolved TTS URL for recording ${rec.id}`)
            ttsUrls.push(proxyUrl)
            continue
          }
        }

        setLoadingStep(`Voix IA ${i+1}/${recordings.length}...`)
        const ttsUrl = await generateTTS(rec.questionText, voiceId)
        ttsUrls.push(ttsUrl)

        if (ttsUrl) {
          setTtsCache(p => {
            const old = p[rec.id]
            if (old?.url?.startsWith('blob:')) URL.revokeObjectURL(old.url)
            return { ...p, [rec.id]: { voiceId, url: ttsUrl } }
          })
          uploadToCache(rec.id, ttsUrl, 'tts', { voiceId })
        }
      }
    } else {
      ttsUrls.push(...recordings.map(() => null))
    }

    const ttsDurations = await Promise.all(ttsUrls.map(u => u ? getAudioDuration(u) : Promise.resolve(4)))
    const built: CompositionSegment[] = recordings.map((rec, i) => {
      const ttsSecs = ttsDurations[i]
      return {
        id: rec.id, questionText: rec.questionText, videoUrl: effectiveVideoUrlsRef.current[i],
        transcript: localTranscriptsRef.current[rec.id] ?? rec.transcript,
        wordTimestamps: wordTimestampsRef.current[rec.id],
        videoDurationFrames: Math.max(Math.ceil((isFinite(durationsRef.current[i]) && durationsRef.current[i] > 0 && durationsRef.current[i] < 3600 ? durationsRef.current[i] : 120) * FPS), FPS),
        ttsUrl: ttsUrls[i],
        questionDurationFrames: Math.max(Math.ceil((ttsSecs + 0.5) * FPS), 3 * FPS),
      }
    })
    setSegments(built); setReady(true)
  }
  const [prepareError, setPrepareError] = useState('')
  const applyVoice = async () => {
    setPrepareError('')
    setRegenerating(true); setReady(false)
    try {
      await prepare(voiceEnabled ? selectedVoiceId : null)
    } catch (e) {
      setPrepareError(String(e))
    } finally {
      setRegenerating(false)
    }
  }

  const previewVoice = async (voice: Voice) => {
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null }
    if (previewingVoiceId === voice.id) { setPreviewingVoiceId(null); return }
    setPreviewingVoiceId(voice.id)

    let previewSrc = voice.previewUrl
    if (!previewSrc) {
      // MiniMax voices have no previewUrl — generate live TTS sample
      const sampleUrl = await generateTTS('Bonjour, je suis votre voix IA pour vos vidéos.', voice.id)
      if (!sampleUrl) { setPreviewingVoiceId(null); return }
      previewSrc = sampleUrl
    }

    const audio = new Audio(previewSrc); previewAudioRef.current = audio
    audio.onended = () => setPreviewingVoiceId(null); audio.play()
  }

  const runSmartMontage = async () => {
    if (!ready || !segments?.length) {
      setSmartCutError('Lance d\'abord la préparation (bouton "Préparer") pour charger les vidéos.')
      return
    }
    setSmartCutLoading(true)
    setSmartCutError('')
    try {
      for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i]
        const transcript = localTranscriptsRef.current[rec.id] ?? rec.transcript ?? ''
        // Use timestamps from segments (already in effective-video timebase after prepare())
        const wts = segments[i]?.wordTimestamps ?? wordTimestampsRef.current[rec.id] ?? []
        if (!transcript) continue

        const duration = durationsRef.current[i]
        if (!duration || !isFinite(duration)) continue

        const res = await fetch('/api/smart-cut', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, wordTimestamps: wts, duration }),
        })
        if (!res.ok) {
          setSmartCutError(await res.text())
          return
        }
        const { segments: smartSegs } = await res.json()
        if (!smartSegs?.length) continue

        // Convert time segments (relative to effective video) to frame ranges
        const ranges = smartSegs.map((s: { start: number; end: number }) => ({
          startFrame: Math.round(s.start * FPS),
          endFrame: Math.round(s.end * FPS),
        }))
        applyRanges(rec.id, ranges)
      }
    } catch (e: any) {
      setSmartCutError(e?.message ?? 'Erreur smart cut')
    } finally {
      setSmartCutLoading(false)
    }
  }

  const runColdOpenAnalysis = async () => {
    if (!ready || !segments?.length) {
      setColdOpenError('Lance d\'abord la préparation (bouton "Préparer") pour charger les vidéos.')
      return
    }
    setColdOpenLoading(true)
    setColdOpenError('')
    try {
      // Use effectiveSegments (post-cut, remapped timestamps) not raw segments
      const segsWithTranscript = (effectiveSegments ?? segments ?? []).filter(s => s.transcript)
      if (!segsWithTranscript.length) {
        setColdOpenError('Aucune transcription trouvée.')
        return
      }

      // First segment → cold open + inlays (single hook for the whole video)
      const firstSeg = segsWithTranscript[0]
      const firstWts = firstSeg.wordTimestamps ?? wordTimestampsRef.current[firstSeg.id] ?? []
      const firstRes = await fetch('/api/cold-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: firstSeg.transcript, wordTimestamps: firstWts, segmentId: firstSeg.id, videoDurationSeconds: firstSeg.videoDurationFrames / FPS }),
      })
      if (!firstRes.ok) { setColdOpenError(await firstRes.text()); return }
      const firstData = await firstRes.json()
      if (firstData.coldOpen) { setColdOpenData(firstData.coldOpen); setColdOpenEnabled(true) }
      if (firstData.inlays?.length) { setInlaysData(firstData.inlays); setInlaysEnabled(true) }

      // All segments → context emojis (parallel, per-segment timestamps)
      const emojiResults = await Promise.all(
        segsWithTranscript.map(async seg => {
          const wts = seg.wordTimestamps ?? wordTimestampsRef.current[seg.id] ?? []
          try {
            const res = await fetch('/api/cold-open', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transcript: seg.transcript, wordTimestamps: wts, segmentId: seg.id, videoDurationSeconds: seg.videoDurationFrames / FPS }),
            })
            if (!res.ok) return { segId: seg.id, emojis: [] }
            const data = await res.json()
            return { segId: seg.id, emojis: data.contextEmojis ?? [] }
          } catch { return { segId: seg.id, emojis: [] } }
        }),
      )

      const newMap: Record<string, { startInSeconds: number; endInSeconds: number; emoji: string }[]> = {}
      for (const { segId, emojis } of emojiResults) {
        if (emojis.length) newMap[segId] = emojis
      }
      if (Object.keys(newMap).length) {
        setContextEmojisBySegmentId(newMap)
        setSubtitleSettings(p => ({ ...p, animatedEmojis: true }))
      }
    } catch (e: any) {
      setColdOpenError(e?.message ?? 'Erreur analyse cold open')
    } finally {
      setColdOpenLoading(false)
    }
  }

  const updateTranscript = (recordingId: string, text: string, fromApi = false) => {
    setLocalTranscripts(p => ({ ...p, [recordingId]: text }))
    setSegments(prev => prev ? prev.map(seg =>
      seg.id === recordingId ? { ...seg, transcript: text || null } : seg
    ) : prev)
    if (!fromApi) {
      // Clear word timestamps so subtitle words reflect the edited text (uniform timing)
      setWordTimestampsMap(p => { const n = { ...p }; delete n[recordingId]; return n })
      wordTimestampsRef.current[recordingId] = []
      sourceWordTimestampsRef.current[recordingId] = []
    }
  }

  const regenerateTranscript = async (recording: RawRecording) => {
    setTranscribing(p => ({ ...p, [recording.id]: true }))
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: recording.videoUrl }),
      })
      if (res.ok) {
        const { transcript, wordTimestamps } = await res.json()
        updateTranscript(recording.id, transcript, true)
        if (wordTimestamps?.length) {
          setWordTimestampsMap(p => ({ ...p, [recording.id]: wordTimestamps }))
          sourceWordTimestampsRef.current[recording.id] = wordTimestamps
          setSegments(prev => prev ? prev.map(seg =>
            seg.id === recording.id ? { ...seg, wordTimestamps } : seg
          ) : prev)
        }
      } else {
        const err = await res.text()
        console.error('[transcribe] error:', err)
      }
    } catch (e) {
      console.error('[transcribe] fetch error:', e)
    } finally {
      setTranscribing(p => ({ ...p, [recording.id]: false }))
    }
  }

  const introFrames = intro.enabled && intro.hookText ? Math.round(intro.durationSeconds * FPS) : 0
  const outroFrames = outro.enabled && (outro.ctaText || outro.subText || outro.logoUrl) ? Math.round(outro.durationSeconds * FPS) : 0

  // ─── Apply clip edits to produce effective segments for the Player ──────────
  const effectiveSegments = useMemo(() => {
    if (!segments?.length) return segments
    // Inject per-segment contextEmojis regardless of clip edits
    const withEmojis = segments.map(seg => {
      const emojis = contextEmojisBySegmentId[seg.id]
      return emojis ? { ...seg, contextEmojis: emojis } : seg
    })
    if (!clipEdits.length) return withEmojis
    return withEmojis.map(seg => {
      const edit = clipEdits.find(e => e.recordingId === seg.id)
      if (!edit || edit.visibleRanges.length === 0) return seg

      const totalVisibleFrames = edit.visibleRanges.reduce((a, r) => a + (r.endFrame - r.startFrame), 0)
      // Remap word timestamps to match visible ranges
      let remappedWts = seg.wordTimestamps
      if (seg.wordTimestamps?.length) {
        const keepIntervals = edit.visibleRanges.map(r => ({
          start: r.startFrame / FPS,
          end: r.endFrame / FPS,
        }))
        remappedWts = remapWordTimestamps(seg.wordTimestamps, keepIntervals)
      }

      return {
        ...seg,
        videoDurationFrames: totalVisibleFrames,
        wordTimestamps: remappedWts,
        visibleRanges: edit.visibleRanges,
      }
    })
  }, [segments, clipEdits, contextEmojisBySegmentId])

  // Maps each recording to its global frame range in the composition
  // Uses effectiveSegments so the RAF playhead tracking matches the Player
  const segmentTimeline = useMemo(() => {
    if (!effectiveSegments?.length) return []
    let offset = introFrames
    return effectiveSegments.map(seg => {
      const qf = seg.questionDurationFrames ?? QUESTION_CARD_FRAMES
      const start = offset + qf
      const end = start + seg.videoDurationFrames
      offset = end
      return { id: seg.id, startFrame: start, endFrame: end }
    })
  }, [effectiveSegments, introFrames])
  useEffect(() => { segmentTimelineRef.current = segmentTimeline }, [segmentTimeline])
  // Merge coldOpen & inlays data into motionSettings for Remotion
  const effectiveMotionSettings = useMemo(() => {
    const ms = { ...motionSettings }
    if (coldOpenEnabled && coldOpenData) {
      ms.coldOpen = {
        enabled: true,
        hookPhrase: coldOpenData.hookPhrase,
        startInSeconds: coldOpenData.startInSeconds,
        endInSeconds: coldOpenData.endInSeconds,
        segmentId: coldOpenData.segmentId,
        swooshEnabled,
        textColor: coldOpenTextColor,
        highlightColor: coldOpenHighlightColor,
        fontFamily: coldOpenFontFamily,
        fontSize: coldOpenFontSize,
        textPosition: coldOpenTextPosition,
        videoStyle: coldOpenVideoStyle,
      }
    }
    if (inlaysEnabled && inlaysData.length > 0) {
      ms.inlays = {
        enabled: true,
        inlays: inlaysData.map(d => ({ exactWord: d.exactWord, category: d.category as any, timeInSeconds: d.timeInSeconds, label: d.label })),
        popSoundEnabled,
        popVolume: inlaysPopVolume,
        duration: inlaysDuration,
        style: inlaysStyle,
      }
    }
    return ms
  }, [motionSettings, coldOpenEnabled, coldOpenData, inlaysEnabled, inlaysData, swooshEnabled, popSoundEnabled,
      coldOpenTextColor, coldOpenHighlightColor, coldOpenFontFamily, coldOpenFontSize, coldOpenTextPosition, coldOpenVideoStyle,
      inlaysStyle, inlaysDuration, inlaysPopVolume])

  const coldOpenFrames = coldOpenEnabled && coldOpenData
    ? Math.round((coldOpenData.endInSeconds - coldOpenData.startInSeconds) * FPS)
    : 0

  const totalFramesBase = effectiveSegments?.length
    ? Math.max(introFrames + outroFrames + END_CARD_FRAMES + effectiveSegments.reduce((a, s) => a + (s.questionDurationFrames ?? questionCardFrames) + s.videoDurationFrames, 0), 1)
    : 1
  const totalFrames = totalFramesBase + coldOpenFrames

  const selectedVoice = voices.find(v => v.id === selectedVoiceId)

  // ─── Split handler for Timeline ─────────────────────────────────────────────
  const handleTimelineSplit = useCallback((recordingId: string, frameInClip: number) => {
    const seg = segments?.find(s => s.id === recordingId)
    if (!seg) return
    splitAt(recordingId, frameInClip, seg.videoDurationFrames)
  }, [segments, splitAt])

  // ─── Step renderers ────────────────────────────────────────────────────────

  const stepVoice = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Cleanvoice — unified processing */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: cleanvoiceEnabled ? 20 : 0 }}>
          <div>
            <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Nettoyage audio IA</p>
            <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Nettoyage audio complet en une passe (remplace silences, tics, bruit)</p>
          </div>
          <Toggle value={cleanvoiceEnabled} onChange={setCleanvoiceEnabled} />
        </div>
        {cleanvoiceEnabled && (
          <Section title="Options Cleanvoice" defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { key: 'fillers',      label: 'Tics de langage',    desc: '"euh", "hm", "bah"…' },
                { key: 'hesitations',  label: 'Hésitations',        desc: 'Allongements de mots' },
                { key: 'stutters',     label: 'Bégaiements',        desc: 'Répétitions de syllabes' },
                { key: 'muted',        label: 'Sons muets',         desc: 'Bruits de bouche silencieux' },
                { key: 'long_silences',label: 'Silences longs',     desc: 'Remplace silence-cut' },
                { key: 'mouth_sounds', label: 'Bruits de bouche',   desc: 'Claquements, salive…' },
                { key: 'breath',       label: 'Respirations',       desc: 'Souffles audibles' },
                { key: 'remove_noise', label: 'Réduction de bruit', desc: 'Bruit de fond ambiant' },
                { key: 'normalize',    label: 'Normalisation',      desc: 'Volume uniforme (LUFS -16)' },
              ] as { key: keyof CleanvoiceConfig; label: string; desc: string }[]).map(opt => (
                <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: S.radius.sm, border: `1px solid ${S.border}` }}>
                  <div>
                    <span style={{ color: S.text, fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
                    <span style={{ color: S.muted, fontSize: 11, marginLeft: 8 }}>{opt.desc}</span>
                  </div>
                  <Toggle
                    value={!!cleanvoiceConfig[opt.key]}
                    onChange={v => setCleanvoiceConfig(p => ({ ...p, [opt.key]: v }))}
                    label={opt.label}
                  />
                </div>
              ))}
              {/* Studio Sound */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(139,92,246,0.06)', borderRadius: S.radius.sm, border: '1px solid rgba(139,92,246,0.2)' }}>
                <div>
                  <span style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 500 }}>Studio Sound</span>
                  <span style={{ color: S.muted, fontSize: 11, marginLeft: 8 }}>Rehaussement qualité pro</span>
                </div>
                <Toggle
                  value={cleanvoiceConfig.studio_sound === 'nightly'}
                  onChange={v => setCleanvoiceConfig(p => ({ ...p, studio_sound: v ? 'nightly' : false }))}
                  label="Studio Sound"
                />
              </div>
              {cleanvoiceError && <p style={{ color: S.error, fontSize: 11, fontFamily: 'monospace' }}>{cleanvoiceError}</p>}
            </div>
          </Section>
        )}
      </Card>

      {/* Legacy options — only shown when Cleanvoice is OFF */}
      {!cleanvoiceEnabled && (
        <>
          {/* Silence cut */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: silenceCutEnabled ? 16 : 0 }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Couper les silences</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Supprime les pauses dans les clips</p>
              </div>
              <Toggle value={silenceCutEnabled} onChange={setSilenceCutEnabled} />
            </div>
            {silenceCutEnabled && (
              <SliderRow label="Sensibilité" value={silenceThreshold} min={-55} max={-20} step={5}
                format={v => v >= -25 ? 'Agressive' : v >= -38 ? 'Modérée' : 'Légère'}
                onChange={setSilenceThreshold}
              />
            )}
            {silenceCutError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{silenceCutError}</p>}
          </Card>

          {/* Filler cut */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Couper les tics de langage</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Supprime les "euh", "hm", "bah"…</p>
              </div>
              <Toggle value={fillerCutEnabled} onChange={setFillerCutEnabled} />
            </div>
            {fillerCutError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{fillerCutError}</p>}
          </Card>

          {/* Auto-montage IA */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Auto-montage IA</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Gemini analyse la transcription et coupe automatiquement</p>
              </div>
              <button
                onClick={runSmartMontage}
                disabled={smartCutLoading}
                style={{
                  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: smartCutLoading ? 'not-allowed' : 'pointer',
                  background: smartCutLoading ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)',
                  border: '1px solid rgba(139,92,246,0.5)',
                  color: '#c4b5fd',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: smartCutLoading ? 0.7 : 1,
                }}
              >
                {smartCutLoading
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Analyse...</>
                  : '✂ Lancer'}
              </button>
            </div>
            {smartCutError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{smartCutError}</p>}
          </Card>

          {/* Cold Open & Visual Inlays */}
          <Card>
            {/* Header + Analyse button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Cold Open & Incrustations</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Gemini extrait l'accroche et les mots-clés visuels</p>
              </div>
              <button
                onClick={runColdOpenAnalysis}
                disabled={coldOpenLoading}
                style={{
                  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: coldOpenLoading ? 'not-allowed' : 'pointer',
                  background: coldOpenLoading ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.15)',
                  border: '1px solid rgba(249,115,22,0.5)',
                  color: '#fdba74',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: coldOpenLoading ? 0.7 : 1,
                }}
              >
                {coldOpenLoading
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Analyse...</>
                  : '🎬 Analyser'}
              </button>
            </div>
            {coldOpenError && <p style={{ color: S.error, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{coldOpenError}</p>}

            {coldOpenData && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* ── COLD OPEN SECTION ── */}
                <div style={{ background: S.surface, borderRadius: 12, padding: 14, border: `1px solid ${S.border}` }}>
                  {/* Toggle row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: coldOpenEnabled ? 14 : 0 }}>
                    <div>
                      <p style={{ color: S.text, fontSize: 13, fontWeight: 600 }}>🎬 Accroche (Cold Open)</p>
                      <p style={{ color: S.dim, fontSize: 10, marginTop: 2 }}>
                        {coldOpenData.startInSeconds.toFixed(1)}s → {coldOpenData.endInSeconds.toFixed(1)}s
                      </p>
                    </div>
                    <Toggle value={coldOpenEnabled} onChange={setColdOpenEnabled} />
                  </div>

                  {coldOpenEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                      {/* Editable hook phrase */}
                      <div>
                        <Label>Phrase d'accroche</Label>
                        <input
                          value={coldOpenData.hookPhrase}
                          onChange={e => setColdOpenData(d => d ? { ...d, hookPhrase: e.target.value } : d)}
                          style={{
                            width: '100%', marginTop: 6, padding: '8px 10px',
                            background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`,
                            borderRadius: 8, color: S.text, fontSize: 13,
                            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Timing sliders */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <Label>Début : {coldOpenData.startInSeconds.toFixed(1)}s</Label>
                          <input type="range" min={0} max={Math.max(coldOpenData.endInSeconds - 0.5, 0.5)} step={0.1}
                            value={coldOpenData.startInSeconds}
                            onChange={e => setColdOpenData(d => d ? { ...d, startInSeconds: parseFloat(e.target.value) } : d)}
                            style={{ width: '100%', marginTop: 4, accentColor: '#f97316' }}
                          />
                        </div>
                        <div>
                          <Label>Fin : {coldOpenData.endInSeconds.toFixed(1)}s</Label>
                          <input type="range" min={coldOpenData.startInSeconds + 0.5} max={30} step={0.1}
                            value={coldOpenData.endInSeconds}
                            onChange={e => setColdOpenData(d => d ? { ...d, endInSeconds: parseFloat(e.target.value) } : d)}
                            style={{ width: '100%', marginTop: 4, accentColor: '#f97316' }}
                          />
                        </div>
                      </div>

                      {/* Video style */}
                      <div>
                        <Label>Traitement vidéo</Label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                          {(['bw', 'desaturated', 'color', 'raw'] as const).map(vs => (
                            <button key={vs}
                              onClick={() => setColdOpenVideoStyle(vs)}
                              style={{
                                padding: '7px 4px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                textAlign: 'center', cursor: 'pointer',
                                background: coldOpenVideoStyle === vs ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${coldOpenVideoStyle === vs ? 'rgba(249,115,22,0.7)' : S.border}`,
                                color: coldOpenVideoStyle === vs ? '#fdba74' : S.muted,
                              }}
                            >
                              {vs === 'bw' ? 'N&B' : vs === 'desaturated' ? 'Désat.' : vs === 'color' ? 'Couleur' : 'Brut'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Text position */}
                      <div>
                        <Label>Position du texte</Label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                          {(['top', 'center', 'bottom'] as const).map(pos => (
                            <button key={pos}
                              onClick={() => setColdOpenTextPosition(pos)}
                              style={{
                                padding: '7px 4px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                textAlign: 'center', cursor: 'pointer',
                                background: coldOpenTextPosition === pos ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${coldOpenTextPosition === pos ? 'rgba(249,115,22,0.7)' : S.border}`,
                                color: coldOpenTextPosition === pos ? '#fdba74' : S.muted,
                              }}
                            >
                              {pos === 'top' ? '▲ Haut' : pos === 'center' ? '● Centre' : '▼ Bas'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Colors */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <Label>Couleur texte</Label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <input type="color" value={coldOpenTextColor}
                              onChange={e => setColdOpenTextColor(e.target.value)}
                              style={{ width: 36, height: 28, borderRadius: 6, border: `1px solid ${S.border}`, cursor: 'pointer', background: 'transparent' }}
                            />
                            <span style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{coldOpenTextColor}</span>
                          </div>
                        </div>
                        <div>
                          <Label>Couleur accroche</Label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <input type="color" value={coldOpenHighlightColor}
                              onChange={e => setColdOpenHighlightColor(e.target.value)}
                              style={{ width: 36, height: 28, borderRadius: 6, border: `1px solid ${S.border}`, cursor: 'pointer', background: 'transparent' }}
                            />
                            <span style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{coldOpenHighlightColor}</span>
                          </div>
                        </div>
                      </div>

                      {/* Font family */}
                      <div>
                        <Label>Police</Label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 6 }}>
                          {FONT_OPTIONS.map(f => (
                            <button key={f.value}
                              onClick={() => setColdOpenFontFamily(f.value)}
                              style={{
                                padding: '7px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                textAlign: 'center', cursor: 'pointer', fontFamily: f.value,
                                background: coldOpenFontFamily === f.value ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${coldOpenFontFamily === f.value ? 'rgba(249,115,22,0.7)' : S.border}`,
                                color: coldOpenFontFamily === f.value ? '#fdba74' : S.muted,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font size slider */}
                      <div>
                        <Label>Taille texte : {coldOpenFontSize}px</Label>
                        <input type="range" min={36} max={120} step={2}
                          value={coldOpenFontSize}
                          onChange={e => setColdOpenFontSize(parseInt(e.target.value))}
                          style={{ width: '100%', marginTop: 4, accentColor: '#f97316' }}
                        />
                      </div>

                      {/* Swoosh toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ color: S.muted, fontSize: 12 }}>Son de transition (swoosh)</p>
                        <Toggle value={swooshEnabled} onChange={setSwooshEnabled} />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </Card>

          {/* Denoise + ElevenLabs Voice Isolator */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: denoiseEnabled ? 16 : 0 }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Amélioration audio</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>FFmpeg ou Voice Isolator IA (ElevenLabs)</p>
              </div>
              <Toggle value={denoiseEnabled} onChange={setDenoiseEnabled} />
            </div>
            {denoiseEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label>Méthode</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {([
                    { value: 'light',    label: 'Léger',  desc: 'Discret' },
                    { value: 'moderate', label: 'Modéré', desc: 'Recommandé' },
                    { value: 'strong',   label: 'Fort',   desc: 'Agressif' },
                  ] as { value: 'light' | 'moderate' | 'strong'; label: string; desc: string }[]).map(opt => (
                    <button key={opt.value} onClick={() => setDenoiseStrength(opt.value)}
                      onMouseEnter={() => setHoveredDenoiseStrength(opt.value)}
                      onMouseLeave={() => setHoveredDenoiseStrength(null)}
                      style={{
                        padding: '10px 8px', borderRadius: 12, textAlign: 'center',
                        ...selectableStyle(denoiseStrength === opt.value, hoveredDenoiseStrength === opt.value),
                      }}
                    >
                      <p style={{ color: denoiseStrength === opt.value ? S.text : S.muted, fontWeight: 700, fontSize: 12 }}>{opt.label}</p>
                      <p style={{ color: S.dim, fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
                <button onClick={() => setDenoiseStrength('isolate')}
                  style={{
                    padding: '10px 12px', borderRadius: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                    background: denoiseStrength === 'isolate' ? 'rgba(139,92,246,0.15)' : S.surface,
                    border: `1px solid ${denoiseStrength === 'isolate' ? 'rgba(139,92,246,0.6)' : S.border}`,
                  }}
                >
                  <span style={{ fontSize: 16 }}>✨</span>
                  <div>
                    <p style={{ color: denoiseStrength === 'isolate' ? '#c4b5fd' : S.muted, fontWeight: 700, fontSize: 12 }}>Voice Isolator IA</p>
                    <p style={{ color: S.dim, fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>ElevenLabs · Isole la voix, supprime tout le reste</p>
                  </div>
                </button>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Voice toggle */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Voix IA pour les questions</p>
            <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Lit chaque question à voix haute avant l'enregistrement</p>
          </div>
          <Toggle value={voiceEnabled} onChange={setVoiceEnabled} />
        </div>
      </Card>

      {/* Voice selection — only when enabled */}
      {voiceEnabled && voices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>Choisir une voix</Label>
          {voices.map(voice => {
            const isMM = voice.id.startsWith('mm:')
            const isCreator = !isMM && !STANDARD_VOICE_IDS.has(voice.id)
            const selected = selectedVoiceId === voice.id
            return (
              <button key={voice.id} onClick={() => setSelectedVoiceId(voice.id)}
                onMouseEnter={() => setHoveredVoiceId(voice.id)}
                onMouseLeave={() => setHoveredVoiceId(null)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                  ...selectableStyle(selected, hoveredVoiceId === voice.id),
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>{voice.name}</span>
                    {isMM && (
                      <span style={{ fontSize: 9, color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>MiniMax</span>
                    )}
                    {isCreator && (
                      <span style={{ fontSize: 9, color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>Creator</span>
                    )}
                  </div>
                  {(voice.gender || voice.accent) && (
                    <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>{[voice.gender, voice.accent].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); previewVoice(voice) }}
                  style={{ padding: 8, color: previewingVoiceId === voice.id ? '#fff' : S.muted, flexShrink: 0 }}>
                  <Play size={12} style={previewingVoiceId === voice.id ? { opacity: 1 } : {}} />
                </button>
              </button>
            )
          })}
        </div>
      )}

      {/* TTS volume — only when enabled */}
      {voiceEnabled && (
        <Card>
          <SliderRow
            label="Volume voix IA"
            value={audioSettings.ttsVolume ?? 1}
            min={0.1}
            max={2}
            step={0.05}
            format={v => `${Math.round(v * 100)}%`}
            onChange={v => setAudioSettings(p => ({ ...p, ttsVolume: v }))}
          />
          <p style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace', marginTop: 8 }}>
            Ajuste le volume de la voix IA par rapport à la vidéo de l'utilisateur
          </p>
        </Card>
      )}

    </div>
  )
  const stepTranscripts = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <p style={{ color: S.muted, fontSize: 12 }}>
          Les sous-titres sont générés à partir de ces transcriptions. Modifiez-les ou régénérez-les si elles sont vides ou incorrectes.
        </p>
      </Card>
      {recordings.map((rec) => {
        const isTranscribing = !!transcribing[rec.id]
        const text = localTranscripts[rec.id] ?? ''
        const hasText = text.trim().length > 0
        return (
          <Card key={rec.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>
                  {rec.questionText.length > 80 ? rec.questionText.slice(0, 80) + '…' : rec.questionText}
                </p>
                <span style={{
                  display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 20, fontSize: 10,
                  fontFamily: 'monospace',
                  background: hasText ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                  color: hasText ? 'rgb(52,211,153)' : 'rgb(248,113,113)',
                  border: `1px solid ${hasText ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                }}>
                  {hasText ? `${text.split(/\s+/).filter(Boolean).length} mots` : 'Aucun transcript'}
                </span>
              </div>
              <button
                onClick={() => regenerateTranscript(rec)}
                disabled={isTranscribing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', flexShrink: 0,
                  borderRadius: 10, background: isTranscribing ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
                  border: `1px solid ${S.border}`, color: isTranscribing ? S.muted : S.text,
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {isTranscribing
                  ? <><Loader2 size={12} className="animate-spin" /> Transcription...</>
                  : <><RefreshCw size={12} /> Régénérer</>
                }
              </button>
            </div>
            {/* Token view or editable transcript */}
            {(() => {
              const tokens = wordTimestampsMap[rec.id]
              if (tokens?.length) {
                const recId = rec.id
                return (
                  <TranscriptEditor
                    tokens={tokens}
                    getTimeSec={() => {
                      const f = playerFrameRef.current
                      const seg = segmentTimelineRef.current.find(s => s.id === recId)
                      if (!seg || f < seg.startFrame || f >= seg.endFrame) return -1
                      return (f - seg.startFrame) / FPS
                    }}
                    onChange={newTokens => {
                      setWordTimestampsMap(p => ({ ...p, [recId]: newTokens }))
                      wordTimestampsRef.current[recId] = newTokens
                      // Sync transcript text + wordTimestamps into segments so the Player updates immediately
                      const newText = newTokens.map(t => t.word).join(' ')
                      setLocalTranscripts(p => ({ ...p, [recId]: newText }))
                      localTranscriptsRef.current[recId] = newText
                      setSegments(prev => prev ? prev.map(s =>
                        s.id === recId ? { ...s, transcript: newText, wordTimestamps: newTokens } : s
                      ) : prev)
                    }}
                  />
                )
              }
              return (
                <textarea
                  value={text}
                  onChange={e => updateTranscript(rec.id, e.target.value)}
                  placeholder="Pas de transcription — cliquez sur Régénérer pour analyser la vidéo avec Whisper"
                  rows={4}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`,
                    borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 13, outline: 'none',
                    resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit',
                  }}
                />
              )
            })()}
          </Card>
        )
      })}
    </div>
  )


  const applyPreset = (preset: SlidePreset, target: 'intro' | 'outro') => {
    if (preset === 'custom') return
    const config = SLIDE_PRESETS[preset]
    if (target === 'intro') setIntro(p => ({ ...p, ...config, preset }))
    else setOutro(p => ({ ...p, ...config, preset }))
  }

  const PRESET_UI = [
    { id: 'konbini',  label: 'Konbini',   emoji: '🔴', bg: '#FF2D55', accent: '#FFD60A' },
    { id: 'brut',     label: 'Brut',      emoji: '⬛', bg: '#000000', accent: '#FFFFFF' },
    { id: 'magazine', label: 'Magazine',  emoji: '📰', bg: '#F5F0E8', accent: '#1A1209' },
    { id: 'neon',     label: 'Neon',      emoji: '💚', bg: '#0D0D0D', accent: '#00FF88' },
    { id: 'viral',    label: 'Viral',     emoji: '🔥', bg: '#FF6B00', accent: '#FFFFFF' },
    { id: 'minimal',  label: 'Minimal',   emoji: '⬜', bg: '#FFFFFF', accent: '#0A0A0A' },
    { id: 'cinema',    label: 'Cinema',    emoji: '🎬', bg: '#0A0A0A', accent: '#D4AF37' },
    { id: 'retro',     label: 'Rétro',     emoji: '📼', bg: '#1A0A2E', accent: '#FF6EFF' },
    { id: 'editorial', label: 'Editorial', emoji: '📰', bg: '#FAFAFA', accent: '#111111' },
  ] as const

    const introSounds = soundLibrary.filter(s => s.tag === 'INTRO')
  const stepIntro = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: intro.enabled ? 20 : 0 }}>
          <div>
            <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Slide d'introduction</p>
            <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Accroche avant le premier clip</p>
          </div>
          <Toggle value={intro.enabled} onChange={v => setIntro(p => ({ ...p, enabled: v }))} />
        </div>

        {intro.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Presets ── */}
            <div>
              <Label>Style médias</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {PRESET_UI.map(p => {
                  const selected = intro.preset === p.id
                  return (
                    <button key={p.id} onClick={() => applyPreset(p.id as SlidePreset, 'intro')}
                      onMouseEnter={() => setHoveredIntroPreset(p.id)}
                      onMouseLeave={() => setHoveredIntroPreset(null)}
                      style={{
                        padding: '10px 6px', borderRadius: 10, textAlign: 'center',
                        background: selected ? p.bg : hoveredIntroPreset === p.id ? S.surfaceHover : S.surface,
                        border: `2px solid ${selected ? p.accent : hoveredIntroPreset === p.id ? S.borderHover : S.border}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 18, marginBottom: 2 }}>{p.emoji}</div>
                      <div style={{ color: selected ? p.accent : S.muted, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {p.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <Label>Phrase d'accroche</Label>
              <input type="text" placeholder="Ce que personne ne te dit sur..."
                value={intro.hookText} onChange={e => setIntro(p => ({ ...p, hookText: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
              />
            </div>
            <div>
              <Label>URL du logo (optionnel)</Label>
              <input type="text" placeholder="https://..."
                value={intro.logoUrl} onChange={e => setIntro(p => ({ ...p, logoUrl: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
              />
            </div>
            <SliderRow label="Durée" value={intro.durationSeconds} min={2} max={6} step={0.5}
              format={v => `${v}s`} onChange={v => setIntro(p => ({ ...p, durationSeconds: v }))}
            />

            {/* Advanced styling */}
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: S.gap.lg }}>
              <Section title="Style avancé" defaultOpen={false}><div style={{ display: 'flex', flexDirection: 'column', gap: S.gap.lg }}>

              {/* Colors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Couleur fond</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={intro.bgColor || theme.backgroundColor}
                      onChange={e => setIntro(p => ({ ...p, bgColor: e.target.value, preset: 'custom' }))}
                      style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', cursor: 'pointer' }} />
                    <input type="text" value={intro.bgColor || theme.backgroundColor}
                      onChange={e => setIntro(p => ({ ...p, bgColor: e.target.value, preset: 'custom' }))}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', color: S.text, fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <Label>Couleur accent</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={intro.accentColor || theme.textColor}
                      onChange={e => setIntro(p => ({ ...p, accentColor: e.target.value, preset: 'custom' }))}
                      style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', cursor: 'pointer' }} />
                    <input type="text" value={intro.accentColor || theme.textColor}
                      onChange={e => setIntro(p => ({ ...p, accentColor: e.target.value, preset: 'custom' }))}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', color: S.text, fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Background pattern */}
              <div>
                <Label>Motif de fond</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {([
                    { value: 'solid',           label: 'Uni' },
                    { value: 'dots',            label: 'Points' },
                    { value: 'grid',            label: 'Grille' },
                    { value: 'diagonal',        label: 'Diagonales' },
                    { value: 'radial',          label: 'Radial' },
                    { value: 'noise',           label: 'Bruit' },
                    { value: 'confetti',        label: 'Confetti' },
                    { value: 'stripes',         label: 'Stripes' },
                    { value: 'scanlines',       label: 'Scanlines' },
                    { value: 'gradient-sweep',  label: 'Sweep' },
                    { value: 'aurora',      label: 'Aurora' },
                    { value: 'halftone',    label: 'Halftone' },
                    { value: 'vhs',         label: 'VHS' },
                    { value: 'plasma',      label: '🫧 Plasma' },
                    { value: 'synthwave',   label: '🌅 Synthwave' },
                    { value: 'burst',       label: '✳ Burst' },
                    { value: 'liquid',      label: '🫠 Liquid' },
                    { value: 'eq',          label: '🎚 EQ' },
                  ] as { value: string; label: string }[]).map(opt => {
                    const selected = (intro.bgPattern || 'solid') === opt.value
                    return (
                      <button key={opt.value} onClick={() => setIntro(p => ({ ...p, bgPattern: opt.value as any, preset: 'custom' }))}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                          background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                          color: selected ? S.text : S.muted }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Text animation */}
              <div>
                <Label>Animation</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {([
                    { value: 'spring-up',   label: 'Spring' },
                    { value: 'flash',       label: 'Flash' },
                    { value: 'typewriter',  label: 'Typewriter' },
                    { value: 'word-stack',  label: 'Word Stack' },
                    { value: 'zoom-blast',  label: 'Zoom Blast' },
                    { value: 'glitch',      label: 'Glitch' },
                    { value: 'scramble',    label: 'Scramble' },
                    { value: 'letter-stack', label: 'Letter Stack' },
                    { value: 'highlight',   label: 'Highlight' },
                    { value: 'flip-3d',     label: 'Flip 3D' },
                    { value: 'neon-flicker',  label: 'Neon' },
                    { value: 'blur-reveal',   label: 'Blur Reveal' },
                    { value: 'stamp',         label: 'Stamp' },
                    { value: 'wave',          label: 'Wave' },
                    { value: 'cascade',       label: 'Cascade' },
                    { value: 'split-reveal',  label: 'Split' },
                  ] as { value: string; label: string }[]).map(opt => {
                    const selected = (intro.textAnimation || 'spring-up') === opt.value
                    return (
                      <button key={opt.value} onClick={() => setIntro(p => ({ ...p, textAnimation: opt.value as any, preset: 'custom' }))}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                          background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                          color: selected ? S.text : S.muted }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Size sliders */}
              <SliderRow label="Taille du texte" value={intro.textSize || 72} min={32} max={120} step={4}
                format={v => `${v}px`} onChange={v => setIntro(p => ({ ...p, textSize: v }))} />
              <SliderRow label="Taille du logo" value={intro.logoSize || 64} min={32} max={200} step={8}
                format={v => `${v}px`} onChange={v => setIntro(p => ({ ...p, logoSize: v }))} />

              {/* Police */}
              <div>
                <Label>Police</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {FONT_OPTIONS.map(f => {
                    const active = (intro.fontFamily || theme.fontFamily) === f.value
                    return (
                      <button key={f.value} onClick={() => setIntro(p => ({ ...p, fontFamily: f.value, fontWeight: f.weight }))}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: f.value,
                          background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : S.border}`,
                          color: active ? S.text : S.muted }}>
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Décorateur */}
              <div>
                <Label>Décorateur</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {([
                    { value: 'none',         label: 'Aucun' },
                    { value: 'ticker',       label: '📺 Ticker' },
                    { value: 'frame-border', label: '⬜ Cadre' },
                    { value: 'corner-label', label: '📌 Coin' },
                  ] as { value: string; label: string }[]).map(opt => {
                    const selected = (intro.decorator || 'none') === opt.value
                    return (
                      <button key={opt.value}
                        onClick={() => { setIntro(p => ({ ...p, decorator: opt.value as any, preset: 'custom' })) }}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                          background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                          color: selected ? S.text : S.muted,
                        }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Texte du décorateur */}
              {intro.decorator && intro.decorator !== 'none' && (
                <div>
                  <Label>{intro.decorator === 'ticker' ? 'Texte du ticker' : 'Texte du coin'}</Label>
                  <input
                    type="text"
                    value={intro.decoratorText || ''}
                    onChange={e => setIntro(p => ({ ...p, decoratorText: e.target.value }))}
                    placeholder={intro.decorator === 'ticker' ? 'Ex: @monhandle · LAVIDZ' : 'Ex: EP.01'}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${S.border}`, borderRadius: 8,
                      padding: '8px 12px', color: S.text, fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
              )}
            </div></Section></div>
          </div>
        )}
      </Card>

      {/* Son d'intro */}
      <Card>
        <p style={{ color: S.text, fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Son d'intro</p>
        {introSounds.length === 0 ? (
          <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace' }}>
            Aucun son "Intro" dans la bibliothèque — ajoutez-en depuis l'admin.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {introSounds.map(s => {
              const isActive = audioSettings.introSfx?.prompt === s.id
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setAudioSettings(p => ({
                      ...p,
                      introSfx: isActive ? undefined : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 1 },
                    }))}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 10, textAlign: 'left',
                      background: isActive ? 'rgba(255,255,255,0.1)' : S.surface,
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : S.border}`,
                    }}
                  >
                    <span style={{ color: isActive ? S.text : S.muted, fontSize: 12 }}>{s.name}</span>
                    {isActive && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
                  </button>
                  <button
                    onClick={() => { if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null } const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a; a.onended = () => { soundPreviewAudioRef.current = null }; a.play() }}
                    style={{ padding: '8px 10px', borderRadius: 10, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}
                  >
                    <Play size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {audioSettings.introSfx?.url && (
          <div style={{ marginTop: 12 }}>
            <SliderRow
              label="Volume"
              value={Math.round((audioSettings.introSfx.volume ?? 1) * 100)}
              min={0} max={100} step={5}
              format={v => `${v}%`}
              onChange={v => setAudioSettings(p => ({ ...p, introSfx: { ...p.introSfx!, volume: v / 100 } }))}
            />
          </div>
        )}
      </Card>
    </div>
  )

  const outroSounds = soundLibrary.filter(s => s.tag === 'OUTRO')
  const stepOutro = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: outro.enabled ? 20 : 0 }}>
          <div>
            <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Slide d'outro</p>
            <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>CTA final après le dernier clip</p>
          </div>
          <Toggle value={outro.enabled} onChange={v => setOutro(p => ({ ...p, enabled: v }))} />
        </div>

        {outro.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Presets ── */}
            <div>
              <Label>Style médias</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {PRESET_UI.map(p => {
                  const selected = outro.preset === p.id
                  return (
                    <button key={p.id} onClick={() => applyPreset(p.id as SlidePreset, 'outro')}
                      onMouseEnter={() => setHoveredOutroPreset(p.id)}
                      onMouseLeave={() => setHoveredOutroPreset(null)}
                      style={{
                        padding: '10px 6px', borderRadius: 10, textAlign: 'center',
                        background: selected ? p.bg : hoveredOutroPreset === p.id ? S.surfaceHover : S.surface,
                        border: `2px solid ${selected ? p.accent : hoveredOutroPreset === p.id ? S.borderHover : S.border}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 18, marginBottom: 2 }}>{p.emoji}</div>
                      <div style={{ color: selected ? p.accent : S.muted, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {p.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <Label>CTA principal</Label>
              <input type="text" placeholder="Abonne-toi pour plus de contenu 🔥"
                value={outro.ctaText} onChange={e => setOutro(p => ({ ...p, ctaText: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
              />
              <p style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace', marginTop: 6 }}>
                Phrase courte · action directe · max 8 mots
              </p>
            </div>
            <div>
              <Label>Texte secondaire</Label>
              <input type="text" placeholder="@tonhandle · Commente si tu veux la suite"
                value={outro.subText} onChange={e => setOutro(p => ({ ...p, subText: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
              />
            </div>
            <div>
              <Label>URL du logo (optionnel)</Label>
              <input type="text" placeholder="https://..."
                value={outro.logoUrl} onChange={e => setOutro(p => ({ ...p, logoUrl: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
              />
            </div>
            <SliderRow label="Durée" value={outro.durationSeconds} min={2} max={6} step={0.5}
              format={v => `${v}s`} onChange={v => setOutro(p => ({ ...p, durationSeconds: v }))}
            />

            {/* Advanced styling */}
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: S.gap.lg }}>
              <Section title="Style avancé" defaultOpen={false}><div style={{ display: 'flex', flexDirection: 'column', gap: S.gap.lg }}>

              {/* Colors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Couleur fond</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={outro.bgColor || theme.backgroundColor}
                      onChange={e => setOutro(p => ({ ...p, bgColor: e.target.value, preset: 'custom' }))}
                      style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', cursor: 'pointer' }} />
                    <input type="text" value={outro.bgColor || theme.backgroundColor}
                      onChange={e => setOutro(p => ({ ...p, bgColor: e.target.value, preset: 'custom' }))}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', color: S.text, fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <Label>Couleur accent</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={outro.accentColor || theme.textColor}
                      onChange={e => setOutro(p => ({ ...p, accentColor: e.target.value, preset: 'custom' }))}
                      style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', cursor: 'pointer' }} />
                    <input type="text" value={outro.accentColor || theme.textColor}
                      onChange={e => setOutro(p => ({ ...p, accentColor: e.target.value, preset: 'custom' }))}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', color: S.text, fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Background pattern */}
              <div>
                <Label>Motif de fond</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {([
                    { value: 'solid',           label: 'Uni' },
                    { value: 'dots',            label: 'Points' },
                    { value: 'grid',            label: 'Grille' },
                    { value: 'diagonal',        label: 'Diagonales' },
                    { value: 'radial',          label: 'Radial' },
                    { value: 'noise',           label: 'Bruit' },
                    { value: 'confetti',        label: 'Confetti' },
                    { value: 'stripes',         label: 'Stripes' },
                    { value: 'scanlines',       label: 'Scanlines' },
                    { value: 'gradient-sweep',  label: 'Sweep' },
                    { value: 'aurora',      label: 'Aurora' },
                    { value: 'halftone',    label: 'Halftone' },
                    { value: 'vhs',         label: 'VHS' },
                    { value: 'plasma',      label: '🫧 Plasma' },
                    { value: 'synthwave',   label: '🌅 Synthwave' },
                    { value: 'burst',       label: '✳ Burst' },
                    { value: 'liquid',      label: '🫠 Liquid' },
                    { value: 'eq',          label: '🎚 EQ' },
                  ] as { value: string; label: string }[]).map(opt => {
                    const selected = (outro.bgPattern || 'solid') === opt.value
                    return (
                      <button key={opt.value} onClick={() => setOutro(p => ({ ...p, bgPattern: opt.value as any, preset: 'custom' }))}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                          background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                          color: selected ? S.text : S.muted }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Text animation */}
              <div>
                <Label>Animation</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {([
                    { value: 'spring-up',   label: 'Spring' },
                    { value: 'flash',       label: 'Flash' },
                    { value: 'typewriter',  label: 'Typewriter' },
                    { value: 'word-stack',  label: 'Word Stack' },
                    { value: 'zoom-blast',  label: 'Zoom Blast' },
                    { value: 'glitch',      label: 'Glitch' },
                    { value: 'scramble',    label: 'Scramble' },
                    { value: 'letter-stack', label: 'Letter Stack' },
                    { value: 'highlight',   label: 'Highlight' },
                    { value: 'flip-3d',     label: 'Flip 3D' },
                    { value: 'neon-flicker',  label: 'Neon' },
                    { value: 'blur-reveal',   label: 'Blur Reveal' },
                    { value: 'stamp',         label: 'Stamp' },
                    { value: 'wave',          label: 'Wave' },
                    { value: 'cascade',       label: 'Cascade' },
                    { value: 'split-reveal',  label: 'Split' },
                  ] as { value: string; label: string }[]).map(opt => {
                    const selected = (outro.textAnimation || 'spring-up') === opt.value
                    return (
                      <button key={opt.value} onClick={() => setOutro(p => ({ ...p, textAnimation: opt.value as any, preset: 'custom' }))}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                          background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                          color: selected ? S.text : S.muted }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Size sliders */}
              <SliderRow label="Taille du texte" value={outro.textSize || 68} min={32} max={120} step={4}
                format={v => `${v}px`} onChange={v => setOutro(p => ({ ...p, textSize: v }))} />
              <SliderRow label="Taille du logo" value={outro.logoSize || 56} min={32} max={200} step={8}
                format={v => `${v}px`} onChange={v => setOutro(p => ({ ...p, logoSize: v }))} />

              {/* Police */}
              <div>
                <Label>Police</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {FONT_OPTIONS.map(f => {
                    const active = (outro.fontFamily || theme.fontFamily) === f.value
                    return (
                      <button key={f.value} onClick={() => setOutro(p => ({ ...p, fontFamily: f.value, fontWeight: f.weight }))}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: f.value,
                          background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : S.border}`,
                          color: active ? S.text : S.muted }}>
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Décorateur */}
              <div>
                <Label>Décorateur</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {([
                    { value: 'none',         label: 'Aucun' },
                    { value: 'ticker',       label: '📺 Ticker' },
                    { value: 'frame-border', label: '⬜ Cadre' },
                    { value: 'corner-label', label: '📌 Coin' },
                  ] as { value: string; label: string }[]).map(opt => {
                    const selected = (outro.decorator || 'none') === opt.value
                    return (
                      <button key={opt.value}
                        onClick={() => { setOutro(p => ({ ...p, decorator: opt.value as any, preset: 'custom' })) }}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                          background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                          color: selected ? S.text : S.muted,
                        }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Texte du décorateur */}
              {outro.decorator && outro.decorator !== 'none' && (
                <div>
                  <Label>{outro.decorator === 'ticker' ? 'Texte du ticker' : 'Texte du coin'}</Label>
                  <input
                    type="text"
                    value={outro.decoratorText || ''}
                    onChange={e => setOutro(p => ({ ...p, decoratorText: e.target.value }))}
                    placeholder={outro.decorator === 'ticker' ? 'Ex: @monhandle · LAVIDZ' : 'Ex: EP.01'}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${S.border}`, borderRadius: 8,
                      padding: '8px 12px', color: S.text, fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
              )}
            </div></Section></div>
          </div>
        )}
      </Card>

      {/* Son d'outro */}
      <Card>
        <p style={{ color: S.text, fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Son d'outro</p>
        {outroSounds.length === 0 ? (
          <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace' }}>
            Aucun son "Outro" dans la bibliothèque — ajoutez-en depuis l'admin.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {outroSounds.map(s => {
              const isActive = audioSettings.outroSfx?.prompt === s.id
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setAudioSettings(p => ({
                      ...p,
                      outroSfx: isActive ? undefined : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 1 },
                    }))}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 10, textAlign: 'left',
                      background: isActive ? 'rgba(255,255,255,0.1)' : S.surface,
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : S.border}`,
                    }}
                  >
                    <span style={{ color: isActive ? S.text : S.muted, fontSize: 12 }}>{s.name}</span>
                    {isActive && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
                  </button>
                  <button
                    onClick={() => { if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null } const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a; a.onended = () => { soundPreviewAudioRef.current = null }; a.play() }}
                    style={{ padding: '8px 10px', borderRadius: 10, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}
                  >
                    <Play size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {audioSettings.outroSfx?.url && (
          <div style={{ marginTop: 12 }}>
            <SliderRow
              label="Volume"
              value={Math.round((audioSettings.outroSfx.volume ?? 1) * 100)}
              min={0} max={100} step={5}
              format={v => `${v}%`}
              onChange={v => setAudioSettings(p => ({ ...p, outroSfx: { ...p.outroSfx!, volume: v / 100 } }))}
            />
          </div>
        )}
      </Card>
    </div>
  )

  const stepTheme = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Transitions clips ─────────────────────────────────────────────── */}
      <div>
        <Label>Entrée des clips</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {([
            { value: 'zoom-punch',  label: 'Zoom Punch',  desc: 'TikTok / Reels' },
            { value: 'slide-up',    label: 'Slide Up',    desc: 'Story / Smooth' },
            { value: 'flash',       label: 'Flash Cut',   desc: 'Énergie / Clip' },
            { value: 'wipe-right',  label: 'Wipe',        desc: 'Slide latéral' },
            { value: 'spin-scale',  label: 'Spin Scale',  desc: 'Social / Punchy' },
            { value: 'glitch-cut',  label: 'Glitch',      desc: 'Cyberpunk / RGB' },
            { value: 'blur-in',     label: 'Blur In',     desc: 'Cinéma / Focus' },
            { value: 'shake',       label: 'Shake',       desc: 'Énergie brute' },
            { value: 'none',        label: 'Aucune',      desc: 'Cut direct' },
          ] as { value: TransitionStyle; label: string; desc: string }[]).map(t => (
            <button key={t.value} onClick={() => setMotionSettings(p => ({ ...p, transitionStyle: t.value }))}
              onMouseEnter={() => setHoveredTransStyle(t.value)}
              onMouseLeave={() => setHoveredTransStyle(null)}
              style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                ...selectableStyle(motionSettings.transitionStyle === t.value, hoveredTransStyle === t.value),
              }}
            >
              <p style={{ color: motionSettings.transitionStyle === t.value ? S.text : S.muted, fontWeight: 700, fontSize: 13 }}>{t.label}</p>
              <p style={{ color: S.dim, fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Cartes question ───────────────────────────────────────────────── */}
      <Section title="Cartes question" defaultOpen={false}>
      <div>
        <Label>Style des cartes question</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {([
            { value: 'default',     label: 'Default',     desc: 'Spring classique',   emoji: '◻' },
            { value: 'flash-word',  label: 'Flash Word',  desc: 'Konbini / Impact',   emoji: '⚡' },
            { value: 'brut',        label: 'Brut',        desc: 'Brutalist / Left',   emoji: '▐' },
            { value: 'split-color', label: 'Split',       desc: 'Bi-color reveal',    emoji: '◨' },
            { value: 'typewriter',  label: 'Typewriter',  desc: 'Char by char',       emoji: '⌨' },
            { value: 'cinematic',   label: 'Cinéma',      desc: 'Letterbox / Serif',  emoji: '🎬' },
            { value: 'pop-art',     label: 'Pop Art',     desc: 'Pills colorées',     emoji: '🎨' },
            { value: 'word-slam',   label: 'Word Slam',   desc: 'Claque des côtés',   emoji: '💥' },
            { value: 'kinetic',     label: 'Kinetic',     desc: 'Zoom stagger x3.5',  emoji: '🚀' },
            { value: 'neon-pulse',  label: 'Neon Pulse',  desc: 'Glow multicolore',   emoji: '🌈' },
          ] as { value: string; label: string; desc: string; emoji: string }[]).map(t => (
            <button key={t.value} onClick={() => setMotionSettings(p => ({ ...p, questionCardStyle: t.value as QuestionCardStyle }))}
              onMouseEnter={() => setHoveredQCardStyle(t.value)}
              onMouseLeave={() => setHoveredQCardStyle(null)}
              style={{
                padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                ...selectableStyle((motionSettings.questionCardStyle ?? 'default') === t.value, hoveredQCardStyle === t.value),
              }}
            >
              <p style={{ fontSize: 16, margin: '0 0 4px' }}>{t.emoji}</p>
              <p style={{ color: (motionSettings.questionCardStyle ?? 'default') === t.value ? S.text : S.muted, fontWeight: 700, fontSize: 12 }}>{t.label}</p>
              <p style={{ color: S.dim, fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Entrée des cartes question ──────────────────────────────────────── */}
      <div>
        <Label>Entrée des cartes question</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {([
            { value: 'none',        label: 'Aucune',      desc: 'Cut direct' },
            { value: 'zoom-punch',  label: 'Zoom Punch',  desc: 'TikTok / Reels' },
            { value: 'slide-up',    label: 'Slide Up',    desc: 'Story / Smooth' },
            { value: 'flash',       label: 'Flash Cut',   desc: 'Énergie / Clip' },
            { value: 'wipe-right',  label: 'Wipe',        desc: 'Slide latéral' },
            { value: 'spin-scale',  label: 'Spin Scale',  desc: 'Social / Punchy' },
            { value: 'glitch-cut',  label: 'Glitch',      desc: 'Cyberpunk / RGB' },
            { value: 'blur-in',     label: 'Blur In',     desc: 'Cinéma / Focus' },
            { value: 'shake',       label: 'Shake',       desc: 'Énergie brute' },
          ] as { value: TransitionStyle; label: string; desc: string }[]).map(t => (
            <button key={t.value} onClick={() => setMotionSettings(p => ({ ...p, questionCardTransition: t.value }))}
              onMouseEnter={() => setHoveredQCardTrans(t.value)}
              onMouseLeave={() => setHoveredQCardTrans(null)}
              style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                ...selectableStyle((motionSettings.questionCardTransition ?? 'none') === t.value, hoveredQCardTrans === t.value),
              }}
            >
              <p style={{ color: (motionSettings.questionCardTransition ?? 'none') === t.value ? S.text : S.muted, fontWeight: 700, fontSize: 13 }}>{t.label}</p>
              <p style={{ color: S.dim, fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Motif de fond des cartes question ──────────────────────────────── */}
      <div>
        <Label>Motif de fond des cartes</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {([
            { value: 'solid',           label: 'Uni' },
            { value: 'dots',            label: 'Points' },
            { value: 'grid',            label: 'Grille' },
            { value: 'diagonal',        label: 'Diagonales' },
            { value: 'radial',          label: 'Radial' },
            { value: 'noise',           label: 'Bruit' },
            { value: 'confetti',        label: 'Confetti' },
            { value: 'stripes',         label: 'Stripes' },
            { value: 'scanlines',       label: 'Scanlines' },
            { value: 'gradient-sweep',  label: 'Sweep' },
            { value: 'aurora',          label: 'Aurora' },
            { value: 'halftone',        label: 'Halftone' },
            { value: 'vhs',             label: 'VHS' },
            { value: 'plasma',          label: '🫧 Plasma' },
            { value: 'synthwave',       label: '🌅 Synthwave' },
            { value: 'burst',           label: '✳ Burst' },
            { value: 'liquid',          label: '🫠 Liquid' },
            { value: 'eq',              label: '🎚 EQ' },
          ] as { value: string; label: string }[]).map(opt => {
            const selected = (motionSettings.questionCardBgPattern ?? 'solid') === opt.value
            return (
              <button key={opt.value} onClick={() => setMotionSettings(p => ({ ...p, questionCardBgPattern: opt.value as any }))}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'monospace',
                  background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : S.border}`,
                  color: selected ? S.text : S.muted,
                }}>
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      </Section>

      <div style={{ height: 1, background: S.border }} />

      {/* Style Presets */}
      <div>
        <Label>Style format</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STYLE_PRESETS.map(preset => {
            const isActive = activePresetId === preset.id
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setActivePresetId(preset.id)
                  setFormat(preset.format)
                  setTheme({ ...preset.theme })
                  setMotionSettings({ ...preset.motionSettings })
                  setSubtitleSettings({ ...preset.subtitleSettings })
                  setQuestionCardFrames(preset.questionCardFrames)
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: 14, textAlign: 'left',
                  background: isActive ? 'rgba(255,255,255,0.1)' : S.surface,
                  border: `1px solid ${isActive ? 'rgba(255,255,255,0.35)' : S.border}`,
                }}
              >
                <div>
                  <p style={{ color: isActive ? S.text : S.muted, fontWeight: 700, fontSize: 14 }}>{preset.label}</p>
                  <p style={{ color: S.dim, fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>{preset.desc}</p>
                </div>
                {isActive && <span style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>actif</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ height: 1, background: S.border }} />

      {/* Presets */}
      <div>
        <Label>Preset couleurs</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {THEME_PRESETS.map(preset => (
            <button key={preset.label} onClick={() => setTheme(p => ({ ...p, backgroundColor: preset.backgroundColor, textColor: preset.textColor }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                borderRadius: 20, fontSize: 12, fontFamily: 'monospace',
                background: theme.backgroundColor === preset.backgroundColor ? 'rgba(255,255,255,0.12)' : S.surface,
                border: `1px solid ${theme.backgroundColor === preset.backgroundColor ? 'rgba(255,255,255,0.3)' : S.border}`,
                color: theme.backgroundColor === preset.backgroundColor ? S.text : S.muted,
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 6, background: preset.backgroundColor, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom colors */}
      <Card style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Fond', key: 'backgroundColor' as const },
          { label: 'Texte', key: 'textColor' as const },
        ].map(({ label, key }) => (
          <div key={key} style={{ flex: 1 }}>
            <Label>{label}</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 10, border: `1px solid ${S.border}` }}>
              <input type="color" value={theme[key]} onChange={e => setTheme(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              <span style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{theme[key]}</span>
            </div>
          </div>
        ))}
      </Card>

      {/* Font */}
      <div>
        <Label>Police des transitions</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {FONT_OPTIONS.map(font => (
            <button key={font.label} onClick={() => setTheme(p => ({ ...p, fontFamily: font.value, fontWeight: font.weight }))}
              onMouseEnter={() => setHoveredFont(font.label)}
              onMouseLeave={() => setHoveredFont(null)}
              style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                fontFamily: font.value, fontWeight: font.weight, fontSize: 14,
                ...selectableStyle(theme.fontFamily === font.value, hoveredFont === font.label),
              }}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visual effects */}
      <Section title="Effets visuels" defaultOpen={false}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { key: 'wordPop'     as const, label: 'Word Pop',      desc: 'Bounce sur le mot actif' },
            { key: 'progressBar' as const, label: 'Progress Bar',  desc: 'Barre de progression en haut' },
            { key: 'kenBurns'    as const, label: 'Ken Burns',     desc: 'Zoom lent cinématique' },
            { key: 'dynamicZoom' as const, label: 'Dynamic Zoom',  desc: 'Punch zoom rythmique tous les 4 mots' },
          ].map(({ key, label, desc }, idx, arr) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx < arr.length - 1 ? `1px solid ${S.border}` : 'none' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>{label}</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>{desc}</p>
              </div>
              <Toggle value={!!motionSettings[key]} onChange={v => setMotionSettings(p => ({ ...p, [key]: v }))} />
            </div>
          ))}
          {/* Lower Third */}
          <div style={{ paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: motionSettings.lowerThird !== undefined ? 16 : 0 }}>
              <div>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Lower Third</p>
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Name tag en bas à gauche</p>
              </div>
              <Toggle
                value={motionSettings.lowerThird !== undefined}
                onChange={v => setMotionSettings(p => ({ ...p, lowerThird: v ? { name: '', title: '' } : undefined }))}
              />
            </div>
            {motionSettings.lowerThird !== undefined && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <Label>Nom</Label>
                  <input
                    type="text"
                    placeholder="Marie Dupont"
                    value={motionSettings.lowerThird.name}
                    onChange={e => setMotionSettings(p => ({ ...p, lowerThird: { ...p.lowerThird!, name: e.target.value } }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
                  />
                </div>
                <div>
                  <Label>Titre (optionnel)</Label>
                  <input
                    type="text"
                    placeholder="Co-fondatrice · Lavidz"
                    value={motionSettings.lowerThird?.title ?? ''}
                    onChange={e => setMotionSettings(p => ({ ...p, lowerThird: { ...p.lowerThird!, title: e.target.value || undefined } }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', color: S.text, fontSize: 14, outline: 'none' }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      </Section>

      <div style={{ height: 1, background: S.border }} />

      {/* Audio */}
      <div>
        <Label>Audio</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Transition SFX — bibliothèque DB */}
          {(() => {
            const transitionSounds = soundLibrary.filter(s => s.tag === 'TRANSITION')
            const track = audioSettings.transitionSfx
            return (
              <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ color: S.text, fontWeight: 600, fontSize: 13 }}>Son de transition</p>
                {transitionSounds.length === 0 ? (
                  <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace' }}>
                    Aucun son "Transition" dans la bibliothèque — ajoutez-en depuis l'admin.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {transitionSounds.map(s => {
                      const isActive = track?.prompt === s.id
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => setAudioSettings(p => ({
                              ...p,
                              transitionSfx: isActive ? undefined : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 0.8 },
                            }))}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', borderRadius: 10, textAlign: 'left',
                              background: isActive ? 'rgba(255,255,255,0.1)' : S.surface,
                              border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : S.border}`,
                            }}
                          >
                            <span style={{ color: isActive ? S.text : S.muted, fontSize: 12 }}>{s.name}</span>
                            {isActive && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
                          </button>
                          <button
                            onClick={() => { if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null } const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a; a.onended = () => { soundPreviewAudioRef.current = null }; a.play() }}
                            style={{ padding: '8px 10px', borderRadius: 10, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}
                          >
                            <Play size={11} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {track?.url && (
                  <SliderRow
                    label="Volume"
                    value={Math.round((track.volume ?? 0.8) * 100)}
                    min={0} max={100} step={5}
                    format={v => `${v}%`}
                    onChange={v => setAudioSettings(p => ({ ...p, transitionSfx: { ...p.transitionSfx!, volume: v / 100 } }))}
                  />
                )}
              </Card>
            )
          })()}
        </div>
      </div>
    </div>
  )

  const stepMusic = (() => {
    const bgSounds = soundLibrary.filter(s => s.tag === 'BACKGROUND')
    const track = audioSettings.bgMusic
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>Musique d'ambiance</p>
            <p style={{ color: S.muted, fontSize: 11, marginTop: 4 }}>Choisissez un fond sonore pour accompagner la vidéo</p>
          </div>
          {bgSounds.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p style={{ color: S.dim, fontSize: 12, fontFamily: 'monospace' }}>
                Aucune musique "Background Sound" dans la bibliothèque.
              </p>
              <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace', marginTop: 6 }}>
                Ajoutez-en depuis <strong style={{ color: S.muted }}>Admin → Sons</strong> avec le tag "Background Sound".
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* No music option */}
              <button
                onClick={() => setAudioSettings(p => ({ ...p, bgMusic: undefined }))}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 12, textAlign: 'left',
                  background: !track ? 'rgba(255,255,255,0.1)' : S.surface,
                  border: `1px solid ${!track ? 'rgba(255,255,255,0.3)' : S.border}`,
                }}
              >
                <span style={{ color: !track ? S.text : S.muted, fontSize: 13, fontFamily: 'monospace' }}>Aucune musique</span>
                {!track && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
              </button>
              {bgSounds.map(s => {
                const isActive = track?.prompt === s.id
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setAudioSettings(p => ({
                        ...p,
                        bgMusic: isActive ? undefined : { prompt: s.id, url: `/api/admin/sounds/${s.id}/audio`, volume: 0.25 },
                      }))}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 12, textAlign: 'left',
                        background: isActive ? 'rgba(255,255,255,0.1)' : S.surface,
                        border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : S.border}`,
                      }}
                    >
                      <span style={{ color: isActive ? S.text : S.muted, fontSize: 13 }}>{s.name}</span>
                      {isActive && <span style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>actif</span>}
                    </button>
                    <button
                      onClick={() => { if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null } const a = new Audio(s.signedUrl); soundPreviewAudioRef.current = a; a.onended = () => { soundPreviewAudioRef.current = null }; a.play() }}
                      style={{ padding: '10px 12px', borderRadius: 12, background: S.surface, border: `1px solid ${S.border}`, color: S.muted, display: 'flex', alignItems: 'center' }}
                      title="Écouter"
                    >
                      <Play size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {track?.url && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: S.text, fontWeight: 600, fontSize: 13 }}>Paramètres</p>
            <SliderRow
              label="Volume musique"
              value={Math.round((track.volume ?? 0.25) * 100)}
              min={0} max={100} step={5}
              format={v => `${v}%`}
              onChange={v => setAudioSettings(p => ({ ...p, bgMusic: { ...p.bgMusic!, volume: v / 100 } }))}
            />
          </Card>
        )}
      </div>
    )
  })()

  const stepSubtitles = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Enable/disable toggle */}
      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Sous-titres</p>
          <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Afficher les sous-titres sur la vidéo</p>
        </div>
        <Toggle value={subtitleSettings.enabled} onChange={v => setSubtitleSettings(p => ({ ...p, enabled: v }))} />
      </Card>

      {/* Style + settings — only when enabled */}
      {subtitleSettings.enabled && <>
        <div>
          <Label>Style</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { id: 'hormozi',  label: 'Hormozi',   desc: 'Impact jaune · viral' },
              { id: 'minimal',  label: 'Minimal',   desc: 'Fond flou · épuré' },
              { id: 'classic',  label: 'Classic',   desc: 'Soulignement blanc' },
              { id: 'neon',     label: 'Neon',      desc: 'Glow cyan · électro' },
              { id: 'karaoke',  label: 'Karaoke',   desc: 'Highlight pill actif' },
              { id: 'boxed',    label: 'Boxed',     desc: 'Box par mot · orange' },
              { id: 'outline',  label: 'Outline',   desc: 'Contour · sans remplissage' },
              { id: 'tape',     label: 'Tape',      desc: 'Bande noire · soulignage' },
              { id: 'glitch',   label: 'Glitch',    desc: 'Aberration chromatique' },
              { id: 'fire',     label: 'Fire',      desc: 'Glow orange / rouge' },
            ] as { id: SubtitleStyle; label: string; desc: string }[]).map(s => (
              <button key={s.id} onClick={() => setSubtitleSettings(p => ({ ...p, style: s.id }))}
                style={{
                  padding: '10px 14px', borderRadius: 12, fontSize: 12, textAlign: 'left',
                  background: subtitleSettings.style === s.id ? 'rgba(255,255,255,0.1)' : S.surface,
                  border: `1px solid ${subtitleSettings.style === s.id ? 'rgba(255,255,255,0.3)' : S.border}`,
                  color: subtitleSettings.style === s.id ? S.text : S.muted,
                }}
              >
                <p style={{ fontWeight: 700, fontFamily: 'monospace', marginBottom: 2 }}>{s.label}</p>
                <p style={{ fontSize: 10, color: S.dim }}>{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SliderRow label="Mots par ligne" value={subtitleSettings.wordsPerLine} min={1} max={5} step={1}
          format={v => `${v} mot${v > 1 ? 's' : ''}`} onChange={v => setSubtitleSettings(p => ({ ...p, wordsPerLine: v }))} />
        <SliderRow label="Taille" value={subtitleSettings.size} min={24} max={120} step={4}
          format={v => `${v}px`} onChange={v => setSubtitleSettings(p => ({ ...p, size: v }))} />
        <SliderRow label="Position verticale" value={subtitleSettings.position} min={5} max={95} step={5}
          format={v => v <= 25 ? 'Haut' : v <= 60 ? 'Centre' : 'Bas'}
          onChange={v => setSubtitleSettings(p => ({ ...p, position: v }))} />

        {/* Subtitle offset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>Décalage temporel</Label>
            <span style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>
              {subtitleSettings.offsetMs === 0 ? '0 ms' : subtitleSettings.offsetMs > 0 ? `+${subtitleSettings.offsetMs} ms` : `${subtitleSettings.offsetMs} ms`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[-300, -200, -100].map(step => (
              <button key={step} onClick={() => setSubtitleSettings(p => ({ ...p, offsetMs: p.offsetMs + step }))}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', background: S.surface, border: `1px solid ${S.border}`, color: S.muted }}>
                {step} ms
              </button>
            ))}
            <button onClick={() => setSubtitleSettings(p => ({ ...p, offsetMs: 0 }))}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', background: S.surface, border: `1px solid ${S.border}`, color: S.dim }}>
              0
            </button>
            {[100, 200, 300].map(step => (
              <button key={step} onClick={() => setSubtitleSettings(p => ({ ...p, offsetMs: p.offsetMs + step }))}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', background: S.surface, border: `1px solid ${S.border}`, color: S.muted }}>
                +{step} ms
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>
            Valeur négative = sous-titres en avance · Positive = sous-titres en retard
          </p>
        </div>
        </Card>

        {/* ── Emoji sur les mots ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>Emojis animés sur les mots</p>
              <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>Associe un emoji à un mot — il pop au-dessus des sous-titres quand le mot est prononcé</p>
            </div>
          </div>

          {/* Animated toggle + Gemini button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', background: S.surface, borderRadius: 10, border: `1px solid ${S.border}` }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: S.text, fontSize: 12, fontWeight: 600 }}>Noto Animated (Google)</p>
              <p style={{ color: S.dim, fontSize: 10 }}>GIFs animés haute qualité au lieu d'emojis statiques</p>
            </div>
            <Toggle
              value={subtitleSettings.animatedEmojis !== false}
              onChange={v => setSubtitleSettings(p => ({ ...p, animatedEmojis: v }))}
            />
          </div>

          {/* Gemini auto-suggest button */}
          <button
            onClick={runColdOpenAnalysis}
            disabled={coldOpenLoading || !ready}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, marginBottom: 14,
              fontSize: 12, fontWeight: 600, cursor: (coldOpenLoading || !ready) ? 'not-allowed' : 'pointer',
              background: coldOpenLoading ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.45)',
              color: '#c4b5fd',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: !ready ? 0.5 : 1,
            }}
          >
            {coldOpenLoading
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Gemini analyse...</>
              : <><span>🤖</span> Laisser Gemini choisir les emojis</>}
          </button>

          {/* Context emoji moments — per segment */}
          {Object.keys(contextEmojisBySegmentId).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(segments ?? []).filter(s => contextEmojisBySegmentId[s.id]?.length).map((seg, si) => (
                <div key={seg.id}>
                  <p style={{ color: S.muted, fontSize: 10, fontFamily: 'monospace', marginBottom: 5 }}>
                    Vidéo {si + 1}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {contextEmojisBySegmentId[seg.id].map((ce, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: S.surface, borderRadius: 8, border: `1px solid ${S.border}` }}>
                        <input
                          value={ce.emoji}
                          onChange={e => {
                            const val = [...e.target.value].slice(-2).join('')
                            setContextEmojisBySegmentId(prev => ({
                              ...prev,
                              [seg.id]: prev[seg.id].map((x, i) => i === idx ? { ...x, emoji: val } : x),
                            }))
                          }}
                          style={{ width: 40, padding: '3px 5px', borderRadius: 7, textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, color: S.text, fontSize: 18, fontFamily: 'inherit', outline: 'none' }}
                        />
                        <span style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace', flex: 1 }}>
                          {ce.startInSeconds.toFixed(1)}s → {ce.endInSeconds.toFixed(1)}s
                        </span>
                        <button
                          onClick={() => setContextEmojisBySegmentId(prev => ({
                            ...prev,
                            [seg.id]: prev[seg.id].filter((_, i) => i !== idx),
                          }))}
                          style={{ padding: '3px 7px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 10, cursor: 'pointer' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setContextEmojisBySegmentId({})}
                style={{ padding: '7px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px dashed rgba(239,68,68,0.3)', color: '#fca5a5' }}
              >Effacer tout</button>
            </div>
          ) : (
            <p style={{ color: S.dim, fontSize: 11, textAlign: 'center', padding: '12px 0' }}>
              Lance l'analyse Gemini ci-dessus pour générer automatiquement les emojis contextuels.
            </p>
          )}
        </Card>
      </>}
    </div>
  )

  const fmt = FORMATS[format]
  const stepPreview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Export */}
      {ready && segments && (
        <ServerRenderer
          ref={serverRendererRef}
          segments={effectiveSegments!}
          originalVideoUrls={effectiveVideoUrlsRef.current.length > 0 ? effectiveVideoUrlsRef.current : recordings.map(r => r.videoUrl)}
          voiceId={selectedVoiceId}
          themeName={themeName}
          theme={theme}
          intro={intro}
          outro={outro}
          subtitleSettings={subtitleSettings}
          questionCardFrames={questionCardFrames}
          fps={FPS}
          width={fmt.width}
          height={fmt.height}
          sessionId={sessionId}
          motionSettings={effectiveMotionSettings}
          audioSettings={audioSettings}
          onRenderComplete={(url) => {
            if (renderOutputUrlRef.current) URL.revokeObjectURL(renderOutputUrlRef.current)
            renderOutputUrlRef.current = url
            setRenderOutputUrl(url)
          }}
        />
      )}

      {/* Back to results */}
      <Link href={`/session/${themeSlug}/result?session=${sessionId}`}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: S.muted, fontSize: 12, fontFamily: 'monospace' }}>
        <ArrowLeft size={12} /> Retour aux résultats
      </Link>
    </div>
  )

  const PHASES = [
    { id: 'prepare',   label: 'Préparer',      desc: 'Voix IA & traitement audio' },
    { id: 'customize', label: 'Personnaliser',  desc: 'Style, bookends, musique' },
    { id: 'export',    label: 'Exporter',       desc: 'Format & rendu final' },
  ]

  const phase2StyleContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <Label>Preset de style</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {STYLE_PRESETS.map(preset => {
            const selected = activePresetId === preset.id
            return (
              <button key={preset.id} onClick={() => {
                setActivePresetId(preset.id)
                setTheme(preset.theme)
                setMotionSettings(preset.motionSettings)
                setSubtitleSettings(p => ({ ...p, ...preset.subtitleSettings }))
                setQuestionCardFrames(preset.questionCardFrames)
              }}
                style={{
                  padding: '14px', borderRadius: 14, textAlign: 'left',
                  background: selected ? S.surfaceActive : S.surface,
                  border: `2px solid ${selected ? S.borderActive : S.border}`, transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: preset.theme.backgroundColor, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  <span style={{ color: S.text, fontWeight: 700, fontSize: 13 }}>{preset.label}</span>
                </div>
                <p style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{preset.desc}</p>
              </button>
            )
          })}
        </div>
      </Card>
      {stepTheme}
      {stepSubtitles}
    </div>
  )

  const phase2BookendsContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', background: S.surface, borderRadius: 10, padding: 3, border: `1px solid ${S.border}` }}>
        {(['intro', 'outro'] as const).map(t => (
          <button key={t} onClick={() => setBookendTarget(t)} style={{
            flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: bookendTarget === t ? S.surfaceActive : 'transparent',
            border: `1px solid ${bookendTarget === t ? S.borderActive : 'transparent'}`,
            color: bookendTarget === t ? S.text : S.muted, transition: 'all 0.15s',
          }}>
            {t === 'intro' ? 'Intro' : 'Outro'}
          </button>
        ))}
      </div>
      {bookendTarget === 'intro' ? stepIntro : stepOutro}
    </div>
  )

  const phase2SubNavItems = [
    { id: 'style' as const,       label: 'Style' },
    { id: 'bookends' as const,    label: 'Bookends' },
    { id: 'audio' as const,       label: 'Audio' },
    { id: 'transcripts' as const, label: 'Transcripts' },
  ]

  const phase2Content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none' as const }}>
        {phase2SubNavItems.map(item => (
          <button key={item.id} onClick={() => setPhase2Section(item.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              background: phase2Section === item.id ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: `1px solid ${phase2Section === item.id ? S.borderActive : S.border}`,
              color: phase2Section === item.id ? S.text : S.muted, flexShrink: 0,
            }}>
            {item.label}
          </button>
        ))}
      </div>
      <div key={phase2Section} style={{ animation: 'fadeSlideIn 0.18s ease' }}>
        {phase2Section === 'style' ? phase2StyleContent :
         phase2Section === 'bookends' ? phase2BookendsContent :
         phase2Section === 'audio' ? stepMusic :
         stepTranscripts}
      </div>
    </div>
  )

  const phaseContent = [stepVoice, phase2Content, stepPreview]

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════════ */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 0,
        height: 48, paddingLeft: 12, paddingRight: 16,
        borderBottom: `1px solid ${S.border}`, flexShrink: 0,
        background: 'rgba(10,10,10,0.98)',
      }}>
        {/* Left: back + logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: isMobile ? 'auto' : 220, flexShrink: 0 }}>
          <Link href="/admin/montage">
            <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: S.muted, background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = S.surface)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <ArrowLeft size={15} />
            </button>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="relative w-4 h-4 flex items-center justify-center">
              <span className="block w-2 h-2 bg-primary animate-logo-morph" />
            </div>
            <span className="font-sans font-black text-[12px] tracking-tighter text-white uppercase">LAVIDZ</span>
            <span style={{ color: S.border, fontSize: 13, margin: '0 2px' }}>/</span>
            <span style={{ color: S.muted, fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{themeName}</span>
          </div>
        </div>

        {/* Center: Phase tabs (desktop only) */}
        {!isMobile && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {PHASES.map((phase, i) => {
              const active = currentPhase === i
              const done = i < currentPhase
              const locked = i > 0 && !ready
              return (
                <button key={phase.id}
                  onClick={() => { if (!locked) setCurrentPhase(i) }}
                  title={locked ? 'Générez la preview d\'abord' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 16px', borderRadius: 20, fontSize: 12,
                    fontWeight: active ? 700 : 400,
                    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: `1px solid ${active ? S.borderHover : 'transparent'}`,
                    color: active ? S.text : locked ? S.dim : done ? S.muted : S.dim,
                    transition: 'all 0.15s',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                  }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontFamily: 'monospace', fontWeight: 700, flexShrink: 0,
                    background: active ? '#fff' : done ? 'rgba(52,211,153,0.2)' : S.surface,
                    color: active ? '#0a0a0a' : done ? 'rgb(52,211,153)' : S.dim,
                    border: `1px solid ${active ? 'transparent' : done ? 'rgba(52,211,153,0.3)' : S.border}`,
                  }}>
                    {done ? '✓' : locked ? '🔒' : i + 1}
                  </span>
                  {phase.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Right: save status + export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: isMobile ? 'auto' : 220, justifyContent: 'flex-end', flexShrink: 0 }}>
          {saveStatus === 'saving' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.dim }}>Sauvegarde…</span>}
          {saveStatus === 'saved' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(52,211,153,0.6)' }}>Sauvegardé ✓</span>}
          {saveStatus === 'error' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.error }}>Erreur</span>}
          {!ready && saveStatus === 'idle' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s ease infinite' }} />}
          {ready && segments && (
            <button
              onClick={() => serverRendererRef.current?.render()}
              disabled={!!serverRendererRef.current?.rendering}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: '#ffffff', border: 'none', color: '#0a0a0a',
                cursor: serverRendererRef.current?.rendering ? 'not-allowed' : 'pointer',
                opacity: serverRendererRef.current?.rendering ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}>
              {serverRendererRef.current?.rendering ? 'Rendu…' : renderOutputUrl ? 'Ré-exporter' : 'Exporter'}
            </button>
          )}
        </div>
      </header>

      {/* Loading bar */}
      {regenerating && (
        <div style={{ padding: '7px 16px', borderBottom: `1px solid ${S.border}`, background: 'rgba(255,255,255,0.015)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Loader2 size={11} className="animate-spin" style={{ color: S.muted, flexShrink: 0 }} />
          <p style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{loadingStep}</p>
        </div>
      )}

      {/* Error banner */}
      {prepareError && (
        <div style={{ padding: '7px 16px', borderBottom: `1px solid rgba(248,113,113,0.15)`, background: S.errorSoft, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
          <p style={{ color: S.error, fontSize: 11, fontFamily: 'monospace' }}>⚠ {prepareError}</p>
          <button onClick={() => setPrepareError('')} style={{ color: S.error, fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, opacity: 0.7 }}>×</button>
        </div>
      )}

      {/* ══ MAIN BODY ═══════════════════════════════════════════════════════════ */}
      {isMobile ? (
        /* ── Mobile: player top / controls bottom ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'hidden' }}>
            {!ready ? (
              <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.7 }}>
                Configurez vos paramètres<br />puis cliquez sur <strong style={{ color: S.muted }}>Générer</strong>
              </p>
            ) : segments && (
              <Player ref={playerRef as any} component={LavidzComposition as any}
                inputProps={{ segments: effectiveSegments, questionCardFrames, subtitleSettings, theme, intro, outro, fps: FPS, motionSettings: effectiveMotionSettings, audioSettings }}
                durationInFrames={totalFrames} fps={FPS} compositionWidth={fmt.width} compositionHeight={fmt.height}
                style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: `${fmt.width} / ${fmt.height}`, display: 'block' }}
                playbackRate={playbackRate} showPlaybackRateControl controls clickToPlay />
            )}
          </div>
          {/* Mobile phase tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
            {PHASES.map((phase, i) => (
              <button key={phase.id} onClick={() => setCurrentPhase(i)}
                style={{ flex: 1, padding: '10px 4px', fontSize: 11, fontWeight: currentPhase === i ? 700 : 500, background: 'transparent', border: 'none', borderBottom: currentPhase === i ? '2px solid #fff' : '2px solid transparent', color: currentPhase === i ? S.text : S.muted }}>
                {phase.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
            <div key={`${currentPhase}-${currentPhase === 1 ? phase2Section : ''}`} style={{ animation: 'fadeSlideIn 0.18s ease' }}>
              {phaseContent[currentPhase]}
            </div>
          </div>
          {renderOutputUrl && sessionId && (
            <div style={{ padding: '8px 16px', borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
              {delivered ? <p style={{ textAlign: 'center', fontSize: 12, color: 'rgb(52,211,153)', fontFamily: 'monospace' }}>Email envoyé ✓</p> : (
                <button disabled={delivering} onClick={async () => { setDelivering(true); setDeliverError(''); try { const r = await fetch(`/api/admin/sessions/${sessionId}/deliver`, { method: 'POST' }); if (!r.ok) throw new Error(await r.text()); setDelivered(true) } catch (e) { setDeliverError(String(e)) } finally { setDelivering(false) } }}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: 'rgb(52,211,153)' }}>
                  {delivering ? 'Envoi...' : 'Envoyer au client ✉'}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Desktop: sidebar left + canvas right ── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
          <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${S.border}`, background: '#0a0a0a', overflow: 'hidden' }}>

            {/* Sidebar header: phase title + nav arrows */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: S.text, fontWeight: 700, fontSize: 13 }}>{PHASES[currentPhase].label}</p>
                <p style={{ color: S.dim, fontSize: 10, fontFamily: 'monospace', marginTop: 2 }}>{PHASES[currentPhase].desc}</p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setCurrentPhase(p => Math.max(0, p - 1))} disabled={currentPhase === 0}
                  style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.surface, border: `1px solid ${S.border}`, color: currentPhase === 0 ? S.dim : S.muted, cursor: currentPhase === 0 ? 'default' : 'pointer', opacity: currentPhase === 0 ? 0.35 : 1 }}>
                  <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <button
                  onClick={() => { if (!ready) return; setCurrentPhase(p => Math.min(PHASES.length - 1, p + 1)) }}
                  disabled={currentPhase === PHASES.length - 1 || !ready}
                  title={!ready ? 'Générez la preview d\'abord' : undefined}
                  style={{
                    width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: currentPhase < PHASES.length - 1 && ready ? '#fff' : S.surface,
                    border: `1px solid ${currentPhase < PHASES.length - 1 && ready ? '#fff' : S.border}`,
                    color: currentPhase < PHASES.length - 1 && ready ? '#0a0a0a' : S.dim,
                    cursor: (currentPhase === PHASES.length - 1 || !ready) ? 'not-allowed' : 'pointer',
                    opacity: (currentPhase === PHASES.length - 1 || !ready) ? 0.35 : 1,
                  }}>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Phase 2 sub-nav */}
            {currentPhase === 1 && (
              <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
                {phase2SubNavItems.map(item => (
                  <button key={item.id} onClick={() => setPhase2Section(item.id)}
                    style={{
                      flex: 1, padding: '9px 4px', fontSize: 10, fontWeight: phase2Section === item.id ? 700 : 500,
                      fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                      background: 'transparent', border: 'none',
                      borderBottom: phase2Section === item.id ? '2px solid #fff' : '2px solid transparent',
                      color: phase2Section === item.id ? S.text : S.dim, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>
              <div
                key={`${currentPhase}-${currentPhase === 1 ? phase2Section : ''}-${currentPhase === 1 && phase2Section === 'bookends' ? bookendTarget : ''}`}
                style={{ animation: 'fadeSlideIn 0.18s ease' }}
              >
                {phaseContent[currentPhase]}
              </div>
            </div>

            {/* ── Generate CTA — pinned at bottom of sidebar ── */}
            {currentPhase === 0 && (
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${!ready ? 'rgba(255,255,255,0.12)' : S.border}`, flexShrink: 0, background: !ready ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                <button
                  onClick={applyVoice}
                  disabled={regenerating}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    padding: ready ? '11px 0' : '15px 0',
                    borderRadius: 12,
                    background: regenerating ? 'rgba(255,255,255,0.07)' : ready ? S.surface : '#ffffff',
                    border: ready ? `1px solid ${S.borderHover}` : 'none',
                    color: ready ? S.text : '#0a0a0a',
                    fontSize: ready ? 12 : 14, fontWeight: 700,
                    cursor: regenerating ? 'not-allowed' : 'pointer',
                    opacity: regenerating ? 0.6 : 1,
                    transition: 'all 0.2s',
                    boxShadow: !ready && !regenerating ? '0 0 0 3px rgba(255,255,255,0.1), 0 4px 20px rgba(255,255,255,0.08)' : 'none',
                    letterSpacing: !ready ? '-0.01em' : '0',
                  }}
                >
                  {regenerating
                    ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Génération en cours…</>
                    : ready
                      ? <><RefreshCw size={12} /> Appliquer les changements</>
                      : <>Générer la preview →</>
                  }
                </button>
                {!ready && !regenerating && (
                  <p style={{ textAlign: 'center', fontSize: 10, color: S.dim, fontFamily: 'monospace', marginTop: 8 }}>
                    Étape obligatoire avant de continuer
                  </p>
                )}
              </div>
            )}

            {/* Deliver action */}
            {renderOutputUrl && sessionId && (
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
                {delivered ? (
                  <p style={{ textAlign: 'center', fontSize: 11, color: 'rgb(52,211,153)', fontFamily: 'monospace' }}>Email envoyé au client ✓</p>
                ) : (
                  <button disabled={delivering} onClick={async () => {
                    setDelivering(true); setDeliverError('')
                    try {
                      const res = await fetch(`/api/admin/sessions/${sessionId}/deliver`, { method: 'POST' })
                      if (!res.ok) throw new Error(await res.text())
                      setDelivered(true)
                    } catch (err) { setDeliverError(String(err)) } finally { setDelivering(false) }
                  }}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: delivering ? 'not-allowed' : 'pointer', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.22)', color: 'rgb(52,211,153)', transition: 'all 0.15s' }}>
                    {delivering ? 'Envoi…' : 'Confirmer et envoyer au client ✉'}
                  </button>
                )}
                {deliverError && <p style={{ fontSize: 11, color: S.error, fontFamily: 'monospace', marginTop: 6, textAlign: 'center' }}>{deliverError}</p>}
              </div>
            )}
          </div>

          {/* ── RIGHT: CANVAS + TIMELINE ──────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505' }}>

            {/* Canvas area: video centered in a dark stage */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

              {/* Format selector — floating top-left of canvas */}
              <div style={{ position: 'absolute', top: 12, left: 14, zIndex: 10, display: 'flex', gap: 3 }}>
                {(Object.entries(FORMATS) as [FormatKey, typeof FORMATS[FormatKey]][]).map(([key, f]) => (
                  <button key={key} onClick={() => setFormat(key)}
                    style={{
                      padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                      background: format === key ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)',
                      border: `1px solid ${format === key ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                      backdropFilter: 'blur(8px)',
                      color: format === key ? S.text : 'rgba(255,255,255,0.45)', transition: 'all 0.15s', cursor: 'pointer',
                    }}>
                    {f.label}
                    {format === key && <span style={{ fontSize: 8, color: S.dim, marginLeft: 4 }}>{f.description}</span>}
                  </button>
                ))}
              </div>

              {/* Ready state badge — floating top-right */}
              {ready && (
                <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', backdropFilter: 'blur(8px)' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgb(52,211,153)' }} />
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgb(52,211,153)' }}>Preview</span>
                </div>
              )}

              {/* Video player or placeholder */}
              {!ready ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, maxWidth: 360, textAlign: 'center' }}>
                  {regenerating ? (
                    /* Loading state */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      <div style={{ position: 'relative', width: 56, height: 56 }}>
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.06)' }} />
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'rgba(255,255,255,0.7)', animation: 'spin 0.9s linear infinite' }} />
                        <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: S.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader2 size={14} style={{ color: S.muted, animation: 'spin 1.2s linear infinite reverse' }} />
                        </div>
                      </div>
                      <div>
                        <p style={{ color: S.muted, fontSize: 13, fontWeight: 600 }}>Génération en cours</p>
                        <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace', marginTop: 6 }}>{loadingStep}</p>
                      </div>
                    </div>
                  ) : (
                    /* Empty state CTA */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                      {/* Icon */}
                      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <Play size={24} style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 3 }} />
                        {/* Pulse ring */}
                        <div style={{ position: 'absolute', inset: -8, borderRadius: 28, border: '1px solid rgba(255,255,255,0.06)', animation: 'pulse 2s ease infinite' }} />
                        <div style={{ position: 'absolute', inset: -16, borderRadius: 36, border: '1px solid rgba(255,255,255,0.03)', animation: 'pulse 2s ease infinite 0.4s' }} />
                      </div>

                      {/* Text */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: S.text }}>
                          Générez votre preview
                        </h3>
                        <p style={{ fontSize: 13, color: S.muted, lineHeight: 1.6 }}>
                          Configurez le traitement audio dans le panel de gauche,<br />
                          puis lancez la génération pour voir votre montage.
                        </p>
                      </div>

                      {/* CTA button in canvas */}
                      <button
                        onClick={applyVoice}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '14px 28px', borderRadius: 14,
                          background: '#ffffff', border: 'none', color: '#0a0a0a',
                          fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
                          cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: '0 0 0 4px rgba(255,255,255,0.08), 0 8px 32px rgba(255,255,255,0.12)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.12), 0 12px 40px rgba(255,255,255,0.18)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.08), 0 8px 32px rgba(255,255,255,0.12)' }}
                      >
                        <Play size={16} style={{ marginLeft: -2, fill: '#0a0a0a' }} />
                        Générer la preview
                      </button>

                      <p style={{ fontSize: 10, color: S.dim, fontFamily: 'monospace' }}>
                        Vous pourrez personnaliser le style ensuite
                      </p>
                    </div>
                  )}
                </div>
              ) : segments && (
                <Player
                  ref={playerRef as any}
                  component={LavidzComposition as any}
                  inputProps={{ segments: effectiveSegments, questionCardFrames, subtitleSettings, theme, intro, outro, fps: FPS, motionSettings: effectiveMotionSettings, audioSettings }}
                  durationInFrames={totalFrames}
                  fps={FPS}
                  compositionWidth={fmt.width}
                  compositionHeight={fmt.height}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    aspectRatio: `${fmt.width} / ${fmt.height}`,
                    display: 'block',
                    boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
                  }}
                  playbackRate={playbackRate}
                  showPlaybackRateControl
                  controls
                  clickToPlay
                />
              )}
            </div>

            {/* Timeline (collapsible) */}
            {ready && effectiveSegments && timelineVisible && (
              <div style={{ flexShrink: 0, borderTop: `1px solid ${S.border}` }}>
                <Timeline
                  segments={segments}
                  coldOpenFrames={coldOpenFrames}
                  introFrames={introFrames}
                  outroFrames={outroFrames}
                  questionCardFrames={questionCardFrames}
                  fps={FPS}
                  playerRef={playerRef}
                  playerFrameRef={playerFrameRef}
                  clipEdits={clipEdits}
                  onSplit={handleTimelineSplit}
                  onDeleteRange={deleteRange}
                  onResetClip={resetClip}
                  onUndo={undoClipEdit}
                  playbackRate={playbackRate}
                  onPlaybackRateChange={setPlaybackRate}
                />
              </div>
            )}

            {/* Bottom bar: timeline toggle + playback info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', borderTop: `1px solid ${S.border}`, background: '#0a0a0a', flexShrink: 0 }}>
              <button
                onClick={() => setTimelineVisible(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'monospace',
                  background: timelineVisible ? S.surface : 'transparent',
                  border: `1px solid ${timelineVisible ? S.border : 'transparent'}`,
                  color: timelineVisible ? S.muted : S.dim, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                <ChevronRight size={10} style={{ transform: timelineVisible ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                Timeline
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {ready && <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.dim }}>{(totalFrames / FPS).toFixed(1)}s · {FPS}fps</span>}
              </div>
            </div>

          </div>{/* end right */}
        </div>/* end desktop */
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { display: none; }
        .remotion-player-controls { border-radius: 0 0 0 0 !important; }
      `}</style>
    </div>
  )
}
