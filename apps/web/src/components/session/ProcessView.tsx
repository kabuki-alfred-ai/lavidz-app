'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Play, RefreshCw, Loader2, ChevronRight, Mic2, Palette, Type, Music, Film, Sparkles, MessageSquare, Upload, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import { END_CARD_FRAMES } from '@/remotion/LavidzComposition'
import type { WordTimestamp } from '@/remotion/themeTypes'
import { ServerRenderer, type ServerRendererHandle } from './ServerRenderer'
import { Timeline, type ClipEdit } from './Timeline'
import { useClipEdits } from '@/hooks/useClipEdits'
import AISuggestionsPanel from './AISuggestionsPanel'
import TimelineComments, { type TimelineComment } from './TimelineComments'
import { getMontageProfile } from '@/lib/montage-profiles'
import { useProcessViewState } from '@/hooks/useProcessViewState'
import { useMontageAutoSave } from '@/hooks/useMontageAutoSave'
import { useVoiceProcessing, remapWordTimestamps } from '@/hooks/useVoiceProcessing'
import { useColdOpen } from '@/hooks/useColdOpen'
import { AudioModule } from './modules/AudioModule'
import { StyleModule } from './modules/StyleModule'
import { SubtitlesModule } from './modules/SubtitlesModule'
import { MusicModule } from './modules/MusicModule'
import { BookendsModule } from './modules/BookendsModule'
import { ExportModule } from './modules/ExportModule'
import {
  S, FPS, QUESTION_CARD_FRAMES, FORMATS, PHASES, STYLE_PRESETS,
  type FormatKey, type RawRecording, type Voice,
} from './process-view-utils'
import type { PlayerRef } from '@remotion/player'


const Player = dynamic(() => import('@remotion/player').then((m) => m.Player), { ssr: false })
const LavidzComposition = dynamic(
  () => import('@/remotion/LavidzComposition').then((m) => m.LavidzComposition),
  { ssr: false },
)

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  recordings: RawRecording[]
  themeName: string
  sessionId: string
  themeSlug: string
  montageSettings?: Record<string, any> | null
  contentFormat?: string | null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProcessView({ recordings, themeName, sessionId, themeSlug, montageSettings, contentFormat }: Props) {
  const montageProfile = getMontageProfile(contentFormat)

  // ── All state ──────────────────────────────────────────────────────────────
  const state = useProcessViewState(recordings)
  const {
    currentPhase, setCurrentPhase,
    activeModule, setActiveModule,
    bookendTarget, setBookendTarget,
    segments, setSegments,
    ready, setReady,
    activeSegmentInfo, setActiveSegmentInfo,
    timelineVisible, setTimelineVisible,
    playbackRate, setPlaybackRate,
    questionCardFrames, setQuestionCardFrames,
    format, setFormat,
    theme, setTheme,
    activePresetId, setActivePresetId,
    subtitleSettings, setSubtitleSettings,
    motionSettings, setMotionSettings,
    intro, setIntro,
    outro, setOutro,
    audioSettings, setAudioSettings,
    bgMusicPrompt, setBgMusicPrompt,
    transitionSfxPrompt, setTransitionSfxPrompt,
    soundLibrary, setSoundLibrary,
    sfxLibrary, setSfxLibrary,
    swooshEnabled, setSwooshEnabled,
    popSoundEnabled, setPopSoundEnabled,
    voices, setVoices,
    selectedVoiceId, setSelectedVoiceId,
    voiceEnabled, setVoiceEnabled,
    previewingVoiceId, setPreviewingVoiceId,
    loadingStep, setLoadingStep,
    regenerating, setRegenerating,
    prepareError, setPrepareError,
    silenceCutEnabled, setSilenceCutEnabled,
    silenceThreshold, setSilenceThreshold,
    silenceCutError, setSilenceCutError,
    fillerCutEnabled, setFillerCutEnabled,
    fillerCutError, setFillerCutError,
    cleanvoiceEnabled, setCleanvoiceEnabled,
    cleanvoiceConfig, setCleanvoiceConfig,
    cleanvoiceError, setCleanvoiceError,
    denoiseEnabled, setDenoiseEnabled,
    denoiseStrength, setDenoiseStrength,
    smartCutLoading, setSmartCutLoading,
    smartCutError, setSmartCutError,
    coldOpenEnabled, setColdOpenEnabled,
    coldOpenData, setColdOpenData,
    inlaysEnabled, setInlaysEnabled,
    inlaysData, setInlaysData,
    coldOpenLoading, setColdOpenLoading,
    coldOpenError, setColdOpenError,
    wordEmojisBySegmentId, setWordEmojisBySegmentId,
    coldOpenTextColor, setColdOpenTextColor,
    coldOpenHighlightColor, setColdOpenHighlightColor,
    coldOpenFontFamily, setColdOpenFontFamily,
    coldOpenFontSize, setColdOpenFontSize,
    coldOpenTextPosition, setColdOpenTextPosition,
    coldOpenVideoStyle, setColdOpenVideoStyle,
    coldOpenFreezeFrame, setColdOpenFreezeFrame,
    coldOpenTextAnimEnabled, setColdOpenTextAnimEnabled,
    coldOpenTextAnimation, setColdOpenTextAnimation,
    coldOpenHighlightModeEnabled, setColdOpenHighlightModeEnabled,
    coldOpenHighlightMode, setColdOpenHighlightMode,
    coldOpenSfxEnabled, setColdOpenSfxEnabled,
    coldOpenSfx, setColdOpenSfx,
    coldOpenEntrySfxEnabled, setColdOpenEntrySfxEnabled,
    coldOpenEntrySfx, setColdOpenEntrySfx,
    inlaysStyle, setInlaysStyle,
    inlaysDuration, setInlaysDuration,
    inlaysPopVolume, setInlaysPopVolume,
    bRollEnabled, setBRollEnabled,
    bRollItems, setBRollItems,
    localTranscripts, setLocalTranscripts,
    wordTimestampsMap, setWordTimestampsMap,
    transcribing, setTranscribing,
    ttsCache, setTtsCache,
    processedCache, setProcessedCache,
    renderOutputUrl, setRenderOutputUrl,
    delivering, setDelivering,
    delivered, setDelivered,
    deliverError, setDeliverError,
    hoveredVoiceId, setHoveredVoiceId,
    hoveredTransStyle, setHoveredTransStyle,
    hoveredQCardStyle, setHoveredQCardStyle,
    hoveredQCardTrans, setHoveredQCardTrans,
    hoveredIntroPreset, setHoveredIntroPreset,
    hoveredOutroPreset, setHoveredOutroPreset,
    hoveredFont, setHoveredFont,
    hoveredDenoiseStrength, setHoveredDenoiseStrength,
    hoveredStep, setHoveredStep,
    saveStatus, setSaveStatus,
    timelineComments, setTimelineComments,
    mounted, setMounted,
    isMobile, setIsMobile,
  } = state

  // ── Clip edits ─────────────────────────────────────────────────────────────
  const { clipEdits, splitAt, deleteRange, resetClip, undo: undoClipEdit, restore: restoreClipEdits, applyRanges } = useClipEdits()

  // ── Refs ───────────────────────────────────────────────────────────────────
  const localTranscriptsRef = useRef<Record<string, string>>({})
  const serverRendererRef = useRef<ServerRendererHandle | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const soundPreviewAudioRef = useRef<HTMLAudioElement | null>(null)
  const renderOutputUrlRef = useRef<string | null>(null)
  const playerRef = useRef<PlayerRef | null>(null)
  const playerFrameRef = useRef(0)
  const activeSegIdRef = useRef<string | null>(null)
  const segmentTimelineRef = useRef<{ id: string; startFrame: number; endFrame: number }[]>([])
  const currentStepRef = useRef(0)
  const wordTimestampsRef = useRef<Record<string, WordTimestamp[]>>({})
  const sourceWordTimestampsRef = useRef<Record<string, WordTimestamp[]>>({})

  // ── Voice processing hook ──────────────────────────────────────────────────
  const voiceProcessing = useVoiceProcessing({
    recordings, sessionId,
    silenceCutEnabled, silenceThreshold,
    fillerCutEnabled,
    cleanvoiceEnabled, cleanvoiceConfig,
    denoiseEnabled, denoiseStrength,
    localTranscriptsRef, wordTimestampsRef, sourceWordTimestampsRef,
    ttsCache, processedCache,
    setLoadingStep, setSilenceCutError, setFillerCutError, setCleanvoiceError,
    setWordTimestampsMap, setTtsCache, setProcessedCache,
    setSegments, setReady,
  })

  // ── Cold open hook ─────────────────────────────────────────────────────────
  const { runColdOpenAnalysis } = useColdOpen({
    segments, effectiveSegments: null, // filled below
    ready, wordTimestampsRef,
    setColdOpenEnabled, setColdOpenData, setColdOpenLoading, setColdOpenError,
    setInlaysEnabled, setWordEmojisBySegmentId, setSubtitleSettings,
  })

  // ── Auto-save hook ─────────────────────────────────────────────────────────
  useMontageAutoSave({
    sessionId, selectedVoiceId, voiceEnabled, format, subtitleSettings, theme, intro, outro,
    motionSettings, questionCardFrames, activePresetId, audioSettings,
    bgMusicPrompt, transitionSfxPrompt, silenceCutEnabled, silenceThreshold,
    fillerCutEnabled, denoiseEnabled, denoiseStrength, cleanvoiceEnabled, cleanvoiceConfig,
    localTranscripts, wordTimestampsMap, clipEdits, sourceWordTimestampsRef,
    coldOpenEnabled, coldOpenData, inlaysEnabled, inlaysData, swooshEnabled, popSoundEnabled,
    coldOpenTextColor, coldOpenHighlightColor, coldOpenFontFamily, coldOpenFontSize, coldOpenTextPosition, coldOpenVideoStyle,
    coldOpenFreezeFrame, coldOpenTextAnimEnabled, coldOpenTextAnimation,
    coldOpenHighlightModeEnabled, coldOpenHighlightMode,
    coldOpenSfxEnabled, coldOpenSfx, coldOpenEntrySfxEnabled, coldOpenEntrySfx,
    inlaysStyle, inlaysDuration, inlaysPopVolume,
    bRollEnabled, bRollItems,
    setSaveStatus,
  })

  // ── Derived computed values ────────────────────────────────────────────────
  const introFrames = intro.enabled && intro.hookText ? Math.round(intro.durationSeconds * FPS) : 0
  const outroFrames = outro.enabled && (outro.ctaText || outro.subText || outro.logoUrl) ? Math.round(outro.durationSeconds * FPS) : 0

  const effectiveSegments = useMemo(() => {
    if (!segments?.length) return segments
    const withEmojis = segments.map(seg => {
      const emojis = wordEmojisBySegmentId[seg.id]
      return emojis ? { ...seg, wordEmojis: emojis } : seg
    })
    if (!clipEdits.length) return withEmojis
    return withEmojis.map(seg => {
      const edit = clipEdits.find(e => e.recordingId === seg.id)
      if (!edit || edit.visibleRanges.length === 0) return seg
      const totalVisibleFrames = edit.visibleRanges.reduce((a, r) => a + (r.endFrame - r.startFrame), 0)
      let remappedWts = seg.wordTimestamps
      if (seg.wordTimestamps?.length) {
        const keepIntervals = edit.visibleRanges.map(r => ({
          start: r.startFrame / FPS,
          end: r.endFrame / FPS,
        }))
        remappedWts = remapWordTimestamps(seg.wordTimestamps, keepIntervals)
      }
      const cutTranscript = remappedWts?.map(w => w.word).join(' ') ?? seg.transcript
      return {
        ...seg,
        transcript: cutTranscript,
        videoDurationFrames: totalVisibleFrames,
        wordTimestamps: remappedWts,
        visibleRanges: edit.visibleRanges,
      }
    })
  }, [segments, clipEdits, wordEmojisBySegmentId])

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
        freezeFrame: coldOpenFreezeFrame || undefined,
        textAnimation: coldOpenTextAnimEnabled ? coldOpenTextAnimation : undefined,
        highlightMode: coldOpenHighlightModeEnabled ? coldOpenHighlightMode : undefined,
        coldOpenSfx: coldOpenSfxEnabled && coldOpenSfx ? coldOpenSfx : undefined,
        entrySfx: coldOpenEntrySfxEnabled && coldOpenEntrySfx ? coldOpenEntrySfx : undefined,
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
    if (bRollEnabled && bRollItems.length > 0) {
      ms.bRolls = {
        enabled: true,
        items: bRollItems,
      }
    }
    return ms
  }, [motionSettings, coldOpenEnabled, coldOpenData, inlaysEnabled, inlaysData, swooshEnabled, popSoundEnabled,
      coldOpenTextColor, coldOpenHighlightColor, coldOpenFontFamily, coldOpenFontSize, coldOpenTextPosition, coldOpenVideoStyle,
      coldOpenFreezeFrame, coldOpenTextAnimEnabled, coldOpenTextAnimation,
      coldOpenHighlightModeEnabled, coldOpenHighlightMode,
      coldOpenSfxEnabled, coldOpenSfx, coldOpenEntrySfxEnabled, coldOpenEntrySfx,
      inlaysStyle, inlaysDuration, inlaysPopVolume,
      bRollEnabled, bRollItems])

  const coldOpenFrames = coldOpenEnabled && coldOpenData
    ? Math.round((coldOpenData.endInSeconds - coldOpenData.startInSeconds) * FPS)
    : 0

  // Hide question cards for formats that don't use them (teleprompter, hot take, daily tip)
  const effectiveQuestionCardFrames = montageProfile.showQuestionCards ? questionCardFrames : 0

  const totalFramesBase = effectiveSegments?.length
    ? Math.max(introFrames + outroFrames + END_CARD_FRAMES + effectiveSegments.reduce((a, s) => a + (s.questionDurationFrames ?? effectiveQuestionCardFrames) + s.videoDurationFrames, 0), 1)
    : 1
  const totalFrames = totalFramesBase + coldOpenFrames

  // ── Effects ────────────────────────────────────────────────────────────────

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderOutputUrlRef.current) URL.revokeObjectURL(renderOutputUrlRef.current)
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null }
      if (soundPreviewAudioRef.current) { soundPreviewAudioRef.current.pause(); soundPreviewAudioRef.current = null }
      voiceProcessing.prepareAbortRef.current?.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync ref with state
  useEffect(() => { currentStepRef.current = currentPhase }, [currentPhase])
  useEffect(() => { localTranscriptsRef.current = localTranscripts }, [localTranscripts])
  useEffect(() => { wordTimestampsRef.current = wordTimestampsMap }, [wordTimestampsMap])
  useEffect(() => { segmentTimelineRef.current = segmentTimeline }, [segmentTimeline])

  // RAF for player frame tracking
  useEffect(() => {
    let rafId: number
    const tick = () => {
      const f = (playerRef.current as any)?.getCurrentFrame?.() ?? 0
      playerFrameRef.current = f
      const tl = segmentTimelineRef.current
      let found: { id: string; localTimeSec: number } | null = null
      for (const seg of tl) {
        if (f >= seg.startFrame && f < seg.endFrame) {
          found = { id: seg.id, localTimeSec: (f - seg.startFrame) / FPS }
          break
        }
      }
      if ((found?.id ?? null) !== activeSegIdRef.current) {
        activeSegIdRef.current = found?.id ?? null
        setActiveSegmentInfo(found)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Responsive
  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore settings from DB on mount + init raw segments immediately
  useEffect(() => {
    fetchVoices()
    fetch('/api/sfx-library').then(r => r.ok ? r.json() : []).then(setSfxLibrary).catch(() => {})
    fetch('/api/admin/sounds').then(r => r.ok ? r.json() : []).then(setSoundLibrary).catch(() => {})

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
      setInlaysEnabled(false)
      if (typeof s.swooshEnabled === 'boolean') setSwooshEnabled(s.swooshEnabled)
      setPopSoundEnabled(false)
      if (s.coldOpenTextColor) setColdOpenTextColor(s.coldOpenTextColor)
      if (s.coldOpenHighlightColor) setColdOpenHighlightColor(s.coldOpenHighlightColor)
      if (s.coldOpenFontFamily) setColdOpenFontFamily(s.coldOpenFontFamily)
      if (typeof s.coldOpenFontSize === 'number') setColdOpenFontSize(s.coldOpenFontSize)
      if (s.coldOpenTextPosition) setColdOpenTextPosition(s.coldOpenTextPosition)
      if (s.coldOpenVideoStyle) setColdOpenVideoStyle(s.coldOpenVideoStyle)
      if (typeof s.coldOpenFreezeFrame === 'boolean') setColdOpenFreezeFrame(s.coldOpenFreezeFrame)
      if (typeof s.coldOpenTextAnimEnabled === 'boolean') setColdOpenTextAnimEnabled(s.coldOpenTextAnimEnabled)
      if (s.coldOpenTextAnimation) setColdOpenTextAnimation(s.coldOpenTextAnimation)
      if (typeof s.coldOpenHighlightModeEnabled === 'boolean') setColdOpenHighlightModeEnabled(s.coldOpenHighlightModeEnabled)
      if (s.coldOpenHighlightMode) setColdOpenHighlightMode(s.coldOpenHighlightMode)
      if (typeof s.coldOpenSfxEnabled === 'boolean') setColdOpenSfxEnabled(s.coldOpenSfxEnabled)
      if (s.coldOpenSfx) setColdOpenSfx(s.coldOpenSfx)
      if (typeof s.coldOpenEntrySfxEnabled === 'boolean') setColdOpenEntrySfxEnabled(s.coldOpenEntrySfxEnabled)
      if (s.coldOpenEntrySfx) setColdOpenEntrySfx(s.coldOpenEntrySfx)
      if (s.inlaysStyle) setInlaysStyle(s.inlaysStyle)
      if (typeof s.inlaysDuration === 'number') setInlaysDuration(s.inlaysDuration)
      if (typeof s.inlaysPopVolume === 'number') setInlaysPopVolume(s.inlaysPopVolume)
      if (typeof s.bRollEnabled === 'boolean') setBRollEnabled(s.bRollEnabled)
      if (Array.isArray(s.bRollItems)) setBRollItems(s.bRollItems)
    }

    // Initialize asset caches from recording DB fields
    const initTts: Record<string, { voiceId: string; url: string }> = {}
    const initProcessed: Record<string, { hash: string; url: string }> = {}
    const initWordTs: Record<string, WordTimestamp[]> = {}
    for (const r of recordings) {
      if (r.ttsAudioKey && r.ttsVoiceId) {
        initTts[r.id] = { voiceId: r.ttsVoiceId, url: '' }
      }
      if (r.processedVideoKey && r.processingHash) {
        initProcessed[r.id] = { hash: r.processingHash, url: '' }
      }
      if (r.wordTimestamps?.length && !sourceWordTimestampsRef.current[r.id]) {
        initWordTs[r.id] = r.wordTimestamps as WordTimestamp[]
        sourceWordTimestampsRef.current[r.id] = r.wordTimestamps as WordTimestamp[]
      }
    }
    if (Object.keys(initTts).length) setTtsCache(initTts)
    if (Object.keys(initProcessed).length) setProcessedCache(initProcessed)
    if (Object.keys(initWordTs).length) setWordTimestampsMap(prev => ({ ...initWordTs, ...prev }))

    // UX improvement: initialize player with raw video URLs immediately on mount
    // so the editor sees the video before any audio processing
    const rawSegments: CompositionSegment[] = recordings.map(rec => ({
      id: rec.id,
      questionText: rec.questionText,
      videoUrl: rec.videoUrl,
      transcript: rec.transcript,
      wordTimestamps: rec.wordTimestamps as WordTimestamp[] | undefined,
      videoDurationFrames: 120 * FPS, // placeholder — will be updated after prepare()
      ttsUrl: null,
      questionDurationFrames: 3 * FPS,
    }))
    setSegments(rawSegments)
    setReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const fetchVoices = async () => {
    try { const res = await fetch('/api/tts/voices'); if (res.ok) setVoices(await res.json()) } catch {}
  }

  const applyVoice = async () => {
    setPrepareError('')
    setRegenerating(true); setReady(false)
    try {
      await voiceProcessing.prepare(voiceEnabled ? selectedVoiceId : null)
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
      const { generateTTS } = await import('./process-view-utils')
      const sampleUrl = await generateTTS('Bonjour, je suis votre voix IA pour vos vid\u00e9os.', voice.id)
      if (!sampleUrl) { setPreviewingVoiceId(null); return }
      previewSrc = sampleUrl
    }
    const audio = new Audio(previewSrc); previewAudioRef.current = audio
    audio.onended = () => setPreviewingVoiceId(null); audio.play()
  }

  const runSmartMontage = async () => {
    if (!ready || !segments?.length) {
      setSmartCutError('Lance d\'abord la pr\u00e9paration (bouton "Pr\u00e9parer") pour charger les vid\u00e9os.')
      return
    }
    setSmartCutLoading(true)
    setSmartCutError('')
    try {
      for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i]
        const transcript = localTranscriptsRef.current[rec.id] ?? rec.transcript ?? ''
        const wts = segments[i]?.wordTimestamps ?? wordTimestampsRef.current[rec.id] ?? []
        if (!transcript) continue
        const duration = voiceProcessing.durationsRef.current[i]
        if (!duration || !isFinite(duration)) continue
        const res = await fetch('/api/smart-cut', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, wordTimestamps: wts, duration }),
        })
        if (!res.ok) { setSmartCutError(await res.text()); return }
        const { segments: smartSegs } = await res.json()
        if (!smartSegs?.length) continue
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

  // Cold open needs effectiveSegments — create a bound version
  const { runColdOpenAnalysis: runColdOpenBound } = useColdOpen({
    segments, effectiveSegments,
    ready, wordTimestampsRef,
    setColdOpenEnabled, setColdOpenData, setColdOpenLoading, setColdOpenError,
    setInlaysEnabled, setWordEmojisBySegmentId, setSubtitleSettings,
  })

  const updateTranscript = (recordingId: string, text: string, fromApi = false) => {
    setLocalTranscripts(p => ({ ...p, [recordingId]: text }))
    setSegments(prev => prev ? prev.map(seg =>
      seg.id === recordingId ? { ...seg, transcript: text || null } : seg
    ) : prev)
    if (!fromApi) {
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
      }
    } catch (e) {
      console.error('[transcribe] fetch error:', e)
    } finally {
      setTranscribing(p => ({ ...p, [recording.id]: false }))
    }
  }

  const handleTimelineSplit = useCallback((recordingId: string, frameInClip: number) => {
    const seg = segments?.find(s => s.id === recordingId)
    if (!seg) return
    splitAt(recordingId, frameInClip, seg.videoDurationFrames)
  }, [segments, splitAt])

  const handleAddComment = useCallback((timestamp: number, text: string) => {
    const comment: TimelineComment = {
      id: `comment-${Date.now()}`,
      timestamp, text,
      author: 'Monteur', authorRole: 'editor',
      resolved: false,
      createdAt: new Date().toISOString(),
    }
    setTimelineComments(prev => [...prev, comment])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResolveComment = useCallback((id: string) => {
    setTimelineComments(prev => prev.map(c => c.id === id ? { ...c, resolved: true } : c))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteComment = useCallback((id: string) => {
    setTimelineComments(prev => prev.filter(c => c.id !== id))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Module system ──────────────────────────────────────────────────────────
  type ModuleId = 'audio' | 'hook' | 'style' | 'subtitles' | 'music' | 'bookends' | 'ai' | 'comments' | 'export'

  const allModules: { id: ModuleId; label: string; description: string; icon: LucideIcon; show: boolean }[] = [
    { id: 'audio',     label: 'Audio',            description: 'Nettoyage audio et voix IA',                 icon: Mic2,           show: true },
    { id: 'hook',      label: 'Cold Open',        description: 'Accroche video et incrustations',            icon: Zap,            show: montageProfile.showColdOpen },
    { id: 'style',     label: 'Style & Effets',    description: 'Effets visuels, zoom dynamique et theme',          icon: Palette,        show: true },
    { id: 'subtitles', label: 'Transcripts',       description: 'Sous-titres et synchronisation',             icon: Type,           show: true },
    { id: 'music',     label: 'Musique',           description: 'Musique de fond et effets sonores',          icon: Music,          show: true },
    { id: 'bookends',  label: 'Intro & Outro',     description: 'Slides d\'entr\u00e9e et de sortie',               icon: Film,           show: montageProfile.showQuestionCards },
    { id: 'ai',        label: 'Suggestions IA',   description: 'Recommandations intelligentes',              icon: Sparkles,       show: true },
    { id: 'comments',  label: 'Commentaires',      description: 'Notes et retours sur la timeline',           icon: MessageSquare,  show: true },
    { id: 'export',    label: 'Exporter',          description: 'Rendu final et t\u00e9l\u00e9chargement',                icon: Upload,         show: true },
  ]
  const visibleModules = allModules.filter(m => m.show)
  const fmt = FORMATS[format]

  // Helper to find the current active module definition
  const activeModuleDef = visibleModules.find(m => m.id === activeModule) ?? visibleModules[0]

  // ── Loading gate ───────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: 'rgba(255,255,255,0.6)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Module content renderer ────────────────────────────────────────────────
  const audioModuleProps = {
    cleanvoiceEnabled, setCleanvoiceEnabled, cleanvoiceConfig, setCleanvoiceConfig, cleanvoiceError,
    silenceCutEnabled, setSilenceCutEnabled, silenceThreshold, setSilenceThreshold, silenceCutError,
    fillerCutEnabled, setFillerCutEnabled, fillerCutError,
    smartCutLoading, runSmartMontage, smartCutError,
    coldOpenLoading, runColdOpenAnalysis: runColdOpenBound, coldOpenError,
    coldOpenData, setColdOpenData, coldOpenEnabled, setColdOpenEnabled,
    coldOpenVideoStyle, setColdOpenVideoStyle,
    coldOpenTextPosition, setColdOpenTextPosition,
    coldOpenTextColor, setColdOpenTextColor,
    coldOpenHighlightColor, setColdOpenHighlightColor,
    coldOpenFontFamily, setColdOpenFontFamily,
    coldOpenFontSize, setColdOpenFontSize,
    coldOpenFreezeFrame, setColdOpenFreezeFrame,
    coldOpenTextAnimEnabled, setColdOpenTextAnimEnabled,
    coldOpenTextAnimation, setColdOpenTextAnimation,
    coldOpenHighlightModeEnabled, setColdOpenHighlightModeEnabled,
    coldOpenHighlightMode, setColdOpenHighlightMode,
    coldOpenSfxEnabled, setColdOpenSfxEnabled,
    coldOpenSfx, setColdOpenSfx,
    coldOpenEntrySfxEnabled, setColdOpenEntrySfxEnabled,
    coldOpenEntrySfx, setColdOpenEntrySfx,
    swooshEnabled, setSwooshEnabled,
    denoiseEnabled, setDenoiseEnabled, denoiseStrength, setDenoiseStrength,
    hoveredDenoiseStrength, setHoveredDenoiseStrength,
    showTTS: montageProfile.showTTS,
    voiceEnabled, setVoiceEnabled,
    voices, selectedVoiceId, setSelectedVoiceId,
    hoveredVoiceId, setHoveredVoiceId,
    previewingVoiceId, previewVoice,
    audioSettings, setAudioSettings,
    soundLibrary, soundPreviewAudioRef,
  }

  const styleModuleProps = {
    activePresetId, setActivePresetId,
    theme, setTheme,
    hoveredFont, setHoveredFont,
    motionSettings, setMotionSettings,
    hoveredTransStyle, setHoveredTransStyle,
    hoveredQCardStyle, setHoveredQCardStyle,
    hoveredQCardTrans, setHoveredQCardTrans,
    subtitleSettings, setSubtitleSettings,
    questionCardFrames, setQuestionCardFrames,
    setFormat,
    audioSettings, setAudioSettings,
    soundLibrary, soundPreviewAudioRef,
    coldOpenLoading, ready, runColdOpenAnalysis: runColdOpenBound,
    segments, wordEmojisBySegmentId, setWordEmojisBySegmentId,
  }

  // Module header component
  const ModuleHeader = ({ label, description }: { label: string; description: string }) => (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 4, margin: 0 }}>{label}</h3>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0 }}>{description}</p>
    </div>
  )

  const moduleContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: activeModule === 'audio' ? 'block' : 'none' }}>
        <ModuleHeader label="Audio" description="Nettoyage audio et voix IA" />
        <AudioModule {...audioModuleProps} hideColdOpen />
      </div>
      <div style={{ display: activeModule === 'hook' ? 'block' : 'none' }}>
        <ModuleHeader label="Cold Open" description="Accroche video et incrustations" />
        <AudioModule {...audioModuleProps} showOnlyColdOpen />
      </div>
      <div style={{ display: activeModule === 'style' ? 'block' : 'none' }}>
        <ModuleHeader label="Style" description="Theme visuel, transitions et typographie" />
        <StyleModule {...styleModuleProps} />
      </div>
      <div style={{ display: activeModule === 'subtitles' ? 'block' : 'none' }}>
        <ModuleHeader label={"Transcripts"} description={"Sous-titres et synchronisation"} />
        <SubtitlesModule
          recordings={recordings}
          localTranscripts={localTranscripts}
          wordTimestampsMap={wordTimestampsMap}
          transcribing={transcribing}
          clipEdits={clipEdits}
          playerFrameRef={playerFrameRef}
          segmentTimelineRef={segmentTimelineRef}
          wordTimestampsRef={wordTimestampsRef}
          localTranscriptsRef={localTranscriptsRef}
          segments={segments}
          setWordTimestampsMap={setWordTimestampsMap}
          setLocalTranscripts={setLocalTranscripts}
          setSegments={setSegments}
          regenerateTranscript={regenerateTranscript}
          updateTranscript={updateTranscript}
        />
      </div>
      <div style={{ display: activeModule === 'music' ? 'block' : 'none' }}>
        <ModuleHeader label={"Musique"} description={"Musique de fond et effets sonores"} />
        <MusicModule
          audioSettings={audioSettings}
          setAudioSettings={setAudioSettings}
          soundLibrary={soundLibrary}
          soundPreviewAudioRef={soundPreviewAudioRef}
        />
      </div>
      <div style={{ display: activeModule === 'bookends' ? 'block' : 'none' }}>
        <ModuleHeader label={"Intro & Outro"} description={"Slides d'entree et de sortie"} />
        <BookendsModule
          bookendTarget={bookendTarget}
          setBookendTarget={setBookendTarget}
          intro={intro} setIntro={setIntro}
          outro={outro} setOutro={setOutro}
          theme={theme}
          audioSettings={audioSettings} setAudioSettings={setAudioSettings}
          hoveredIntroPreset={hoveredIntroPreset} setHoveredIntroPreset={setHoveredIntroPreset}
          hoveredOutroPreset={hoveredOutroPreset} setHoveredOutroPreset={setHoveredOutroPreset}
          soundLibrary={soundLibrary}
          soundPreviewAudioRef={soundPreviewAudioRef}
        />
      </div>
      <div style={{ display: activeModule === 'ai' ? 'block' : 'none' }}>
        <ModuleHeader label={"Suggestions IA"} description={"Recommandations intelligentes"} />
        <AISuggestionsPanel
          transcript={(effectiveSegments ?? []).map(s => s.transcript).filter(Boolean).join('\n\n') || null}
          wordTimestamps={(effectiveSegments ?? []).flatMap(s => s.wordTimestamps ?? []) || null}
          duration={(effectiveSegments ?? []).reduce((sum, s) => sum + s.videoDurationFrames / 30, 0)}
          onSeekTo={(t) => playerRef.current?.seekTo(Math.round(t * 30))}
          onBRollSearch={(query) => window.open(`/admin/broll?search=${encodeURIComponent(query)}`, '_blank')}
          selectedBRolls={bRollItems}
          onSelectBRoll={(broll) => {
            setBRollItems(prev => [...prev.filter(b => b.id !== broll.id), broll])
            if (!bRollEnabled) setBRollEnabled(true)
          }}
          onRemoveBRoll={(id) => {
            setBRollItems(prev => {
              const next = prev.filter(b => b.id !== id)
              if (next.length === 0) setBRollEnabled(false)
              return next
            })
          }}
        />
      </div>
      <div style={{ display: activeModule === 'comments' ? 'block' : 'none' }}>
        <ModuleHeader label={"Commentaires"} description={"Notes et retours sur la timeline"} />
        <TimelineComments
          comments={timelineComments}
          currentTime={0}
          duration={(effectiveSegments ?? []).reduce((sum, s) => sum + s.videoDurationFrames / 30, 0)}
          userRole="editor"
          onAddComment={handleAddComment}
          onResolveComment={handleResolveComment}
          onDeleteComment={handleDeleteComment}
          onSeekTo={(t) => playerRef.current?.seekTo(Math.round(t * 30))}
        />
      </div>
      <div style={{ display: activeModule === 'export' ? 'block' : 'none' }}>
        <ModuleHeader label={"Exporter"} description={"Rendu final et telechargement"} />
        <ExportModule
          ready={ready}
          effectiveSegments={effectiveSegments}
          effectiveVideoUrls={voiceProcessing.effectiveVideoUrlsRef.current}
          recordings={recordings}
          selectedVoiceId={selectedVoiceId}
          themeName={themeName}
          theme={theme}
          intro={intro}
          outro={outro}
          subtitleSettings={subtitleSettings}
          questionCardFrames={questionCardFrames}
          format={format}
          sessionId={sessionId}
          motionSettings={effectiveMotionSettings}
          audioSettings={audioSettings}
          serverRendererRef={serverRendererRef}
          renderOutputUrl={renderOutputUrl}
          renderOutputUrlRef={renderOutputUrlRef}
          setRenderOutputUrl={setRenderOutputUrl}
        />
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>

      {/* HEADER */}
      <header style={{
        display: 'flex', alignItems: 'center',
        height: 48, paddingLeft: 12, paddingRight: 16,
        borderBottom: `1px solid ${S.border}`, flexShrink: 0,
        background: 'rgba(10,10,10,0.98)',
      }}>
        {/* Left: back + logo + session name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
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
            <span style={{ color: S.muted, fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{themeName}</span>
          </div>
          {contentFormat && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: S.dim, fontWeight: 600 }}>
              {montageProfile.label}
            </span>
          )}
        </div>

        {/* Right: save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {saveStatus === 'saving' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.dim }}>Sauvegarde...</span>}
          {saveStatus === 'saved' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(52,211,153,0.6)' }}>Sauvegard\u00e9</span>}
          {saveStatus === 'error' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.error }}>Erreur</span>}
          {!ready && saveStatus === 'idle' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s ease infinite' }} />}
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
          <p style={{ color: S.error, fontSize: 11, fontFamily: 'monospace' }}>{prepareError}</p>
          <button onClick={() => setPrepareError('')} style={{ color: S.error, fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, opacity: 0.7 }}>x</button>
        </div>
      )}

      {/* MAIN BODY */}
      {isMobile ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'hidden' }}>
            {ready && segments ? (
              <Player ref={playerRef as any} component={LavidzComposition as any}
                inputProps={{ segments: effectiveSegments, questionCardFrames: effectiveQuestionCardFrames, subtitleSettings, theme, intro, outro, fps: FPS, motionSettings: effectiveMotionSettings, audioSettings }}
                durationInFrames={totalFrames} fps={FPS} compositionWidth={fmt.width} compositionHeight={fmt.height}
                style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: `${fmt.width} / ${fmt.height}`, display: 'block' }}
                playbackRate={playbackRate} showPlaybackRateControl controls clickToPlay />
            ) : (
              <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.7 }}>
                Configurez vos param\u00e8tres<br />puis cliquez sur <strong style={{ color: S.muted }}>G\u00e9n\u00e9rer</strong>
              </p>
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
            {moduleContent}
          </div>
          {renderOutputUrl && sessionId && (
            <div style={{ padding: '8px 16px', borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
              {delivered ? <p style={{ textAlign: 'center', fontSize: 12, color: 'rgb(52,211,153)', fontFamily: 'monospace' }}>Email envoy\u00e9</p> : (
                <button disabled={delivering} onClick={async () => { setDelivering(true); setDeliverError(''); try { const r = await fetch(`/api/admin/sessions/${sessionId}/deliver`, { method: 'POST' }); if (!r.ok) throw new Error(await r.text()); setDelivered(true) } catch (e) { setDeliverError(String(e)) } finally { setDelivering(false) } }}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: 'rgb(52,211,153)' }}>
                  {delivering ? 'Envoi...' : 'Envoyer au client'}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Desktop: icon sidebar + content panel + canvas right */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* LEFT SIDEBAR: Icon bar + Content panel */}
          <div style={{ display: 'flex', width: 480, flexShrink: 0, borderRight: `1px solid ${S.border}`, overflow: 'hidden' }}>

            {/* Vertical icon bar */}
            <div style={{
              width: 48, background: '#0a0a0a',
              borderRight: `1px solid ${S.border}`,
              display: 'flex', flexDirection: 'column',
              flexShrink: 0,
            }}>
              {visibleModules.map((m, idx) => {
                const isActive = activeModule === m.id
                const isExport = m.id === 'export'
                const IconComponent = m.icon
                return (
                  <button
                    key={m.id}
                    title={m.label}
                    onClick={() => setActiveModule(m.id)}
                    style={{
                      position: 'relative',
                      width: 48,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: isActive ? '#ffffff' : S.dim,
                      transition: 'all 0.15s',
                      marginTop: isExport ? 'auto' : 0,
                      borderTop: isExport ? `1px solid ${S.border}` : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.color = S.muted
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.color = S.dim
                    }}
                  >
                    {/* Active left accent */}
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 2,
                        borderRadius: 1,
                        background: S.accent,
                      }} />
                    )}
                    <IconComponent size={16} />
                  </button>
                )
              })}
            </div>

            {/* Content panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#111111' }}>

              {/* Scrollable module content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {moduleContent}
              </div>

              {/* Generate CTA -- pinned bottom */}
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${!regenerating ? S.border : 'rgba(255,255,255,0.12)'}`, flexShrink: 0, background: regenerating ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                <button
                  onClick={applyVoice}
                  disabled={regenerating}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    padding: '13px 0',
                    borderRadius: 12,
                    background: regenerating ? 'rgba(255,255,255,0.07)' : S.surface,
                    border: `1px solid ${S.borderHover}`,
                    color: S.text,
                    fontSize: 12, fontWeight: 700,
                    cursor: regenerating ? 'not-allowed' : 'pointer',
                    opacity: regenerating ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {regenerating
                    ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> G\u00e9n\u00e9ration en cours...</>
                    : <><RefreshCw size={12} /> Appliquer les changements</>
                  }
                </button>
              </div>

              {/* Deliver action */}
              {renderOutputUrl && sessionId && (
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
                  {delivered ? (
                    <p style={{ textAlign: 'center', fontSize: 11, color: 'rgb(52,211,153)', fontFamily: 'monospace' }}>Email envoy\u00e9 au client</p>
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
                      {delivering ? 'Envoi...' : 'Confirmer et envoyer au client'}
                    </button>
                  )}
                  {deliverError && <p style={{ fontSize: 11, color: S.error, fontFamily: 'monospace', marginTop: 6, textAlign: 'center' }}>{deliverError}</p>}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: CANVAS + TIMELINE */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505' }}>

            {/* Canvas area */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

              {/* Format selector -- floating top-left */}
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

              {/* Ready badge -- floating top-right */}
              {ready && (
                <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', backdropFilter: 'blur(8px)' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgb(52,211,153)' }} />
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgb(52,211,153)' }}>Preview</span>
                </div>
              )}

              {/* Video player */}
              {ready && segments ? (
                <Player
                  ref={playerRef as any}
                  component={LavidzComposition as any}
                  inputProps={{ segments: effectiveSegments, questionCardFrames: effectiveQuestionCardFrames, subtitleSettings, theme, intro, outro, fps: FPS, motionSettings: effectiveMotionSettings, audioSettings }}
                  durationInFrames={totalFrames}
                  fps={FPS}
                  compositionWidth={fmt.width}
                  compositionHeight={fmt.height}
                  style={{
                    maxWidth: '100%', maxHeight: '100%',
                    aspectRatio: `${fmt.width} / ${fmt.height}`,
                    display: 'block',
                    boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
                  }}
                  playbackRate={playbackRate}
                  showPlaybackRateControl
                  controls
                  clickToPlay
                />
              ) : regenerating ? (
                /* Processing state */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ position: 'relative', width: 56, height: 56 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.06)' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'rgba(255,255,255,0.7)', animation: 'spin 0.9s linear infinite' }} />
                    <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: S.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={14} style={{ color: S.muted, animation: 'spin 1.2s linear infinite reverse' }} />
                    </div>
                  </div>
                  <div>
                    <p style={{ color: S.muted, fontSize: 13, fontWeight: 600 }}>G\u00e9n\u00e9ration en cours</p>
                    <p style={{ color: S.dim, fontSize: 11, fontFamily: 'monospace', marginTop: 6 }}>{loadingStep}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Timeline */}
            {ready && effectiveSegments && timelineVisible && (
              <div style={{ flexShrink: 0, borderTop: `1px solid ${S.border}` }}>
                <Timeline
                  segments={segments!}
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

            {/* Bottom bar */}
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
                {ready && <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.dim }}>{(totalFrames / FPS).toFixed(1)}s | {FPS}fps</span>}
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
