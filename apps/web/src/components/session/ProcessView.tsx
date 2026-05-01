'use client'

import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
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
import { EasyModePanel, TrimTimeline, BgMusicPicker } from './EasyModePanel'
import { ENERGY_PRESETS, type EnergyLevel } from '@/lib/easy-mode-presets'
import { AudioModule } from './modules/AudioModule'
import { StyleModule } from './modules/StyleModule'
import { SubtitlesModule } from './modules/SubtitlesModule'
import { MusicModule } from './modules/MusicModule'
import { BookendsModule } from './modules/BookendsModule'
import { ExportModule } from './modules/ExportModule'
import {
  S, FPS, QUESTION_CARD_FRAMES, FORMATS, PHASES, STYLE_PRESETS,
  getVideoDuration,
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
  projectId?: string | null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProcessView({ recordings, themeName, sessionId, themeSlug, montageSettings, contentFormat, projectId }: Props) {
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
    coldOpenCandidates, setColdOpenCandidates,
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

  // ── Easy mode state ───────────────────────────────────────────────────────
  const [easyMode] = useState(true)
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('dynamique')
  const [autoApplying, setAutoApplying] = useState(false)
  const [brandKitApplied, setBrandKitApplied] = useState(false)
  const [silenceCutDone, setSilenceCutDone] = useState(false)
  const [silenceRemovedSec, setSilenceRemovedSec] = useState(0)
  const [bRollSuggestions, setBRollSuggestions] = useState<any[]>([])
  const autoAppliedRef = useRef(false)
  // Trim view state (lifted so timeline can render outside panels)
  const [easyEditSubView, setEasyEditSubView] = useState<'none' | 'captions' | 'scenes' | 'trim'>('none')
  const [trimSelected, setTrimSelected] = useState<Record<string, Set<number>>>({})
  const [trimDeleted, setTrimDeleted] = useState<Set<string>>(new Set())
  // Bad takes removal state
  const [badTakesEnabled, setBadTakesEnabled] = useState(false)
  const [badTakesRemovedCount, setBadTakesRemovedCount] = useState(0)
  const [showAudioPopover, setShowAudioPopover] = useState(false)
  const [showAiToolsPopover, setShowAiToolsPopover] = useState(false)
  const [aiToolLoading, setAiToolLoading] = useState<string | null>(null)
  const badTakesSnapshotRef = useRef<Record<string, WordTimestamp[]> | null>(null)

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
    setColdOpenEnabled, setColdOpenData, setColdOpenCandidates,
    setColdOpenLoading, setColdOpenError,
    setInlaysEnabled, setWordEmojisBySegmentId, setSubtitleSettings,
  })

  // ── Auto-save hook ─────────────────────────────────────────────────────────
  useMontageAutoSave({
    sessionId, projectId, easyMode, energyLevel,
    selectedVoiceId, voiceEnabled, format, subtitleSettings, theme, intro, outro,
    motionSettings, questionCardFrames, activePresetId, audioSettings,
    bgMusicPrompt, transitionSfxPrompt, silenceCutEnabled, silenceThreshold,
    fillerCutEnabled, denoiseEnabled, denoiseStrength, cleanvoiceEnabled, cleanvoiceConfig,
    localTranscripts, wordTimestampsMap, clipEdits, sourceWordTimestampsRef,
    coldOpenEnabled, coldOpenData, coldOpenCandidates, inlaysEnabled, inlaysData, swooshEnabled, popSoundEnabled,
    coldOpenTextColor, coldOpenHighlightColor, coldOpenFontFamily, coldOpenFontSize, coldOpenTextPosition, coldOpenVideoStyle,
    coldOpenFreezeFrame, coldOpenTextAnimEnabled, coldOpenTextAnimation,
    coldOpenHighlightModeEnabled, coldOpenHighlightMode,
    coldOpenSfxEnabled, coldOpenSfx, coldOpenEntrySfxEnabled, coldOpenEntrySfx,
    inlaysStyle, inlaysDuration, inlaysPopVolume,
    bRollEnabled, bRollItems,
    badTakesEnabled, badTakesRemovedCount,
    setSaveStatus,
  })

  // ── Derived computed values ────────────────────────────────────────────────
  const introFrames = intro.enabled && (intro.hookText || intro.logoUrl) ? Math.round(intro.durationSeconds * FPS) : 0
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

    // Seed subtitle colors from Brand Kit if user hasn't overridden them yet
    fetch('/api/admin/brand-kit', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(bk => {
        if (!bk) return
        setSubtitleSettings(prev => ({
          ...prev,
          fontColor: prev.fontColor ?? '#FFFFFF',
          mainColor: prev.mainColor ?? (bk.primaryColor || '#FF4D1C'),
          secondColor: prev.secondColor ?? (bk.secondaryColor || '#1A1A2E'),
          thirdColor: prev.thirdColor ?? (bk.accentColor || '#E94560'),
        }))
      })
      .catch(() => {})

    if (montageSettings) {
      const s = montageSettings

      if (s.energyLevel) setEnergyLevel(s.energyLevel)
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
      if (Array.isArray(s.coldOpenCandidates)) setColdOpenCandidates(s.coldOpenCandidates)
      setInlaysEnabled(false)
      // Swoosh end-SFX disabled by default — ignore any saved `true` so it doesn't
      // play over the final syllables of the hook. User can re-enable from settings.
      setSwooshEnabled(false)
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
      if (typeof s.badTakesEnabled === 'boolean') setBadTakesEnabled(s.badTakesEnabled)
      if (typeof s.badTakesRemovedCount === 'number') setBadTakesRemovedCount(s.badTakesRemovedCount)
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
      questionDurationFrames: rec._questionDurationFrames ?? 3 * FPS,
    }))
    setSegments(rawSegments)
    setReady(true)

    // Probe actual durations via <video preload="metadata"> so we only
    // download the moov atom per clip, not the full file. Each clip's bytes
    // are fetched on-demand by the Player when scrubbed to.
    Promise.all(
      recordings.map(async (rec) => {
        const dur = await getVideoDuration(rec.videoUrl)
        return { id: rec.id, frames: Math.max(Math.ceil(dur * FPS), FPS) }
      }),
    ).then((durations) => {
      setSegments(prev => prev?.map(seg => {
        const d = durations.find(x => x.id === seg.id)
        return d ? { ...seg, videoDurationFrames: d.frames } : seg
      }) ?? null)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Easy mode: auto-apply pipeline ──────────────────────────────────────
  const runAutoApply = useCallback(async () => {
    if (autoAppliedRef.current) return
    autoAppliedRef.current = true
    setAutoApplying(true)

    try {
      // 1. Apply energy preset
      const preset = ENERGY_PRESETS.dynamique
      setMotionSettings(prev => ({ ...prev, ...preset.motionSettings }))
      setSilenceCutEnabled(true)
      setFillerCutEnabled(preset.fillerCut)
      setSilenceThreshold(preset.silenceThreshold)
      setSubtitleSettings(prev => ({ ...prev, ...preset.subtitleOverrides }))

      // 2. Fetch & apply brand kit
      try {
        const bkRes = await fetch('/api/admin/brand-kit', { credentials: 'include' })
        if (bkRes.ok) {
          const bk = await bkRes.json()
          if (bk) {
            setTheme(prev => ({
              ...prev,
              backgroundColor: bk.primaryColor || prev.backgroundColor,
              textColor: '#FFFFFF',
            }))
            // Do NOT auto-enable intro/outro — they would play before the video and
            // look like orphan subtitles on a blank screen. User can enable manually.
            if (bk.logoUrl) {
              setIntro(prev => ({ ...prev, hookText: themeName, logoUrl: bk.logoUrl, durationSeconds: 3 }))
              setOutro(prev => ({ ...prev, ctaText: 'Abonnez-vous', logoUrl: bk.logoUrl, durationSeconds: 3 }))
            }
            setBrandKitApplied(true)
          }
        }
      } catch {}

      // 3. Auto-select background music from library
      try {
        const soundRes = await fetch('/api/admin/sounds', { credentials: 'include' })
        if (soundRes.ok) {
          const sounds = await soundRes.json()
          setSoundLibrary(sounds)
          const bgSounds = sounds.filter((s: any) => s.tag === 'BACKGROUND')
          if (bgSounds.length > 0) {
            const pick = bgSounds[0]
            setAudioSettings(prev => ({
              ...prev,
              bgMusic: { prompt: pick.id, url: `/api/admin/sounds/${pick.id}/audio`, volume: 0.2 },
            }))
          }
          const introSounds = sounds.filter((s: any) => s.tag === 'INTRO')
          if (introSounds.length > 0) {
            const pick = introSounds[0]
            setAudioSettings(prev => ({
              ...prev,
              introSfx: { prompt: pick.id, url: `/api/admin/sounds/${pick.id}/audio`, volume: 0.8 },
            }))
          }
        }
      } catch {}

      // 4. Run silence/filler cuts via voice processing
      try {
        await voiceProcessing.prepare(null)
        setSilenceCutDone(true)
      } catch {}

      // 5. Run cold open analysis (non-blocking)
      try { runColdOpenAnalysis() } catch {}

      // 6. Fetch B-roll suggestions (per recording, 4 results each)
      try {
        const withResults = await fetchBRollSuggestions()
        const autoItems: import('@/remotion/themeTypes').BRollItem[] = withResults
          .filter((s: any) => s.results?.length > 0)
          .map((s: any) => ({
            id: `auto-${s.timestamp}`,
            timestampSeconds: s.timestamp,
            durationSeconds: s.duration || 3,
            videoUrl: s.results[0].url,
            thumbnailUrl: s.results[0].thumbnailUrl,
            pexelsId: s.results[0].pexelsId,
            searchQuery: s.searchQuery,
          }))
        if (autoItems.length > 0) {
          setBRollEnabled(true)
          setBRollItems(autoItems)
        }
      } catch {}
    } finally {
      setAutoApplying(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnergyChange = useCallback((level: EnergyLevel) => {
    setEnergyLevel(level)
    const preset = ENERGY_PRESETS[level]
    setMotionSettings(prev => ({ ...prev, ...preset.motionSettings }))
    setSilenceThreshold(preset.silenceThreshold)
    setFillerCutEnabled(preset.fillerCut)
    setSubtitleSettings(prev => ({ ...prev, ...preset.subtitleOverrides }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEasySubtitleStyle = useCallback((style: string) => {
    setSubtitleSettings(prev => ({ ...prev, style: style as any }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEasyMusic = useCallback((mood: string) => {
    if (mood === 'none') {
      setAudioSettings(prev => ({ ...prev, bgMusic: undefined }))
      return
    }
    const bgSounds = soundLibrary.filter(s => s.tag === 'BACKGROUND')
    if (bgSounds.length > 0) {
      const pick = bgSounds[Math.min(bgSounds.length - 1, mood === 'chill' ? 0 : mood === 'cinematic' ? Math.min(2, bgSounds.length - 1) : 1)]
      setAudioSettings(prev => ({
        ...prev,
        bgMusic: { prompt: pick.id, url: `/api/admin/sounds/${pick.id}/audio`, volume: 0.2 },
      }))
    }
  }, [soundLibrary]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBRollSelect = useCallback((sugIndex: number, resultIndex: number) => {
    const sug = bRollSuggestions[sugIndex]
    if (!sug?.results?.length) return
    const result = sug.results[resultIndex]
    if (!result) return

    // Remove existing B-roll at this timestamp, then add the selected one
    setBRollItems(prev => {
      const filtered = prev.filter((b) => Math.abs(b.timestampSeconds - sug.timestamp) >= 1)
      return [...filtered, {
        id: `sug-${sug.timestamp}-${resultIndex}`,
        timestampSeconds: sug.timestamp,
        durationSeconds: sug.duration || 3,
        videoUrl: result.url,
        thumbnailUrl: result.thumbnailUrl,
        pexelsId: result.pexelsId,
        searchQuery: sug.searchQuery,
      }]
    })
    setBRollEnabled(true)
  }, [bRollSuggestions]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBRollRemove = useCallback((sugIndex: number) => {
    const sug = bRollSuggestions[sugIndex]
    if (!sug) return
    setBRollItems(prev => prev.filter((b) => Math.abs(b.timestampSeconds - sug.timestamp) >= 1))
  }, [bRollSuggestions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Shared B-roll suggestion fetcher — analyses each recording individually
  const fetchBRollSuggestions = useCallback(async () => {
    const allSuggestions: any[] = []
    let timeOffset = 0

    for (const rec of recordings) {
      if (!rec.transcript || rec.transcript.length < 20) {
        timeOffset += 60 // rough fallback
        continue
      }
      try {
        const sugRes = await fetch('/api/ai-suggestions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: rec.transcript,
            wordTimestamps: rec.wordTimestamps ?? undefined,
            duration: 60,
          }),
        })
        if (sugRes.ok) {
          const data = await sugRes.json()
          if (data.brollSuggestions?.length) {
            for (const sug of data.brollSuggestions) {
              allSuggestions.push({ ...sug, timestamp: sug.timestamp + timeOffset })
            }
          }
        }
      } catch {}
      // Estimate recording duration from word timestamps or fallback
      const lastWord = rec.wordTimestamps?.[rec.wordTimestamps.length - 1]
      timeOffset += lastWord ? lastWord.end + 1 : 60
    }

    // Search Pexels with 4 results per suggestion
    const withResults = await Promise.all(
      allSuggestions.slice(0, 8).map(async (sug: any) => {
        try {
          const searchRes = await fetch(
            `/api/admin/broll/search?q=${encodeURIComponent(sug.searchQuery)}&perPage=4`,
            { credentials: 'include' },
          )
          const results = searchRes.ok ? await searchRes.json() : []
          return { ...sug, results, selectedIndex: 0 }
        } catch { return { ...sug, results: [], selectedIndex: 0 } }
      }),
    )

    setBRollSuggestions(withResults)
    return withResults
  }, [recordings])

  // Auto-apply on mount for easy mode (first visit only)
  useEffect(() => {
    if (!montageSettings && !autoAppliedRef.current) {
      // Small delay to let segments init
      const t = setTimeout(() => runAutoApply(), 500)
      return () => clearTimeout(t)
    }
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
    setColdOpenEnabled, setColdOpenData, setColdOpenCandidates,
    setColdOpenLoading, setColdOpenError,
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
  const fmt = FORMATS[format] ?? FORMATS['9/16']

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
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: '#F8F8FA',
      color: '#1A1A1A',
      transition: 'background 0.2s, color 0.2s',
    }}>

      {/* HEADER */}
      <header style={{
        display: 'flex', alignItems: 'center',
        height: 52, paddingLeft: 14, paddingRight: 16,
        borderBottom: '1px solid #EBEBEF',
        flexShrink: 0,
        background: '#FFFFFF',
      }}>
        {/* Left: back + logo + session name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Link href={projectId ? `/projects/${projectId}` : '/admin/montage'}>
            <button style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              color: '#6B7280',
              background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <ArrowLeft size={15} />
            </button>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="relative w-4 h-4 flex items-center justify-center">
              <span className="block w-2 h-2 bg-primary animate-logo-morph" />
            </div>
            <span className="font-sans font-black text-[12px] tracking-tighter uppercase" style={{ color: '#1A1A1A' }}>LAVIDZ</span>
            <span style={{ color: '#D1D5DB', fontSize: 13, margin: '0 2px' }}>/</span>
            <span style={{ color: '#6B7280', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{themeName}</span>
          </div>
          {contentFormat && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: S.dim, fontWeight: 600 }}>
              {montageProfile.label}
            </span>
          )}
        </div>

        {/* Right: mode toggle + save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

          {saveStatus === 'saving' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9CA3AF' }}>Sauvegarde...</span>}
          {saveStatus === 'saved' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(52,211,153,0.8)' }}>Sauvegarde</span>}
          {saveStatus === 'error' && <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.error }}>Erreur</span>}

          {/* Apply changes button (header, right) */}
          <button
              onClick={applyVoice}
              disabled={regenerating}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid #E5E7EB', cursor: regenerating ? 'default' : 'pointer',
                background: '#FFFFFF', color: '#1A1A1A',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                marginLeft: 4,
                opacity: regenerating ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!regenerating) e.currentTarget.style.background = '#F9FAFB' }}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
            >
              {regenerating
                ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Traitement...</>
                : <><RefreshCw size={12} /> Appliquer</>
              }
            </button>

          {/* Export button (header, right) */}
          <button
              onClick={() => setActiveModule('export')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#FF4D1C', color: '#fff',
                fontSize: 12, fontWeight: 700, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <Upload size={13} /> Exporter
            </button>
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
        <div style={{
          flex: 1, display: 'flex', overflow: 'hidden',
          maxWidth: 1400, margin: '0 auto', padding: '16px 24px', gap: 16, width: '100%',
        }}>

          {/* LEFT SIDEBAR: Easy mode panel */}
            <div style={{
              width: 560, flexShrink: 0, overflow: 'auto',
              padding: '20px 24px', background: '#FFFFFF',
              borderRadius: 12, border: '1px solid #EBEBEF',
            }}>
              <EasyModePanel
                energyLevel={energyLevel}
                silenceCutEnabled={silenceCutEnabled}
                silenceCutDone={silenceCutDone}
                silenceRemovedSec={silenceRemovedSec}
                brandKitApplied={brandKitApplied}
                subtitleSettings={subtitleSettings}
                audioSettings={audioSettings}
                motionSettings={motionSettings}
                coldOpenEnabled={coldOpenEnabled}
                coldOpenPhrase={coldOpenData?.hookPhrase ?? null}
                coldOpenCandidates={coldOpenCandidates}
                coldOpenSelectedPhrase={coldOpenData?.hookPhrase ?? null}
                coldOpenLoading={coldOpenLoading}
                onSelectColdOpenCandidate={(idx: number) => {
                  const c = coldOpenCandidates[idx]
                  if (!c) return
                  setColdOpenData({
                    hookPhrase: c.hookPhrase,
                    startInSeconds: c.startInSeconds,
                    endInSeconds: c.endInSeconds,
                    segmentId: c.segmentId,
                  })
                  setColdOpenEnabled(true)
                }}
                onRegenerateColdOpen={() => { try { runColdOpenBound() } catch {} }}
                coldOpenStart={coldOpenData?.startInSeconds}
                coldOpenEnd={coldOpenData?.endInSeconds}
                coldOpenFontSize={coldOpenFontSize}
                coldOpenTextPosition={coldOpenTextPosition}
                coldOpenTextColor={coldOpenTextColor}
                onColdOpenPhraseChange={(newPhrase) => {
                  setColdOpenData(prev => prev ? { ...prev, hookPhrase: newPhrase } : prev)
                }}
                onColdOpenFontSizeChange={setColdOpenFontSize}
                onColdOpenTextPositionChange={setColdOpenTextPosition}
                onColdOpenTextColorChange={setColdOpenTextColor}
                onColdOpenDurationChange={(sec) => {
                  setColdOpenData(prev => prev
                    ? { ...prev, endInSeconds: prev.startInSeconds + sec }
                    : prev
                  )
                }}
                bRollSuggestions={bRollSuggestions}
                bRollItems={bRollItems}
                autoApplying={autoApplying}
                format={format}
                animatedEmojis={!!subtitleSettings.animatedEmojis}
                inlaysEnabled={inlaysEnabled}
                regenerating={regenerating}
                ready={ready}
                onEnergyChange={handleEnergyChange}
                onSubtitleStyleChange={handleEasySubtitleStyle}
                onMusicChange={handleEasyMusic}
                onColdOpenToggle={() => setColdOpenEnabled(prev => !prev)}
                onBRollSelect={handleBRollSelect}
                onBRollRemove={handleBRollRemove}
                onFormatChange={(f) => setFormat(f as FormatKey)}
                onMotionToggle={(key) => setMotionSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                onTransitionChange={(style) => setMotionSettings(prev => ({ ...prev, transitionStyle: style as any }))}
                onAnimatedEmojisToggle={async () => {
                  // The visual toggle considers both flags — align the logic with what the user sees
                  const isCurrentlyOn = !!subtitleSettings.animatedEmojis && inlaysEnabled
                  const enabling = !isCurrentlyOn
                  setSubtitleSettings(prev => ({ ...prev, animatedEmojis: enabling }))
                  setInlaysEnabled(enabling)
                  if (!enabling) return
                  // Re-use existing emoji data if present; only fetch when empty
                  if (Object.keys(wordEmojisBySegmentId).length > 0) return
                  const newMap: Record<string, { word: string; emoji: string }[]> = {}
                  for (const rec of recordings) {
                    if (!rec.transcript || rec.transcript.length < 10) continue
                    const wts = rec.wordTimestamps ?? []
                    try {
                      const res = await fetch('/api/cold-open', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          transcript: rec.transcript,
                          wordTimestamps: wts,
                          segmentId: rec.id,
                          videoDurationSeconds: wts.length > 0 ? (wts[wts.length - 1] as any).end + 1 : 60,
                        }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        if (data.wordEmojis?.length) newMap[rec.id] = data.wordEmojis
                      } else {
                        console.warn(`[emoji] cold-open failed for ${rec.id}:`, res.status, await res.text())
                      }
                    } catch (e) {
                      console.warn(`[emoji] cold-open error for ${rec.id}:`, e)
                    }
                  }
                  if (Object.keys(newMap).length) {
                    setWordEmojisBySegmentId(newMap)
                  }
                }}
                onInlaysToggle={() => setInlaysEnabled(prev => !prev)}
                onApplyChanges={applyVoice}
                onRunAiSuggestions={fetchBRollSuggestions}
                badTakesEnabled={badTakesEnabled}
                badTakesRemovedCount={badTakesRemovedCount}
                onBadTakesToggle={() => {
                  const nextEnabled = !badTakesEnabled
                  setBadTakesEnabled(nextEnabled)

                  if (nextEnabled) {
                    // Snapshot original timestamps for undo
                    const snapshot: Record<string, WordTimestamp[]> = {}
                    const cleaned: Record<string, WordTimestamp[]> = {}
                    let totalRemoved = 0

                    // French fillers & hesitations
                    const FILLER_PATTERN = /^(euh|heu|hmm|bah|ben|hein|quoi|genre|voila|voilà|du coup|en fait|tu vois|tu sais)[.,!?;:]?$/i

                    for (const rec of recordings) {
                      let words = wordTimestampsMap[rec.id] ?? []
                      if (!words.length && rec.wordTimestamps) {
                        words = rec.wordTimestamps as WordTimestamp[]
                      }
                      if (!words.length) continue

                      snapshot[rec.id] = words.map(w => ({ ...w }))

                      const filtered: WordTimestamp[] = []
                      let lastKept: WordTimestamp | null = null

                      for (let i = 0; i < words.length; i++) {
                        const w = words[i]
                        const normalized = w.word.trim().toLowerCase().replace(/[.,!?;:]/g, '')

                        // Skip if filler word
                        if (FILLER_PATTERN.test(w.word.trim().toLowerCase())) {
                          totalRemoved++
                          continue
                        }

                        // Skip if same word as the previous kept one AND close in time (< 0.6s gap) → repetition
                        if (lastKept
                          && lastKept.word.trim().toLowerCase().replace(/[.,!?;:]/g, '') === normalized
                          && w.start - lastKept.end < 0.6
                          && normalized.length > 1
                        ) {
                          totalRemoved++
                          continue
                        }

                        // Skip if consecutive 2-3 word phrase repetition (false start)
                        // Check if the next 2 words repeat what came before
                        if (i + 2 < words.length && filtered.length >= 2) {
                          const a = filtered[filtered.length - 1].word.trim().toLowerCase().replace(/[.,!?;:]/g, '')
                          const b = filtered[filtered.length - 2].word.trim().toLowerCase().replace(/[.,!?;:]/g, '')
                          const x = words[i].word.trim().toLowerCase().replace(/[.,!?;:]/g, '')
                          const y = words[i + 1].word.trim().toLowerCase().replace(/[.,!?;:]/g, '')
                          if (a === y && b === x && x.length > 1 && y.length > 1) {
                            // False start like "je vais faire je vais faire"
                            totalRemoved += 2
                            i += 1 // skip next one too
                            continue
                          }
                        }

                        filtered.push(w)
                        lastKept = w
                      }

                      cleaned[rec.id] = filtered
                    }

                    badTakesSnapshotRef.current = snapshot
                    setWordTimestampsMap(prev => ({ ...prev, ...cleaned }))
                    setBadTakesRemovedCount(totalRemoved)
                  } else {
                    // Restore from snapshot, or fall back to source timestamps after reload
                    if (badTakesSnapshotRef.current) {
                      const snap = badTakesSnapshotRef.current
                      setWordTimestampsMap(prev => ({ ...prev, ...snap }))
                      badTakesSnapshotRef.current = null
                    } else if (Object.keys(sourceWordTimestampsRef.current).length) {
                      const src: Record<string, WordTimestamp[]> = {}
                      for (const rec of recordings) {
                        const s = sourceWordTimestampsRef.current[rec.id]
                        if (s?.length) src[rec.id] = s.map(w => ({ ...w }))
                      }
                      if (Object.keys(src).length) {
                        setWordTimestampsMap(prev => ({ ...prev, ...src }))
                      }
                    }
                    setBadTakesRemovedCount(0)
                  }
                }}
                onBRollReplace={(itemId, replacement) => {
                  if ((replacement as any).videoUrl === '__REMOVE__') {
                    setBRollItems(prev => prev.filter(b => b.id !== itemId))
                    return
                  }
                  setBRollItems(prev => prev.map(b => b.id === itemId ? { ...b, ...replacement } : b))
                  setBRollEnabled(true)
                }}
                onBRollAddAtTime={(timestampSec, durationSec, data) => {
                  const newItem: import('@/remotion/themeTypes').BRollItem = {
                    id: `manual-${Date.now()}`,
                    timestampSeconds: timestampSec,
                    durationSeconds: durationSec,
                    videoUrl: data.videoUrl ?? '',
                    thumbnailUrl: data.thumbnailUrl ?? '',
                    pexelsId: data.pexelsId,
                    searchQuery: data.searchQuery ?? '',
                  }
                  setBRollItems(prev => [...prev, newItem])
                  setBRollEnabled(true)
                }}
                onBRollReAsk={async (itemId) => {
                  const item = bRollItems.find(b => b.id === itemId)
                  if (!item) return
                  // Re-search with a different query hint (use the searchQuery plus "alternative")
                  try {
                    const q = item.searchQuery ? `${item.searchQuery} alternative` : 'professional footage'
                    const res = await fetch(`/api/admin/broll/search?q=${encodeURIComponent(q)}&perPage=8`, { credentials: 'include' })
                    if (!res.ok) return
                    const results = await res.json()
                    // Pick a random result different from the current one
                    const alt = results.find((r: any) => r.url !== item.videoUrl) ?? results[0]
                    if (alt) {
                      setBRollItems(prev => prev.map(b => b.id === itemId ? {
                        ...b,
                        videoUrl: alt.url,
                        thumbnailUrl: alt.thumbnailUrl,
                        pexelsId: alt.pexelsId,
                        searchQuery: q,
                      } : b))
                    }
                  } catch { /* */ }
                }}
                onBRollsAutoToggle={async () => {
                  if (bRollItems.length > 0) {
                    // Clear all B-rolls
                    setBRollEnabled(false)
                    setBRollItems([])
                    return
                  }
                  // Fetch suggestions and auto-apply first result of each
                  let withResults = bRollSuggestions
                  if (withResults.length === 0) {
                    withResults = await fetchBRollSuggestions()
                  }
                  const autoItems: import('@/remotion/themeTypes').BRollItem[] = withResults
                    .filter((s: any) => s.results?.length > 0)
                    .map((s: any) => ({
                      id: `auto-${s.timestamp}`,
                      timestampSeconds: s.timestamp,
                      durationSeconds: s.duration || 3,
                      videoUrl: s.results[0].url,
                      thumbnailUrl: s.results[0].thumbnailUrl,
                      pexelsId: s.results[0].pexelsId,
                      searchQuery: s.searchQuery,
                    }))
                  if (autoItems.length > 0) {
                    setBRollEnabled(true)
                    setBRollItems(autoItems)
                  }
                }}
                onSilenceCutToggle={() => {
                  const nextEnabled = !silenceCutEnabled
                  setSilenceCutEnabled(nextEnabled)
                  setFillerCutEnabled(nextEnabled)

                  // Display-only: count detected silences. Actual cutting happens on "Appliquer".
                  if (nextEnabled) {
                    const SILENCE_THRESHOLD = 0.5
                    let totalSilence = 0
                    for (const rec of recordings) {
                      let words = wordTimestampsMap[rec.id] ?? []
                      if (!words.length && rec.wordTimestamps) {
                        words = rec.wordTimestamps as WordTimestamp[]
                      }
                      for (let i = 1; i < words.length; i++) {
                        const gap = words[i].start - words[i - 1].end
                        if (gap >= SILENCE_THRESHOLD) totalSilence += gap
                      }
                    }
                    setSilenceRemovedSec(totalSilence)
                    setSilenceCutDone(false) // not actually done until user clicks Apply
                  } else {
                    setSilenceCutDone(false)
                    setSilenceRemovedSec(0)
                  }
                }}
                cleanAudioEnabled={denoiseEnabled && denoiseStrength === 'isolate'}
                onCleanAudioToggle={() => {
                  if (denoiseEnabled && denoiseStrength === 'isolate') {
                    setDenoiseEnabled(false)
                  } else {
                    setDenoiseEnabled(true)
                    setDenoiseStrength('isolate')
                  }
                }}
                wordsByRecording={wordTimestampsMap}
                recordingsList={recordings.map(r => ({ id: r.id, questionText: r.questionText }))}
                onSubtitleSettingsPartial={(partial) => setSubtitleSettings(prev => ({ ...prev, ...partial }))}
                onWordEdit={(recordingId, wordIndex, newWord) => {
                  setWordTimestampsMap(prev => {
                    const words = [...(prev[recordingId] ?? [])]
                    if (words[wordIndex]) words[wordIndex] = { ...words[wordIndex], word: newWord }
                    return { ...prev, [recordingId]: words }
                  })
                  setLocalTranscripts(prev => {
                    const words = wordTimestampsMap[recordingId] ?? []
                    const updated = words.map((w, i) => i === wordIndex ? newWord : w.word).join(' ')
                    return { ...prev, [recordingId]: updated }
                  })
                }}
                getActiveRecordingTime={() => {
                  const tl = segmentTimelineRef.current
                  const f = playerFrameRef.current
                  for (const seg of tl) {
                    if (f >= seg.startFrame && f < seg.endFrame) {
                      return { recordingId: seg.id, timeSec: (f - seg.startFrame) / FPS }
                    }
                  }
                  return null
                }}
                onSeek={(recordingId, timeSec) => {
                  const segInfo = segmentTimelineRef.current.find(s => s.id === recordingId)
                  if (!segInfo) return
                  const frame = segInfo.startFrame + Math.round(timeSec * FPS)
                  ;(playerRef.current as any)?.seekTo?.(frame)
                }}
                onDeleteWord={(recordingId, wordIndex) => {
                  setWordTimestampsMap(prev => {
                    const words = [...(prev[recordingId] ?? [])]
                    words.splice(wordIndex, 1)
                    return { ...prev, [recordingId]: words }
                  })
                }}
                onAddWord={(recordingId, afterWordIndex) => {
                  setWordTimestampsMap(prev => {
                    const words = [...(prev[recordingId] ?? [])]
                    const prevWord = words[afterWordIndex]
                    const nextWord = words[afterWordIndex + 1]
                    const start = prevWord?.end ?? 0
                    const end = nextWord?.start ?? start + 0.3
                    const newWord = { word: 'nouveau', start, end: Math.min(end, start + 0.3) }
                    words.splice(afterWordIndex + 1, 0, newWord)
                    return { ...prev, [recordingId]: words }
                  })
                }}
                onDeleteChunk={(recordingId, startIdx, endIdx) => {
                  setWordTimestampsMap(prev => {
                    const words = [...(prev[recordingId] ?? [])]
                    words.splice(startIdx, endIdx - startIdx + 1)
                    return { ...prev, [recordingId]: words }
                  })
                }}
                wordEmojisBySegmentId={wordEmojisBySegmentId}
                onEmojiSet={(recordingId, word, emoji) => {
                  setWordEmojisBySegmentId(prev => {
                    const list = [...(prev[recordingId] ?? [])]
                    const existing = list.findIndex(e => e.word.toLowerCase() === word.toLowerCase())
                    if (existing >= 0) {
                      list[existing] = { word, emoji }
                    } else {
                      list.push({ word, emoji })
                    }
                    return { ...prev, [recordingId]: list }
                  })
                  // Make sure animated emojis are enabled when user adds one
                  setInlaysEnabled(true)
                  setSubtitleSettings(prev => ({ ...prev, animatedEmojis: true }))
                }}
                onEmojiRemove={(recordingId, word) => {
                  setWordEmojisBySegmentId(prev => {
                    const list = (prev[recordingId] ?? []).filter(e => e.word.toLowerCase() !== word.toLowerCase())
                    return { ...prev, [recordingId]: list }
                  })
                }}
                trimSelected={trimSelected}
                setTrimSelected={setTrimSelected}
                trimDeleted={trimDeleted}
                setTrimDeleted={setTrimDeleted}
                onEditSubViewChange={setEasyEditSubView}
                intro={intro}
                setIntro={setIntro}
                outro={outro}
                setOutro={setOutro}
                theme={theme}
                setAudioSettings={setAudioSettings}
                soundLibrary={soundLibrary}
                soundPreviewAudioRef={soundPreviewAudioRef}
                onBRollsAutoApply={async (percent) => {
                  let withResults = bRollSuggestions
                  if (withResults.length === 0) {
                    withResults = await fetchBRollSuggestions()
                  }
                  const eligible = withResults.filter((s: any) => s.results?.length > 0)
                  const count = Math.max(1, Math.round(eligible.length * (percent / 100)))
                  const picked = eligible.slice(0, count)
                  const autoItems: import('@/remotion/themeTypes').BRollItem[] = picked.map((s: any) => ({
                    id: `auto-${s.timestamp}`,
                    timestampSeconds: s.timestamp,
                    durationSeconds: s.duration || 3,
                    videoUrl: s.results[0].url,
                    thumbnailUrl: s.results[0].thumbnailUrl,
                    pexelsId: s.results[0].pexelsId,
                    searchQuery: s.searchQuery,
                  }))
                  if (autoItems.length > 0) {
                    setBRollEnabled(true)
                    setBRollItems(autoItems)
                  }
                }}
                onBRollsClear={() => {
                  setBRollEnabled(false)
                  setBRollItems([])
                }}
                onApplyBrandKitToSlide={async (target) => {
                  try {
                    const res = await fetch('/api/admin/brand-kit', { credentials: 'include' })
                    if (!res.ok) {
                      const text = await res.text().catch(() => '')
                      return { ok: false, message: `${res.status} ${text.slice(0, 200) || 'Brand kit inaccessible'}` }
                    }
                    const bk = await res.json()
                    if (!bk) return { ok: false, message: 'Aucun brand kit configuré' }

                    const hasAnything =
                      bk.logoUrl || bk.primaryColor || bk.secondaryColor || bk.accentColor || bk.fontTitle
                    if (!hasAnything) return { ok: false, message: 'Brand kit vide' }

                    const bgColor = target === 'outro'
                      ? (bk.secondaryColor || bk.primaryColor)
                      : bk.primaryColor
                    const accentColor = bk.accentColor || bk.secondaryColor
                    const fontFamily = bk.fontTitle

                    const patch = (p: any) => ({
                      ...p,
                      ...(bk.logoUrl ? { logoUrl: bk.logoUrl } : {}),
                      ...(bgColor ? { bgColor } : {}),
                      ...(accentColor ? { accentColor } : {}),
                      ...(fontFamily ? { fontFamily } : {}),
                      preset: 'custom',
                    })

                    if (target === 'intro') setIntro(patch)
                    else setOutro(patch)

                    return { ok: true }
                  } catch (e: any) {
                    return { ok: false, message: e?.message ?? 'Erreur réseau' }
                  }
                }}
                onRequestIntroHookSuggestions={async () => {
                  const aggregated = recordings
                    .map(r => r.transcript)
                    .filter((t): t is string => !!t && t.length > 0)
                    .join('\n\n')
                  if (aggregated.length < 40) {
                    throw new Error('Transcription insuffisante pour générer des suggestions')
                  }
                  const res = await fetch('/api/intro-hooks', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      transcript: aggregated,
                      topic: themeName,
                      format,
                    }),
                  })
                  if (!res.ok) {
                    const msg = await res.text()
                    throw new Error(msg || `Erreur ${res.status}`)
                  }
                  const data = await res.json()
                  return (data.hooks ?? []).map((h: { phrase: string }) => h.phrase).filter(Boolean)
                }}
              />

            </div>

          {/* RIGHT: CANVAS + TIMELINE */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            background: '#FFFFFF',
            borderRadius: 12, border: '1px solid #EBEBEF',
          }}>

            {/* Submagic-style top pills (easy mode only) */}
            <div style={{ padding: '12px 16px 0 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                  {([
                    { label: 'Audio', onClick: () => { setShowAudioPopover(v => !v); setShowAiToolsPopover(false) } },
                    { label: 'AI Tools', onClick: () => { setShowAiToolsPopover(v => !v); setShowAudioPopover(false) } },
                  ] as const).map((p, i) => {
                    const isActive = (i === 0 && (showAudioPopover || !!audioSettings.bgMusic))
                      || (i === 1 && showAiToolsPopover)
                    return (
                      <button
                        key={p.label}
                        onClick={p.onClick}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '6px 12px', borderRadius: 8,
                          background: isActive ? '#FF4D1C' : '#FFF0EB',
                          color: isActive ? '#FFFFFF' : '#FF4D1C',
                          border: '1px solid rgba(255,77,28,0.2)', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {i === 0 && <span style={{ fontSize: 11 }}>🎵</span>}
                        {i === 1 && <span style={{ fontSize: 11 }}>✨</span>}
                        {p.label}
                      </button>
                    )
                  })}
                  {showAudioPopover && (
                    <>
                      {/* Click-outside overlay */}
                      <div
                        onClick={() => setShowAudioPopover(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 20 }}
                      />
                      <div
                        style={{
                          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30,
                          width: 320, maxHeight: 420, overflowY: 'auto',
                          background: '#FFFFFF', border: '1px solid #EBEBEF', borderRadius: 12,
                          boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: 12,
                        }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                          Musique d'ambiance
                        </p>
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 10px' }}>
                          Choisir un fond sonore (catégorie Background)
                        </p>
                        <BgMusicPicker
                          soundLibrary={soundLibrary}
                          selectedId={audioSettings.bgMusic?.prompt ?? null}
                          volume={audioSettings.bgMusic?.volume ?? 0.25}
                          onSelect={(id) => {
                            if (!id) {
                              setAudioSettings(prev => ({ ...prev, bgMusic: undefined }))
                              return
                            }
                            const s = soundLibrary.find(x => x.id === id)
                            if (!s) return
                            setAudioSettings(prev => ({
                              ...prev,
                              bgMusic: {
                                prompt: s.id,
                                url: `/api/admin/sounds/${s.id}/audio`,
                                volume: prev.bgMusic?.volume ?? 0.25,
                              },
                            }))
                          }}
                          onVolumeChange={(v) => {
                            setAudioSettings(prev => prev.bgMusic
                              ? { ...prev, bgMusic: { ...prev.bgMusic, volume: v } }
                              : prev
                            )
                          }}
                          previewRef={soundPreviewAudioRef}
                        />
                      </div>
                    </>
                  )}
                  {showAiToolsPopover && (() => {
                    const toggleItem = (
                      key: string,
                      label: string,
                      desc: string,
                      on: boolean,
                      onToggle: () => void | Promise<void>,
                    ) => {
                      const loading = aiToolLoading === key
                      return (
                        <button
                          key={key}
                          disabled={loading}
                          onClick={async () => {
                            if (loading) return
                            try {
                              setAiToolLoading(key)
                              await onToggle()
                            } finally {
                              setAiToolLoading(null)
                            }
                          }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 10, border: 'none',
                            background: 'transparent', cursor: loading ? 'wait' : 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>{label}</p>
                            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '1px 0 0' }}>{desc}</p>
                          </div>
                          {loading ? (
                            <Loader2 size={14} style={{ color: '#FF4D1C', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                          ) : (
                            <span style={{
                              display: 'inline-block', width: 32, height: 18, borderRadius: 9,
                              background: on ? '#FF4D1C' : '#E5E7EB', position: 'relative', flexShrink: 0,
                              transition: 'background 0.2s',
                            }}>
                              <span style={{
                                position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14,
                                borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                              }} />
                            </span>
                          )}
                        </button>
                      )
                    }

                    const sectionTitle = (t: string) => (
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', margin: '6px 0 2px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t}</p>
                    )

                    return (
                      <>
                        <div
                          onClick={() => setShowAiToolsPopover(false)}
                          style={{ position: 'fixed', inset: 0, zIndex: 20 }}
                        />
                        <div
                          style={{
                            position: 'absolute', top: 'calc(100% + 6px)', left: 90, zIndex: 30,
                            width: 320, maxHeight: 480, overflowY: 'auto',
                            background: '#FFFFFF', border: '1px solid #EBEBEF', borderRadius: 12,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: 12,
                          }}
                        >
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
                            AI rapides
                          </p>

                          {sectionTitle('AI Boost')}
                          {toggleItem('captions', 'AI Captions', 'Sous-titres stylés', subtitleSettings.enabled, () => {
                            setSubtitleSettings(prev => ({
                              ...prev,
                              enabled: !prev.enabled,
                              style: !prev.enabled ? (prev.style || 'hormozi') : prev.style,
                            }))
                          })}
                          {toggleItem('silences', 'Remove Silences', 'Couper les pauses', silenceCutEnabled, () => {
                            const next = !silenceCutEnabled
                            setSilenceCutEnabled(next)
                            setFillerCutEnabled(next)
                          })}
                          {toggleItem('zoom', 'AI Auto Zooms', 'Zoom automatique', !!motionSettings.dynamicZoom, () => {
                            setMotionSettings(prev => ({ ...prev, dynamicZoom: !prev.dynamicZoom }))
                          })}
                          {toggleItem('brolls', 'AI Auto B-rolls', 'Plans contextuels auto', bRollItems.length > 0, async () => {
                            if (bRollItems.length > 0) {
                              setBRollEnabled(false)
                              setBRollItems([])
                              return
                            }
                            let withResults = bRollSuggestions
                            if (!withResults.length) withResults = await fetchBRollSuggestions()
                            const items = withResults
                              .filter((s: any) => s.results?.length > 0)
                              .map((s: any) => ({
                                id: `auto-${s.timestamp}`,
                                timestampSeconds: s.timestamp,
                                durationSeconds: s.duration || 3,
                                videoUrl: s.results[0].url,
                                thumbnailUrl: s.results[0].thumbnailUrl,
                                pexelsId: s.results[0].pexelsId,
                                searchQuery: s.searchQuery,
                              }))
                            if (items.length) {
                              setBRollEnabled(true)
                              setBRollItems(items)
                            }
                          })}

                          {sectionTitle('AI Tools')}
                          {toggleItem('hook', 'AI Hook Title', 'Intro accrocheuse', coldOpenEnabled, () => {
                            setColdOpenEnabled(prev => !prev)
                          })}
                          {toggleItem('clean', 'Clean Audio', 'Isolation vocale ElevenLabs', denoiseEnabled && denoiseStrength === 'isolate', () => {
                            if (denoiseEnabled && denoiseStrength === 'isolate') {
                              setDenoiseEnabled(false)
                            } else {
                              setDenoiseEnabled(true)
                              setDenoiseStrength('isolate')
                            }
                          })}
                          {toggleItem('bad', 'Remove Bad Takes', 'Fillers & doublons', badTakesEnabled, () => {
                            setBadTakesEnabled(prev => !prev)
                          })}
                          {toggleItem('emoji', 'Animated Emojis', 'Emojis animés sur les mots clés', !!subtitleSettings.animatedEmojis && inlaysEnabled, async () => {
                            const isOn = !!subtitleSettings.animatedEmojis && inlaysEnabled
                            const enabling = !isOn
                            setSubtitleSettings(prev => ({ ...prev, animatedEmojis: enabling }))
                            setInlaysEnabled(enabling)
                            if (!enabling) return
                            if (Object.keys(wordEmojisBySegmentId).length > 0) return
                            const newMap: Record<string, { word: string; emoji: string }[]> = {}
                            for (const rec of recordings) {
                              if (!rec.transcript || rec.transcript.length < 10) continue
                              const wts = rec.wordTimestamps ?? []
                              try {
                                const res = await fetch('/api/cold-open', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    transcript: rec.transcript,
                                    wordTimestamps: wts,
                                    segmentId: rec.id,
                                    videoDurationSeconds: wts.length > 0 ? (wts[wts.length - 1] as any).end + 1 : 60,
                                  }),
                                })
                                if (res.ok) {
                                  const data = await res.json()
                                  if (data.wordEmojis?.length) newMap[rec.id] = data.wordEmojis
                                }
                              } catch { /* */ }
                            }
                            if (Object.keys(newMap).length) setWordEmojisBySegmentId(newMap)
                          })}
                          {toggleItem('kenburns', 'Ken Burns', 'Mouvement cinématique lent', !!motionSettings.kenBurns, () => {
                            setMotionSettings(prev => ({ ...prev, kenBurns: !prev.kenBurns }))
                          })}
                          {toggleItem('wordpop', 'Word Pop', 'Zoom subtil sur chaque mot', !!motionSettings.wordPop, () => {
                            setMotionSettings(prev => ({ ...prev, wordPop: !prev.wordPop }))
                          })}
                        </div>
                      </>
                    )
                  })()}
                  <button
                    style={{
                      width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: 'transparent', color: '#6B7280',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700,
                    }}
                  >
                    ⋯
                  </button>
                </div>
              </div>

            {/* Canvas area */}
            <div style={{
              flex: 1, minHeight: 0, position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              padding: '16px 24px',
            }}>

              {/* Format selector -- floating top-left (hidden in easy mode — it's in the panel) */}
              <div style={{ position: 'absolute', top: 12, left: 14, zIndex: 10, display: 'none', gap: 3 }}>
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



              {/* Video player */}
              {ready && segments ? (
                <div style={{
                  position: 'relative',
                  height: '100%', width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    position: 'relative',
                    height: '100%',
                    aspectRatio: `${fmt.width} / ${fmt.height}`,
                    maxWidth: '100%',
                  }}>
                    <Player
                      ref={playerRef as any}
                      component={LavidzComposition as any}
                      inputProps={{ segments: effectiveSegments, questionCardFrames: effectiveQuestionCardFrames, subtitleSettings, theme, intro, outro, fps: FPS, motionSettings: effectiveMotionSettings, audioSettings }}
                      durationInFrames={totalFrames}
                      fps={FPS}
                      compositionWidth={fmt.width}
                      compositionHeight={fmt.height}
                      style={{
                        width: '100%', height: '100%',
                        display: 'block',
                        borderRadius: 6,
                        boxShadow: 'none',
                        overflow: 'hidden',
                      }}
                      playbackRate={playbackRate}
                      showPlaybackRateControl={false}
                      controls={false}
                      clickToPlay
                    />
                    {/* "Low res preview" badge on top of player — easy mode only */}
                    <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 5,
                        padding: '3px 8px', borderRadius: 5,
                        background: 'rgba(0,0,0,0.55)', color: '#fff',
                        fontSize: 10, fontWeight: 500,
                        pointerEvents: 'none',
                      }}>
                        Low res preview
                      </div>
                  </div>
                </div>
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

            {/* Toolbar below player (easy mode only) — Submagic-style */}
            {ready && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '8px 16px', flexShrink: 0,
              }}>
                {/* Aspect ratio dropdown */}
                <div style={{ position: 'relative' }}>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as FormatKey)}
                    style={{
                      appearance: 'none',
                      padding: '4px 22px 4px 10px', borderRadius: 7,
                      fontSize: 12, fontWeight: 600,
                      background: '#FFFFFF', color: '#1A1A1A',
                      border: '1px solid #E5E7EB', cursor: 'pointer',
                    }}
                  >
                    {(Object.entries(FORMATS) as [FormatKey, typeof FORMATS[FormatKey]][]).map(([k, f]) => (
                      <option key={k} value={k}>{f.label}</option>
                    ))}
                  </select>
                  <ChevronRight
                    size={10}
                    style={{
                      position: 'absolute', right: 6, top: '50%',
                      transform: 'translateY(-50%) rotate(90deg)',
                      color: '#9CA3AF', pointerEvents: 'none',
                    }}
                  />
                </div>

                {/* Icon buttons */}
                {[
                  { icon: '✂', title: 'Recadrer' },
                  { icon: '↻', title: 'Reinitialiser' },
                  { icon: '👁', title: 'Apercu' },
                ].map((btn) => (
                  <button
                    key={btn.title}
                    title={btn.title}
                    style={{
                      width: 30, height: 30, borderRadius: 7, border: '1px solid #E5E7EB',
                      background: '#FFFFFF', color: '#6B7280', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Submagic-style player controls (easy mode only) */}
            {ready && <PlayerControls playerRef={playerRef} totalFrames={totalFrames} fps={FPS} />}



            {/* Bottom bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px',
              borderTop: '1px solid #EBEBEF',
              background: '#FFFFFF',
              flexShrink: 0,
            }}>
              <>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {ready ? `${(totalFrames / FPS).toFixed(1)}s` : ''}
                  </span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {fmt.label}
                  </span>
                </>
            </div>

          </div>{/* end right */}
        </div>/* end desktop */
      )}

      {/* Full-width trim timeline below both panels */}
      {easyEditSubView === 'trim' && !isMobile && (
        <div style={{
          padding: '0 24px 16px', background: '#F8F8FA', flexShrink: 0,
        }}>
          <TrimTimeline
            recordings={recordings.map(r => ({ id: r.id, questionText: r.questionText }))}
            wordsByRecording={wordTimestampsMap}
            deleted={trimDeleted}
            selected={trimSelected}
            onSeek={(recordingId, timeSec) => {
              const segInfo = segmentTimelineRef.current.find(s => s.id === recordingId)
              if (!segInfo) return
              const frame = segInfo.startFrame + Math.round(timeSec * FPS)
              ;(playerRef.current as any)?.seekTo?.(frame)
            }}
            getActiveRecordingTime={() => {
              const tl = segmentTimelineRef.current
              const f = playerFrameRef.current
              for (const seg of tl) {
                if (f >= seg.startFrame && f < seg.endFrame) {
                  return { recordingId: seg.id, timeSec: (f - seg.startFrame) / FPS }
                }
              }
              return null
            }}
            onDeleteRange={(ranges) => {
              setWordTimestampsMap(prev => {
                const next = { ...prev }
                for (const r of ranges) {
                  const words = next[r.recordingId] ?? []
                  next[r.recordingId] = words.filter(w => {
                    const mid = (w.start + w.end) / 2
                    return mid < r.startSec || mid > r.endSec
                  })
                }
                return next
              })
            }}
          />
        </div>
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

/* ------------------------------------------------------------------ */
/* Submagic-style player controls                                      */
/* ------------------------------------------------------------------ */

function PlayerControls({
  playerRef, totalFrames, fps,
}: {
  playerRef: React.MutableRefObject<PlayerRef | null>
  totalFrames: number
  fps: number
}) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    let raf: number
    const tick = () => {
      const p = playerRef.current as any
      if (p) {
        setCurrentFrame(p.getCurrentFrame?.() ?? 0)
        setPlaying(!!p.isPlaying?.())
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playerRef])

  const fmtTime = (sec: number) => {
    const s = Math.max(0, sec)
    const mm = Math.floor(s / 60)
    const ss = Math.floor(s % 60)
    const cs = Math.floor((s - Math.floor(s)) * 100)
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
  }

  const progressPct = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0

  const togglePlay = () => {
    const p = playerRef.current as any
    if (!p) return
    if (p.isPlaying?.()) p.pause?.()
    else p.play?.()
  }

  const skipFrames = (n: number) => {
    const p = playerRef.current as any
    if (!p) return
    p.seekTo?.(Math.max(0, Math.min(totalFrames - 1, (p.getCurrentFrame?.() ?? 0) + n)))
  }

  const toggleMute = () => {
    const p = playerRef.current as any
    if (!p) return
    if (muted) { p.unmute?.(); setMuted(false) }
    else { p.mute?.(); setMuted(true) }
  }

  const toggleFullscreen = () => {
    const p = playerRef.current as any
    p?.requestFullscreen?.()
  }

  const onProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const p = playerRef.current as any
    p?.seekTo?.(Math.floor(pct * totalFrames))
  }

  return (
    <div style={{
      padding: '12px 20px 16px', flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Progress bar */}
      <div
        onClick={onProgressClick}
        style={{
          position: 'relative', height: 4, borderRadius: 2,
          background: '#E5E7EB', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${progressPct}%`, background: '#FF4D1C', borderRadius: 2,
          transition: 'width 0.05s linear',
        }} />
      </div>

      {/* Bottom bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Play + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <button
            onClick={togglePlay}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#1A1A1A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'monospace' }}>
            <span style={{ color: '#1A1A1A', fontWeight: 600 }}>{fmtTime(currentFrame / fps)}</span>
            <span style={{ color: '#9CA3AF' }}>/</span>
            <span style={{ color: '#9CA3AF' }}>{fmtTime(totalFrames / fps)}</span>
          </div>
        </div>

        {/* Right icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => skipFrames(-1)}
            title="Frame precedente"
            style={{
              width: 32, height: 32, borderRadius: 7, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#6B7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M4.85702 5.41673L7.6011 2.67265L6.42259 1.49414L2.5 5.41673L6.42259 9.33932L7.6011 8.16081L4.85702 5.41673Z" /><path d="M9.85698 4.58344L11.7678 2.67265L10.5893 1.49414L6.66667 5.41673L10.5893 9.33932L11.7678 8.16081L9.85706 6.2501H10.7619C13.6069 6.2501 15.7619 8.15134 15.7619 10.8334C15.7619 13.5949 13.5233 15.8334 10.7619 15.8334H9.51191V17.5001H10.7619C14.4438 17.5001 17.4286 14.5153 17.4286 10.8334C17.4286 7.07221 14.3603 4.58344 10.7619 4.58344H9.85698Z" /></svg>
          </button>
          <button
            onClick={() => skipFrames(1)}
            title="Frame suivante"
            style={{
              width: 32, height: 32, borderRadius: 7, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#6B7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M8.16081 2.67265L10.0716 4.58344H9.16667C5.56832 4.58344 2.5 7.07221 2.5 10.8334C2.5 14.5153 5.48477 17.5001 9.16667 17.5001H10.4167V15.8334H9.16667C6.40524 15.8334 4.16667 13.5949 4.16667 10.8334C4.16667 8.15134 6.32169 6.2501 9.16667 6.2501H10.0715L8.16081 8.16081L9.33932 9.33932L13.2619 5.41673L9.33932 1.49414L8.16081 2.67265Z" /></svg>
          </button>
          <button
            onClick={toggleMute}
            title={muted ? 'Activer le son' : 'Couper le son'}
            style={{
              width: 32, height: 32, borderRadius: 7, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#6B7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5.88889 16H2C1.44772 16 1 15.5523 1 15V9C1 8.44772 1.44772 8 2 8H5.88889L11.1834 3.66821C11.3971 3.49335 11.7121 3.52485 11.887 3.73857C11.9601 3.8279 12 3.93977 12 4.05519V19.9449C12 20.2211 11.7761 20.4449 11.5 20.4449C11.3846 20.4449 11.2727 20.405 11.1834 20.3319L5.88889 16ZM19.7678 15.1213L22.2426 17.5962L20.8284 19.0104L18.3536 16.5355L15.8787 19.0104L14.4645 17.5962L16.9393 15.1213L14.4645 12.6464L15.8787 11.2322L18.3536 13.7071L20.8284 11.2322L22.2426 12.6464L19.7678 15.1213Z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 16.0001H5.88889L11.1834 20.3319C11.2727 20.405 11.3846 20.4449 11.5 20.4449C11.7761 20.4449 12 20.2211 12 19.9449V4.05519C12 3.93977 11.9601 3.8279 11.887 3.73857C11.7121 3.52485 11.3971 3.49335 11.1834 3.66821L5.88889 8.00007H2C1.44772 8.00007 1 8.44778 1 9.00007V15.0001C1 15.5524 1.44772 16.0001 2 16.0001ZM23 12C23 15.292 21.5539 18.2463 19.2622 20.2622L17.8445 18.8444C19.7758 17.1937 21 14.7398 21 12C21 9.26016 19.7758 6.80629 17.8445 5.15557L19.2622 3.73779C21.5539 5.75368 23 8.70795 23 12ZM18 12C18 10.0883 17.106 8.38548 15.7133 7.28673L14.2842 8.71584C15.3213 9.43855 16 10.64 16 12C16 13.36 15.3213 14.5614 14.2842 15.2841L15.7133 16.7132C17.106 15.6145 18 13.9116 18 12Z" /></svg>
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            title="Plein ecran"
            style={{
              width: 32, height: 32, borderRadius: 7, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#6B7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3H22V9H20V5H16V3ZM2 3H8V5H4V9H2V3ZM20 19V15H22V21H16V19H20ZM4 19H8V21H2V15H4V19Z" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
