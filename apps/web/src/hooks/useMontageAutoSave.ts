import { useEffect, useRef, useMemo } from 'react'
import type { SubtitleSettings } from '@/remotion/subtitleTypes'
import type { TransitionTheme, IntroSettings, OutroSettings, MotionSettings, AudioSettings, WordTimestamp, BRollItem } from '@/remotion/themeTypes'
import type { ClipEdit } from '@/components/session/Timeline'
import type { CleanvoiceConfig, FormatKey } from '@/components/session/process-view-utils'

interface AutoSaveParams {
  sessionId: string
  selectedVoiceId: string
  voiceEnabled: boolean
  format: FormatKey
  subtitleSettings: SubtitleSettings
  theme: TransitionTheme
  intro: IntroSettings
  outro: OutroSettings
  motionSettings: MotionSettings
  questionCardFrames: number
  activePresetId: string | null
  audioSettings: AudioSettings
  bgMusicPrompt: string
  transitionSfxPrompt: string
  silenceCutEnabled: boolean
  silenceThreshold: number
  fillerCutEnabled: boolean
  denoiseEnabled: boolean
  denoiseStrength: 'light' | 'moderate' | 'strong' | 'isolate'
  cleanvoiceEnabled: boolean
  cleanvoiceConfig: CleanvoiceConfig
  localTranscripts: Record<string, string>
  wordTimestampsMap: Record<string, WordTimestamp[]>
  clipEdits: ClipEdit[]
  sourceWordTimestampsRef: React.MutableRefObject<Record<string, WordTimestamp[]>>
  coldOpenEnabled: boolean
  coldOpenData: { hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string } | null
  inlaysEnabled: boolean
  inlaysData: { exactWord: string; category: string; timeInSeconds: number; label?: string }[]
  swooshEnabled: boolean
  popSoundEnabled: boolean
  coldOpenTextColor: string
  coldOpenHighlightColor: string
  coldOpenFontFamily: string
  coldOpenFontSize: number
  coldOpenTextPosition: 'bottom' | 'center' | 'top'
  coldOpenVideoStyle: 'bw' | 'desaturated' | 'color' | 'raw'
  coldOpenFreezeFrame: boolean
  coldOpenTextAnimEnabled: boolean
  coldOpenTextAnimation: 'pop' | 'slam' | 'typewriter'
  coldOpenHighlightModeEnabled: boolean
  coldOpenHighlightMode: 'word' | 'all' | 'box'
  coldOpenSfxEnabled: boolean
  coldOpenSfx: { prompt: string; url: string; volume: number } | null
  coldOpenEntrySfxEnabled: boolean
  coldOpenEntrySfx: { prompt: string; url: string; volume: number } | null
  inlaysStyle: 'pill' | 'minimal' | 'bold'
  inlaysDuration: number
  inlaysPopVolume: number
  bRollEnabled: boolean
  bRollItems: BRollItem[]
  setSaveStatus: (s: 'idle' | 'saving' | 'saved' | 'error') => void
}

export function useMontageAutoSave(params: AutoSaveParams) {
  const {
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
  } = params

  const saveIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const settingsForSave = useMemo(() => JSON.stringify({
    selectedVoiceId, voiceEnabled, format, subtitleSettings, theme, intro, outro,
    motionSettings, questionCardFrames, activePresetId, audioSettings,
    bgMusicPrompt, transitionSfxPrompt, silenceCutEnabled, silenceThreshold,
    fillerCutEnabled, denoiseEnabled, denoiseStrength, cleanvoiceEnabled, cleanvoiceConfig,
    localTranscripts, wordTimestampsMap, clipEdits,
    sourceWordTimestampsMap: sourceWordTimestampsRef.current,
    coldOpenEnabled, coldOpenData, inlaysEnabled, inlaysData, swooshEnabled, popSoundEnabled,
    coldOpenTextColor, coldOpenHighlightColor, coldOpenFontFamily, coldOpenFontSize, coldOpenTextPosition, coldOpenVideoStyle,
    coldOpenFreezeFrame, coldOpenTextAnimEnabled, coldOpenTextAnimation,
    coldOpenHighlightModeEnabled, coldOpenHighlightMode,
    coldOpenSfxEnabled, coldOpenSfx, coldOpenEntrySfxEnabled, coldOpenEntrySfx,
    inlaysStyle, inlaysDuration, inlaysPopVolume,
    bRollEnabled, bRollItems,
  }), [
    selectedVoiceId, voiceEnabled, format, subtitleSettings, theme, intro, outro,
    motionSettings, questionCardFrames, activePresetId, audioSettings,
    bgMusicPrompt, transitionSfxPrompt, silenceCutEnabled, silenceThreshold,
    fillerCutEnabled, denoiseEnabled, denoiseStrength, cleanvoiceEnabled, cleanvoiceConfig,
    localTranscripts, wordTimestampsMap, clipEdits,
    coldOpenEnabled, coldOpenData, inlaysEnabled, inlaysData, swooshEnabled, popSoundEnabled,
    coldOpenTextColor, coldOpenHighlightColor, coldOpenFontFamily, coldOpenFontSize, coldOpenTextPosition, coldOpenVideoStyle,
    coldOpenFreezeFrame, coldOpenTextAnimEnabled, coldOpenTextAnimation,
    coldOpenHighlightModeEnabled, coldOpenHighlightMode,
    coldOpenSfxEnabled, coldOpenSfx, coldOpenEntrySfxEnabled, coldOpenEntrySfx,
    inlaysStyle, inlaysDuration, inlaysPopVolume,
    bRollEnabled, bRollItems,
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
        if (res.ok) {
          saveIdleTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
        }
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
    return () => clearTimeout(timeout)
  }, [settingsForSave]) // eslint-disable-line react-hooks/exhaustive-deps

  return { saveIdleTimerRef }
}
