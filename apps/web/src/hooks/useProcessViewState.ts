import { useState } from 'react'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import type { SubtitleSettings } from '@/remotion/subtitleTypes'
import { DEFAULT_SUBTITLE_SETTINGS } from '@/remotion/subtitleTypes'
import type { TransitionTheme, IntroSettings, OutroSettings, MotionSettings, AudioSettings, BRollItem } from '@/remotion/themeTypes'
import { DEFAULT_TRANSITION_THEME, DEFAULT_INTRO_SETTINGS, DEFAULT_OUTRO_SETTINGS, DEFAULT_MOTION_SETTINGS } from '@/remotion/themeTypes'
import type { TimelineComment } from '@/components/session/TimelineComments'
import {
  QUESTION_CARD_FRAMES,
  DEFAULT_CLEANVOICE_CONFIG,
  type CleanvoiceConfig,
  type FormatKey,
  type Voice,
  type RawRecording,
} from '@/components/session/process-view-utils'

export type ModuleId = 'audio' | 'hook' | 'style' | 'subtitles' | 'music' | 'bookends' | 'ai' | 'comments' | 'export'

export function useProcessViewState(recordings: RawRecording[]) {
  // ── Navigation ───────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0)
  const [currentPhase, setCurrentPhase] = useState(0)
  const [activeModule, setActiveModule] = useState<ModuleId>('audio')
  const [legacyPhase2Section, setLegacyPhase2Section] = useState<'style' | 'bookends' | 'audio' | 'transcripts' | 'ai' | 'comments'>('style')
  const [bookendTarget, setBookendTarget] = useState<'intro' | 'outro'>('intro')

  // ── Player / composition ─────────────────────────────────────────────────
  const [segments, setSegments] = useState<CompositionSegment[] | null>(null)
  const [ready, setReady] = useState(false)
  const [activeSegmentInfo, setActiveSegmentInfo] = useState<{ id: string; localTimeSec: number } | null>(null)
  const [timelineVisible, setTimelineVisible] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [questionCardFrames, setQuestionCardFrames] = useState(QUESTION_CARD_FRAMES)

  // ── Format / theme ───────────────────────────────────────────────────────
  const [format, setFormat] = useState<FormatKey>('9/16')
  const [theme, setTheme] = useState<TransitionTheme>(DEFAULT_TRANSITION_THEME)
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS)
  const [motionSettings, setMotionSettings] = useState<MotionSettings>(DEFAULT_MOTION_SETTINGS)

  // ── Bookends ─────────────────────────────────────────────────────────────
  const [intro, setIntro] = useState<IntroSettings>(DEFAULT_INTRO_SETTINGS)
  const [outro, setOutro] = useState<OutroSettings>(DEFAULT_OUTRO_SETTINGS)

  // ── Audio / music ────────────────────────────────────────────────────────
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({})
  const [bgMusicPrompt, setBgMusicPrompt] = useState('upbeat background music for a fast-paced interview video')
  const [transitionSfxPrompt, setTransitionSfxPrompt] = useState('short cinematic whoosh transition sound effect')
  const [generatingSfx, setGeneratingSfx] = useState<{ bgMusic: boolean; transitionSfx: boolean }>({ bgMusic: false, transitionSfx: false })
  const [sfxLibrary, setSfxLibrary] = useState<{ filename: string; name: string }[]>([])
  const [soundLibrary, setSoundLibrary] = useState<{ id: string; name: string; tag: string; signedUrl: string }[]>([])
  const [swooshEnabled, setSwooshEnabled] = useState(false)
  const [popSoundEnabled, setPopSoundEnabled] = useState(false)

  // ── Voice / TTS ──────────────────────────────────────────────────────────
  const [voices, setVoices] = useState<Voice[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('KSyQzmsYhFbuOhqj1Xxv')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)

  // ── Audio processing ─────────────────────────────────────────────────────
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [regenerating, setRegenerating] = useState(false)
  const [prepareError, setPrepareError] = useState('')
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

  // ── Cold Open & Visual Inlays ─────────────────────────────────────────────
  const [coldOpenEnabled, setColdOpenEnabled] = useState(false)
  const [coldOpenData, setColdOpenData] = useState<{ hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string } | null>(null)
  const [coldOpenCandidates, setColdOpenCandidates] = useState<Array<{ hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string; angle?: string; why?: string }>>([])
  const [inlaysEnabled, setInlaysEnabled] = useState(false)
  const [inlaysData, setInlaysData] = useState<{ exactWord: string; category: string; timeInSeconds: number; label?: string }[]>([])
  const [coldOpenLoading, setColdOpenLoading] = useState(false)
  const [coldOpenError, setColdOpenError] = useState('')
  const [wordEmojisBySegmentId, setWordEmojisBySegmentId] = useState<Record<string, { word: string; emoji: string }[]>>({})
  // Cold Open style
  const [coldOpenTextColor, setColdOpenTextColor] = useState('#FFFFFF')
  const [coldOpenHighlightColor, setColdOpenHighlightColor] = useState('#FFD60A')
  const [coldOpenFontFamily, setColdOpenFontFamily] = useState("Impact, 'Arial Narrow', sans-serif")
  const [coldOpenFontSize, setColdOpenFontSize] = useState(72)
  const [coldOpenTextPosition, setColdOpenTextPosition] = useState<'bottom' | 'center' | 'top'>('bottom')
  const [coldOpenVideoStyle, setColdOpenVideoStyle] = useState<'bw' | 'desaturated' | 'color' | 'raw'>('desaturated')
  // Cold Open viral options
  const [coldOpenFreezeFrame, setColdOpenFreezeFrame] = useState(false)
  const [coldOpenTextAnimEnabled, setColdOpenTextAnimEnabled] = useState(false)
  const [coldOpenTextAnimation, setColdOpenTextAnimation] = useState<'pop' | 'slam' | 'typewriter'>('pop')
  const [coldOpenHighlightModeEnabled, setColdOpenHighlightModeEnabled] = useState(false)
  const [coldOpenHighlightMode, setColdOpenHighlightMode] = useState<'word' | 'all' | 'box'>('word')
  const [coldOpenSfxEnabled, setColdOpenSfxEnabled] = useState(false)
  const [coldOpenSfx, setColdOpenSfx] = useState<{ prompt: string; url: string; volume: number } | null>(null)
  const [coldOpenEntrySfxEnabled, setColdOpenEntrySfxEnabled] = useState(false)
  const [coldOpenEntrySfx, setColdOpenEntrySfx] = useState<{ prompt: string; url: string; volume: number } | null>(null)
  // Inlays style
  const [inlaysStyle, setInlaysStyle] = useState<'pill' | 'minimal' | 'bold'>('pill')
  const [inlaysDuration, setInlaysDuration] = useState(2)
  const [inlaysPopVolume, setInlaysPopVolume] = useState(0.5)

  // ── B-Rolls ──────────────────────────────────────────────────────────────
  const [bRollEnabled, setBRollEnabled] = useState(false)
  const [bRollItems, setBRollItems] = useState<BRollItem[]>([])

  // ── Transcripts ──────────────────────────────────────────────────────────
  const [localTranscripts, setLocalTranscripts] = useState<Record<string, string>>(() =>
    Object.fromEntries(recordings.map(r => [r.id, r.transcript ?? '']))
  )
  const [wordTimestampsMap, setWordTimestampsMap] = useState<Record<string, import('@/remotion/themeTypes').WordTimestamp[]>>({})
  const [transcribing, setTranscribing] = useState<Record<string, boolean>>({})

  // ── Asset caches ─────────────────────────────────────────────────────────
  const [ttsCache, setTtsCache] = useState<Record<string, { voiceId: string; url: string }>>({})
  const [processedCache, setProcessedCache] = useState<Record<string, { hash: string; url: string }>>({})

  // ── Export / delivery ────────────────────────────────────────────────────
  const [renderOutputUrl, setRenderOutputUrl] = useState<string | null>(null)
  const [delivering, setDelivering] = useState(false)
  const [delivered, setDelivered] = useState(false)
  const [deliverError, setDeliverError] = useState('')

  // ── Hover states ─────────────────────────────────────────────────────────
  const [hoveredVoiceId, setHoveredVoiceId] = useState<string | null>(null)
  const [hoveredTransStyle, setHoveredTransStyle] = useState<string | null>(null)
  const [hoveredQCardStyle, setHoveredQCardStyle] = useState<string | null>(null)
  const [hoveredQCardTrans, setHoveredQCardTrans] = useState<string | null>(null)
  const [hoveredIntroPreset, setHoveredIntroPreset] = useState<string | null>(null)
  const [hoveredOutroPreset, setHoveredOutroPreset] = useState<string | null>(null)
  const [hoveredFont, setHoveredFont] = useState<string | null>(null)
  const [hoveredDenoiseStrength, setHoveredDenoiseStrength] = useState<string | null>(null)
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)

  // ── Auto-save ────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // ── Timeline comments ─────────────────────────────────────────────────────
  const [timelineComments, setTimelineComments] = useState<TimelineComment[]>([])

  // ── Responsive ──────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<'controls' | 'preview'>('controls')

  return {
    // Navigation
    currentStep, setCurrentStep,
    currentPhase, setCurrentPhase,
    activeModule, setActiveModule,
    legacyPhase2Section, setLegacyPhase2Section,
    bookendTarget, setBookendTarget,
    // Player / composition
    segments, setSegments,
    ready, setReady,
    activeSegmentInfo, setActiveSegmentInfo,
    timelineVisible, setTimelineVisible,
    playbackRate, setPlaybackRate,
    questionCardFrames, setQuestionCardFrames,
    // Format / theme
    format, setFormat,
    theme, setTheme,
    activePresetId, setActivePresetId,
    subtitleSettings, setSubtitleSettings,
    motionSettings, setMotionSettings,
    // Bookends
    intro, setIntro,
    outro, setOutro,
    // Audio / music
    audioSettings, setAudioSettings,
    bgMusicPrompt, setBgMusicPrompt,
    transitionSfxPrompt, setTransitionSfxPrompt,
    generatingSfx, setGeneratingSfx,
    sfxLibrary, setSfxLibrary,
    soundLibrary, setSoundLibrary,
    swooshEnabled, setSwooshEnabled,
    popSoundEnabled, setPopSoundEnabled,
    // Voice / TTS
    voices, setVoices,
    selectedVoiceId, setSelectedVoiceId,
    voiceEnabled, setVoiceEnabled,
    previewingVoiceId, setPreviewingVoiceId,
    // Audio processing
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
    // Cold Open
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
    // B-Rolls
    bRollEnabled, setBRollEnabled,
    bRollItems, setBRollItems,
    // Transcripts
    localTranscripts, setLocalTranscripts,
    wordTimestampsMap, setWordTimestampsMap,
    transcribing, setTranscribing,
    // Asset caches
    ttsCache, setTtsCache,
    processedCache, setProcessedCache,
    // Export / delivery
    renderOutputUrl, setRenderOutputUrl,
    delivering, setDelivering,
    delivered, setDelivered,
    deliverError, setDeliverError,
    // Hover states
    hoveredVoiceId, setHoveredVoiceId,
    hoveredTransStyle, setHoveredTransStyle,
    hoveredQCardStyle, setHoveredQCardStyle,
    hoveredQCardTrans, setHoveredQCardTrans,
    hoveredIntroPreset, setHoveredIntroPreset,
    hoveredOutroPreset, setHoveredOutroPreset,
    hoveredFont, setHoveredFont,
    hoveredDenoiseStrength, setHoveredDenoiseStrength,
    hoveredStep, setHoveredStep,
    // Auto-save
    saveStatus, setSaveStatus,
    // Timeline comments
    timelineComments, setTimelineComments,
    // Responsive
    mounted, setMounted,
    isMobile, setIsMobile,
    mobileView, setMobileView,
  }
}
