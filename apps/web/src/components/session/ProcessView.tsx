'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Play, RefreshCw, Loader2, ChevronRight } from 'lucide-react'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import type { SubtitleSettings, SubtitleStyle } from '@/remotion/subtitleTypes'
import { DEFAULT_SUBTITLE_SETTINGS } from '@/remotion/subtitleTypes'
import type { TransitionTheme, IntroSettings, MotionSettings, TransitionStyle, WordTimestamp } from '@/remotion/themeTypes'
import { DEFAULT_TRANSITION_THEME, DEFAULT_INTRO_SETTINGS, DEFAULT_MOTION_SETTINGS, FONT_OPTIONS, THEME_PRESETS } from '@/remotion/themeTypes'
import { ServerRenderer, type ServerRendererHandle } from './ServerRenderer'

const Player = dynamic(() => import('@remotion/player').then((m) => m.Player), { ssr: false })
const LavidzComposition = dynamic(
  () => import('@/remotion/LavidzComposition').then((m) => m.LavidzComposition),
  { ssr: false },
)

const FPS = 30
const QUESTION_CARD_FRAMES = 4 * FPS

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
}

const STANDARD_VOICE_IDS = new Set([
  'CwhRBWXzGAHq8TQ4Fs17','EXAVITQu4vr4xnSDxMaL','FGY2WhTYpPnrIDTdsKH5',
  'IKne3meq5aSn9XLyUdCD','JBFqnCBsd6RMkjVDRZzb','N2lVS1w4EtoT3dr4eOWO',
  'SAz9YHcvj6GT2YYXdXww','SOYHLrjzK2X1ezoPC6cr','TX3LPaxmHKxFdv7VOQHJ',
  'Xb7hH8MSUJpSbSDYk0k2','XrExE9yKIg1WjnnlVkGX','bIHbv24MWmeRgasZH58o',
  'cgSgspJ2msm6clMCkdW9','cjVigY5qzO86Huf0OWal','hpp4J3VqNfWAUOO0d1Us',
  'iP95p4xoKVk53GoZ742B','nPczCjzI2devNBz1zQrb','onwK4e9ZLuTAKqWW03F9',
  'pFZP5JQG7iQjIQuC4Bku','pNInz6obpgDQGcFmaJgB','pqHfZKP75CvOlQylNhV4',
])

interface Voice { id: string; name: string; previewUrl: string; accent: string; gender: string; language: string }

interface Props {
  recordings: RawRecording[]
  themeName: string
  sessionId: string
  themeSlug: string
}

function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const dur = video.duration
      if (!isFinite(dur)) {
        video.currentTime = 1e101
        video.ontimeupdate = () => { video.ontimeupdate = null; resolve(isFinite(video.duration) ? video.duration : 60); video.src = '' }
      } else resolve(dur)
    }
    video.onerror = () => resolve(30)
    video.src = url
  })
}

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio(); a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 4); a.onerror = () => resolve(4); a.src = url
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
  { id: 'theme',       label: 'Transitions', desc: 'Style visuel' },
  { id: 'subtitles',   label: 'Sous-titres', desc: 'Texte & position' },
  { id: 'preview',     label: 'Aperçu',      desc: 'Format & export' },
]

// ─── Reusable UI primitives ───────────────────────────────────────────────────

const S = {
  surface: 'rgba(255,255,255,0.05)' as const,
  border: 'rgba(255,255,255,0.08)' as const,
  text: '#ffffff' as const,
  muted: 'rgba(255,255,255,0.4)' as const,
  dim: 'rgba(255,255,255,0.2)' as const,
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        position: 'relative', width: 44, height: 24, borderRadius: 12,
        background: value ? '#ffffff' : 'rgba(255,255,255,0.12)',
        transition: 'background 0.2s', flexShrink: 0,
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
  return <p style={{ fontSize: 10, color: S.muted, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{children}</p>
}

function SliderRow({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Label>{label}</Label>
        <span style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#ffffff', height: 2 }} />
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: '16px', ...style }}>
      {children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProcessView({ recordings, themeName, sessionId, themeSlug }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [segments, setSegments] = useState<CompositionSegment[] | null>(null)
  const [loadingStep, setLoadingStep] = useState<string>('Initialisation...')
  const [ready, setReady] = useState(false)
  const [voices, setVoices] = useState<Voice[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('EXAVITQu4vr4xnSDxMaL')
  const [format, setFormat] = useState<FormatKey>('9/16')
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS)
  const [theme, setTheme] = useState<TransitionTheme>(DEFAULT_TRANSITION_THEME)
  const [intro, setIntro] = useState<IntroSettings>(DEFAULT_INTRO_SETTINGS)
  const [motionSettings, setMotionSettings] = useState<MotionSettings>(DEFAULT_MOTION_SETTINGS)
  const [localTranscripts, setLocalTranscripts] = useState<Record<string, string>>(() =>
    Object.fromEntries(recordings.map(r => [r.id, r.transcript ?? '']))
  )
  const [wordTimestampsMap, setWordTimestampsMap] = useState<Record<string, WordTimestamp[]>>({})
  const wordTimestampsRef = useRef<Record<string, WordTimestamp[]>>({})
  const [transcribing, setTranscribing] = useState<Record<string, boolean>>({})
  const [silenceCutEnabled, setSilenceCutEnabled] = useState(false)
  const [silenceThreshold, setSilenceThreshold] = useState(-35)
  const [silenceCutError, setSilenceCutError] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)

  const [renderOutputUrl, setRenderOutputUrl] = useState<string | null>(null)
  const [delivering, setDelivering] = useState(false)
  const [delivered, setDelivered] = useState(false)
  const [deliverError, setDeliverError] = useState('')

  const localTranscriptsRef = useRef<Record<string, string>>({})
  const serverRendererRef = useRef<ServerRendererHandle | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlsRef = useRef<string[]>([])
  const durationsRef = useRef<number[]>([])
  const effectiveVideoUrlsRef = useRef<string[]>([])
  const lastProcessedSettingsRef = useRef<{ enabled: boolean; threshold: number } | null>(null)

  useEffect(() => { localTranscriptsRef.current = localTranscripts }, [localTranscripts])
  useEffect(() => { wordTimestampsRef.current = wordTimestampsMap }, [wordTimestampsMap])
  useEffect(() => { fetchVoices(); prepare('EXAVITQu4vr4xnSDxMaL') }, [])

  const fetchVoices = async () => {
    try { const res = await fetch('/api/tts/voices'); if (res.ok) setVoices(await res.json()) } catch {}
  }

  const prepare = async (voiceId: string) => {
    setSilenceCutError('')
    const silenceCutChanged = !lastProcessedSettingsRef.current ||
      lastProcessedSettingsRef.current.enabled !== silenceCutEnabled ||
      lastProcessedSettingsRef.current.threshold !== silenceThreshold

    if (blobUrlsRef.current.length === 0 || silenceCutChanged) {
      blobUrlsRef.current = []; effectiveVideoUrlsRef.current = []; durationsRef.current = []

      for (let i = 0; i < recordings.length; i++) {
        setLoadingStep(silenceCutEnabled ? `Coupure silences ${i+1}/${recordings.length}...` : `Traitement vidéo ${i+1}/${recordings.length}...`)
        let realUrl = recordings[i].videoUrl

        if (silenceCutEnabled) {
          try {
            const res = await fetch('/api/silence-cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl, threshold: silenceThreshold }) })
            if (res.ok) { const { id } = await res.json(); realUrl = `${window.location.origin}/api/silence-cut/${id}` }
            else setSilenceCutError(await res.text())
          } catch { setSilenceCutError('Coupure silences échouée') }
        } else {
          try {
            const res = await fetch('/api/normalize-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl }) })
            if (res.ok) { const d = await res.json(); if (d.normalized && d.id) realUrl = `${window.location.origin}/api/normalize-video/${d.id}` }
          } catch {}
        }

        effectiveVideoUrlsRef.current.push(realUrl)
        const blobUrl = await downloadAsBlob(realUrl)
        blobUrlsRef.current.push(blobUrl)
        durationsRef.current.push(await getVideoDuration(blobUrl))
      }
      lastProcessedSettingsRef.current = { enabled: silenceCutEnabled, threshold: silenceThreshold }
    }

    const ttsUrls: (string | null)[] = []
    for (let i = 0; i < recordings.length; i++) {
      setLoadingStep(`Voix IA ${i+1}/${recordings.length}...`)
      ttsUrls.push(await generateTTS(recordings[i].questionText, voiceId))
    }

    const ttsDurations = await Promise.all(ttsUrls.map(u => u ? getAudioDuration(u) : Promise.resolve(4)))
    const built: CompositionSegment[] = recordings.map((rec, i) => {
      const ttsSecs = ttsDurations[i]
      return {
        id: rec.id, questionText: rec.questionText, videoUrl: blobUrlsRef.current[i],
        transcript: localTranscriptsRef.current[rec.id] ?? rec.transcript,
        wordTimestamps: wordTimestampsRef.current[rec.id],
        videoDurationFrames: Math.max(Math.ceil((isFinite(durationsRef.current[i]) ? durationsRef.current[i] : 60) * FPS), FPS),
        ttsUrl: ttsUrls[i],
        questionDurationFrames: Math.max(Math.ceil((ttsSecs + 0.5) * FPS), 3 * FPS),
      }
    })
    setSegments(built); setReady(true)
  }

  const applyVoice = async () => {
    setRegenerating(true); setReady(false)
    await prepare(selectedVoiceId)
    setRegenerating(false)
  }

  const previewVoice = async (voice: Voice) => {
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null }
    if (previewingVoiceId === voice.id) { setPreviewingVoiceId(null); return }
    setPreviewingVoiceId(voice.id)
    const audio = new Audio(voice.previewUrl); previewAudioRef.current = audio
    audio.onended = () => setPreviewingVoiceId(null); audio.play()
  }

  const updateTranscript = (recordingId: string, text: string) => {
    setLocalTranscripts(p => ({ ...p, [recordingId]: text }))
    setSegments(prev => prev ? prev.map(seg =>
      seg.id === recordingId ? { ...seg, transcript: text || null } : seg
    ) : prev)
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
        updateTranscript(recording.id, transcript)
        if (wordTimestamps?.length) {
          setWordTimestampsMap(p => ({ ...p, [recording.id]: wordTimestamps }))
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
  const totalFrames = segments?.length
    ? Math.max(introFrames + segments.reduce((a, s) => a + (s.questionDurationFrames ?? QUESTION_CARD_FRAMES) + s.videoDurationFrames, 0), 1)
    : 1

  const selectedVoice = voices.find(v => v.id === selectedVoiceId)

  // ─── Step renderers ────────────────────────────────────────────────────────

  const stepVoice = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Silence cut — top */}
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
        {silenceCutError && <p style={{ color: '#f87171', fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{silenceCutError}</p>}
      </Card>

      {/* Current voice */}
      {selectedVoice && (
        <Card>
          <Label>Voix sélectionnée</Label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: S.text, fontWeight: 700, fontSize: 15 }}>{selectedVoice.name}</p>
              {(selectedVoice.gender || selectedVoice.accent) && (
                <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>{[selectedVoice.gender, selectedVoice.accent].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <button
              onClick={applyVoice}
              disabled={regenerating || !ready}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                borderRadius: 10, background: '#fff', color: '#0a0a0a',
                fontSize: 12, fontWeight: 700, opacity: (regenerating || !ready) ? 0.4 : 1,
              }}
            >
              {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Appliquer
            </button>
          </div>
        </Card>
      )}

      {/* Voice list */}
      {voices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>Choisir une voix</Label>
          {voices.map(voice => {
            const isLibrary = !STANDARD_VOICE_IDS.has(voice.id)
            const selected = selectedVoiceId === voice.id
            return (
              <button key={voice.id} onClick={() => setSelectedVoiceId(voice.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                  background: selected ? 'rgba(255,255,255,0.1)' : S.surface,
                  border: `1px solid ${selected ? 'rgba(255,255,255,0.3)' : S.border}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: S.text, fontWeight: 600, fontSize: 14 }}>{voice.name}</span>
                    {isLibrary && (
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
            {/* Editable transcript */}
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
          </Card>
        )
      })}
    </div>
  )

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
          </div>
        )}
      </Card>
    </div>
  )

  const stepTheme = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                fontFamily: font.value, fontWeight: font.weight, fontSize: 14,
                background: theme.fontFamily === font.value ? 'rgba(255,255,255,0.1)' : S.surface,
                border: `1px solid ${theme.fontFamily === font.value ? 'rgba(255,255,255,0.3)' : S.border}`,
                color: theme.fontFamily === font.value ? S.text : S.muted,
              }}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transition style */}
      <div>
        <Label>Style de transition</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {([
            { value: 'zoom-punch', label: 'Zoom Punch', desc: 'TikTok / Reels' },
            { value: 'slide-up',   label: 'Slide Up',   desc: 'Story / Smooth' },
            { value: 'flash',      label: 'Flash Cut',  desc: 'Énergie / Clip' },
            { value: 'none',       label: 'Aucune',     desc: 'Cut direct' },
          ] as { value: TransitionStyle; label: string; desc: string }[]).map(t => (
            <button key={t.value} onClick={() => setMotionSettings(p => ({ ...p, transitionStyle: t.value }))}
              style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                background: motionSettings.transitionStyle === t.value ? 'rgba(255,255,255,0.1)' : S.surface,
                border: `1px solid ${motionSettings.transitionStyle === t.value ? 'rgba(255,255,255,0.3)' : S.border}`,
              }}
            >
              <p style={{ color: motionSettings.transitionStyle === t.value ? S.text : S.muted, fontWeight: 700, fontSize: 13 }}>{t.label}</p>
              <p style={{ color: S.dim, fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Visual effects */}
      <div>
        <Label>Effets visuels</Label>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { key: 'wordPop'     as const, label: 'Word Pop',      desc: 'Bounce sur le mot actif' },
            { key: 'progressBar' as const, label: 'Progress Bar',  desc: 'Barre de progression en haut' },
            { key: 'kenBurns'    as const, label: 'Ken Burns',     desc: 'Zoom lent cinématique' },
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
      </div>
    </div>
  )

  const stepSubtitles = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Style */}
      <div>
        <Label>Style</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['hormozi', 'minimal', 'classic', 'neon'] as SubtitleStyle[]).map(s => (
            <button key={s} onClick={() => setSubtitleSettings(p => ({ ...p, style: s }))}
              style={{
                padding: '12px 14px', borderRadius: 12, fontSize: 13, fontFamily: 'monospace', textTransform: 'capitalize',
                background: subtitleSettings.style === s ? 'rgba(255,255,255,0.1)' : S.surface,
                border: `1px solid ${subtitleSettings.style === s ? 'rgba(255,255,255,0.3)' : S.border}`,
                color: subtitleSettings.style === s ? S.text : S.muted,
              }}
            >
              {s}
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
      </Card>
    </div>
  )

  const fmt = FORMATS[format]
  const stepPreview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Export */}
      {ready && segments && (
        <ServerRenderer
          ref={serverRendererRef}
          segments={segments}
          originalVideoUrls={effectiveVideoUrlsRef.current.length > 0 ? effectiveVideoUrlsRef.current : recordings.map(r => r.videoUrl)}
          voiceId={selectedVoiceId}
          themeName={themeName}
          theme={theme}
          intro={intro}
          subtitleSettings={subtitleSettings}
          questionCardFrames={QUESTION_CARD_FRAMES}
          fps={FPS}
          width={fmt.width}
          height={fmt.height}
          sessionId={sessionId}
          motionSettings={motionSettings}
          onRenderComplete={(url) => setRenderOutputUrl(url)}
        />
      )}

      {/* Back to results */}
      <Link href={`/session/${themeSlug}/result?session=${sessionId}`}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: S.muted, fontSize: 12, fontFamily: 'monospace' }}>
        <ArrowLeft size={12} /> Retour aux résultats
      </Link>
    </div>
  )

  const stepContent = [stepVoice, stepTranscripts, stepIntro, stepTheme, stepSubtitles, stepPreview]

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
        <Link href={`/session/${themeSlug}/result?session=${sessionId}`}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, color: S.muted, fontSize: 13 }}>
            <ArrowLeft size={16} />
          </button>
        </Link>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 14 }}>{themeName}</p>
          <p style={{ color: S.muted, fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Montage automatique</p>
        </div>
        <div style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {!ready && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#f59e0b', animation: 'pulse 1.5s ease infinite' }} />}
        </div>
      </header>

      {/* Loading bar */}
      {!ready && (
        <div style={{ padding: '8px 20px', borderBottom: `1px solid ${S.border}`, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Loader2 size={12} className="animate-spin" style={{ color: S.muted, flexShrink: 0 }} />
          <p style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{loadingStep}</p>
        </div>
      )}

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 20px', borderBottom: `1px solid ${S.border}`, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
        {STEPS.map((step, i) => {
          const active = currentStep === i
          const done = i < currentStep
          return (
            <button key={step.id} onClick={() => setCurrentStep(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                background: active ? '#fff' : done ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: active ? 'none' : `1px solid ${done ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
                color: active ? '#0a0a0a' : done ? 'rgba(255,255,255,0.6)' : S.muted,
                fontSize: 12, fontWeight: active ? 700 : 500, transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.6 }}>{String(i + 1).padStart(2, '0')}</span>
              {step.label}
              {done && <span style={{ fontSize: 9, opacity: 0.7 }}>✓</span>}
            </button>
          )
        })}
      </div>

      {/* Main body: split layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel: step controls + bottom nav */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '42%', minWidth: 320, maxWidth: 480, borderRight: `1px solid ${S.border}`, overflow: 'hidden', flexShrink: 0 }}>
          {/* Step content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            {/* Step header */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 10, fontFamily: 'monospace', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                Étape {currentStep + 1} / {STEPS.length}
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{STEPS[currentStep].label}</h2>
              <p style={{ color: S.muted, fontSize: 13, marginTop: 4 }}>{STEPS[currentStep].desc}</p>
            </div>

            {stepContent[currentStep]}
          </div>

          {/* Bottom nav */}
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {currentStep > 0 && (
                <button onClick={() => setCurrentStep(s => s - 1)}
                  style={{ padding: '12px 18px', borderRadius: 14, background: S.surface, border: `1px solid ${S.border}`, color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600 }}>
                  ←
                </button>
              )}
              {currentStep < STEPS.length - 1 && (
                <button onClick={() => setCurrentStep(s => s + 1)}
                  style={{ flex: 1, padding: '12px', borderRadius: 14, background: '#fff', color: '#0a0a0a', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {STEPS[currentStep + 1].label} <ChevronRight size={14} />
                </button>
              )}
              {currentStep === STEPS.length - 1 && ready && segments && (
                <button
                  onClick={() => serverRendererRef.current?.render()}
                  disabled={serverRendererRef.current?.rendering}
                  style={{ flex: 1, padding: '12px', borderRadius: 14, background: '#fff', color: '#0a0a0a', fontSize: 13, fontWeight: 700, opacity: serverRendererRef.current?.rendering ? 0.5 : 1 }}>
                  {serverRendererRef.current?.rendering ? 'Rendu en cours...' : renderOutputUrl ? 'Ré-exporter' : 'Exporter le montage'}
                </button>
              )}
            </div>
            {/* Deliver button — shown after render completes if this session has a recipient */}
            {renderOutputUrl && sessionId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {delivered ? (
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'rgb(52,211,153)', fontFamily: 'monospace' }}>Email envoyé au client ✓</p>
                ) : (
                  <button
                    onClick={async () => {
                      setDelivering(true)
                      setDeliverError('')
                      try {
                        const res = await fetch(`/api/admin/sessions/${sessionId}/deliver`, { method: 'POST' })
                        if (!res.ok) throw new Error(await res.text())
                        setDelivered(true)
                      } catch (err) {
                        setDeliverError(String(err))
                      } finally {
                        setDelivering(false)
                      }
                    }}
                    disabled={delivering}
                    style={{ padding: '12px', borderRadius: 14, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: 'rgb(52,211,153)', fontSize: 13, fontWeight: 700, opacity: delivering ? 0.6 : 1 }}
                  >
                    {delivering ? 'Envoi...' : 'Confirmer et envoyer au client ✉'}
                  </button>
                )}
                {deliverError && <p style={{ fontSize: 11, color: '#f87171', fontFamily: 'monospace', textAlign: 'center' }}>{deliverError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: format selector + persistent Player */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: '20px', overflow: 'hidden', minWidth: 0 }}>
          {/* Format selector */}
          <div style={{ flexShrink: 0 }}>
            <Label>Format</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(Object.entries(FORMATS) as [FormatKey, typeof FORMATS[FormatKey]][]).map(([key, f]) => (
                <button key={key} onClick={() => setFormat(key)}
                  style={{
                    padding: '10px 8px', borderRadius: 12, textAlign: 'center',
                    background: format === key ? 'rgba(255,255,255,0.1)' : S.surface,
                    border: `1px solid ${format === key ? 'rgba(255,255,255,0.3)' : S.border}`,
                  }}
                >
                  <p style={{ color: format === key ? S.text : S.muted, fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{f.label}</p>
                  <p style={{ color: S.dim, fontSize: 9, marginTop: 3, fontFamily: 'monospace' }}>{f.description}</p>
                </button>
              ))}
            </div>
          </div>
          {/* Player */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden', background: '#000', border: `1px solid ${S.border}` }}>
            {!ready ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48 }}>
                <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ color: S.muted, fontSize: 11, fontFamily: 'monospace' }}>{loadingStep}</p>
              </div>
            ) : segments && (
              <Player
                component={LavidzComposition as any}
                inputProps={{ segments, questionCardFrames: QUESTION_CARD_FRAMES, subtitleSettings, theme, intro, fps: FPS, motionSettings }}
                durationInFrames={totalFrames}
                fps={FPS}
                compositionWidth={fmt.width}
                compositionHeight={fmt.height}
                style={{ width: '100%', aspectRatio: `${fmt.width} / ${fmt.height}`, maxHeight: '100%', display: 'block' }}
                controls
                clickToPlay
              />
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
