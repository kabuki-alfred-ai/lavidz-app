import type { ReactNode } from 'react'
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { QuestionCard } from './QuestionCard'
import { RecordingClip } from './RecordingClip'
import { IntroCard } from './IntroCard'
import { OutroCard } from './OutroCard'
import { EndCard } from './EndCard'
import { ColdOpen } from './ColdOpen'
import { InlaysManager } from './InlaysManager'

export const END_CARD_FRAMES = 150 // 5 seconds at 30fps
import type { SubtitleSettings } from './subtitleTypes'
import type { TransitionTheme, IntroSettings, OutroSettings, MotionSettings, AudioSettings, WordTimestamp } from './themeTypes'

export interface CompositionSegment {
  id: string
  questionText: string
  videoUrl: string
  transcript: string | null
  wordTimestamps?: WordTimestamp[]
  videoDurationFrames: number
  ttsUrl: string | null
  /** Per-segment question card duration (frames). Falls back to global questionCardFrames. */
  questionDurationFrames?: number
  /** When present, only these frame ranges of the original video are shown (non-destructive cuts). */
  visibleRanges?: { startFrame: number; endFrame: number }[]
  /** Per-segment word-level emojis: shown when the matching word is active in subtitles */
  wordEmojis?: { word: string; emoji: string }[]
}

interface Props {
  segments: CompositionSegment[]
  questionCardFrames: number
  subtitleSettings: SubtitleSettings
  theme: TransitionTheme
  intro: IntroSettings
  fps: number
  motionSettings?: MotionSettings
  audioSettings?: AudioSettings
  outro?: OutroSettings
}

export function LavidzComposition({
  segments,
  questionCardFrames,
  subtitleSettings,
  theme,
  intro,
  fps,
  motionSettings,
  audioSettings,
  outro,
}: Props) {
  const frame = useCurrentFrame()
  let offset = 0
  const sequences: ReactNode[] = []

  // Cold Open (before everything)
  const coldOpen = motionSettings?.coldOpen
  let coldOpenDurationFrames = 0
  if (coldOpen?.enabled && coldOpen.hookPhrase) {
    coldOpenDurationFrames = Math.round((coldOpen.endInSeconds - coldOpen.startInSeconds) * fps)
    // Find the video URL from the matching segment
    const coldOpenSegment = segments.find(s => s.id === coldOpen.segmentId) ?? segments[0]
    if (coldOpenSegment) {
      sequences.push(
        <Sequence key="cold-open" from={0} durationInFrames={coldOpenDurationFrames}>
          <ColdOpen
            videoUrl={coldOpenSegment.videoUrl}
            startInSeconds={coldOpen.startInSeconds}
            hookPhrase={coldOpen.hookPhrase}
            swooshEnabled={coldOpen.swooshEnabled}
            textColor={coldOpen.textColor}
            highlightColor={coldOpen.highlightColor}
            fontFamily={coldOpen.fontFamily}
            fontSize={coldOpen.fontSize}
            textPosition={coldOpen.textPosition}
            videoStyle={coldOpen.videoStyle}
            freezeFrame={coldOpen.freezeFrame}
            textAnimation={coldOpen.textAnimation}
            highlightMode={coldOpen.highlightMode}
            coldOpenSfx={coldOpen.coldOpenSfx}
            entrySfx={coldOpen.entrySfx}
          />
        </Sequence>,
      )
      offset += coldOpenDurationFrames
    }
  }

  // Intro slide
  if (intro.enabled && intro.hookText) {
    const introDurationFrames = Math.round(intro.durationSeconds * fps)
    const introSfx = audioSettings?.introSfx
    sequences.push(
      <Sequence key="intro" from={offset} durationInFrames={introDurationFrames}>
        <IntroCard intro={intro} theme={theme} />
        {introSfx?.url && <Audio src={introSfx.url} volume={introSfx.volume ?? 1} />}
      </Sequence>,
    )
    offset += introDurationFrames
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const qFrames = seg.questionDurationFrames ?? questionCardFrames
    const questionFrom = offset
    const recordingFrom = offset + qFrames

    const cardColors = motionSettings?.questionCardColors
    const cardBg = cardColors?.length
      ? cardColors[i % cardColors.length]
      : undefined

    sequences.push(
      <Sequence key={`q-${seg.id}`} from={questionFrom} durationInFrames={qFrames}>
        <QuestionCard question={seg.questionText} ttsUrl={seg.ttsUrl} theme={theme} backgroundColor={cardBg} ttsVolume={audioSettings?.ttsVolume} sfxUrl={audioSettings?.transitionSfx?.url} sfxVolume={audioSettings?.transitionSfx?.volume} questionCardStyle={motionSettings?.questionCardStyle} transitionStyle={motionSettings?.questionCardTransition} bgPattern={motionSettings?.questionCardBgPattern} colors={motionSettings?.questionCardColors} />
      </Sequence>,
    )

    if (seg.visibleRanges && seg.visibleRanges.length > 0) {
      // Non-destructive cuts: render one sub-sequence per visible range.
      // wordTimestamps are globally remapped (0..totalVisibleSec). Each RecordingClip
      // uses useCurrentFrame() starting at 0, so we must re-offset the timestamps to
      // be local to each range (subtract accumulated seconds from previous ranges).
      let clipOffset = recordingFrom
      let accumulatedSec = 0
      for (let r = 0; r < seg.visibleRanges.length; r++) {
        const range = seg.visibleRanges[r]
        const rangeDur = range.endFrame - range.startFrame
        const rangeSec = rangeDur / fps
        // Extract and re-offset word timestamps for this specific range
        const rangeWts = seg.wordTimestamps
          ?.filter(w => w.end > accumulatedSec - 0.05 && w.start < accumulatedSec + rangeSec + 0.05)
          .map(w => ({
            word: w.word,
            start: Math.max(0, w.start - accumulatedSec),
            end: Math.min(rangeSec, w.end - accumulatedSec),
          }))
        sequences.push(
          <Sequence key={`r-${seg.id}-${r}`} from={clipOffset} durationInFrames={rangeDur}>
            <RecordingClip
              videoUrl={seg.videoUrl}
              transcript={seg.transcript}
              wordTimestamps={rangeWts}
              durationInFrames={rangeDur}
              startFromFrame={range.startFrame}
              subtitleSettings={seg.wordEmojis?.length ? { ...subtitleSettings, wordEmojis: seg.wordEmojis } : subtitleSettings}
              motionSettings={motionSettings}
            />
          </Sequence>,
        )
        clipOffset += rangeDur
        accumulatedSec += rangeSec
      }
      offset = clipOffset
    } else {
      sequences.push(
        <Sequence key={`r-${seg.id}`} from={recordingFrom} durationInFrames={seg.videoDurationFrames}>
          <RecordingClip
            videoUrl={seg.videoUrl}
            transcript={seg.transcript}
            wordTimestamps={seg.wordTimestamps}
            durationInFrames={seg.videoDurationFrames}
            subtitleSettings={seg.wordEmojis?.length ? { ...subtitleSettings, wordEmojis: seg.wordEmojis } : subtitleSettings}
            motionSettings={motionSettings}
          />
        </Sequence>,
      )
      offset += qFrames + seg.videoDurationFrames
    }
  }

  // Outro slide
  if (outro?.enabled && (outro.ctaText || outro.subText || outro.logoUrl)) {
    const outroDurationFrames = Math.round(outro.durationSeconds * fps)
    const outroSfx = audioSettings?.outroSfx
    sequences.push(
      <Sequence key="outro" from={offset} durationInFrames={outroDurationFrames}>
        <OutroCard outro={outro} theme={theme} />
        {outroSfx?.url && <Audio src={outroSfx.url} volume={outroSfx.volume ?? 1} />}
      </Sequence>,
    )
    offset += outroDurationFrames
  }

  // End card — always appended
  sequences.push(
    <Sequence key="end-card" from={offset} durationInFrames={END_CARD_FRAMES}>
      <EndCard />
    </Sequence>,
  )
  offset += END_CARD_FRAMES

  const bgMusic = audioSettings?.bgMusic
  const totalFrames = offset

  const watermark = (
    <div
      style={{
        position: 'absolute',
        bottom: 28,
        right: 28,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: 0.35,
        pointerEvents: 'none',
      }}
    >
      {/* Standardized liquid logo morph icon */}
      <div
        style={{
          width: 14,
          height: 14,
          background: '#ffffff',
          borderRadius: `${interpolate(
            Math.sin((frame / fps / 4) * Math.PI * 2),
            [-1, 1],
            [0, 50]
          )}%`,
          transform: `rotate(${interpolate(
            frame % (fps * 4),
            [0, fps * 4],
            [0, 360]
          )}deg) scale(${interpolate(
            Math.sin((frame / fps / 4) * Math.PI * 2),
            [-1, 1],
            [1, 0.85]
          )})`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "sans-serif",
          fontWeight: 800,
          fontSize: 24,
          color: '#ffffff',
          letterSpacing: -0.5,
          textTransform: 'uppercase',
        }}
      >
        LAVIDZ
      </span>
    </div>
  )

  return (
    <AbsoluteFill style={{ background: theme.backgroundColor }}>
      {bgMusic?.url && (
        <Sequence from={0} durationInFrames={totalFrames}>
          <Audio src={bgMusic.url} volume={bgMusic.volume} loop />
        </Sequence>
      )}
      {sequences}
      {motionSettings?.inlays?.enabled && motionSettings.inlays.inlays.length > 0 && (
        <InlaysManager
          inlays={motionSettings.inlays.inlays}
          globalFrameOffset={coldOpenDurationFrames + (intro.enabled && intro.hookText ? Math.round(intro.durationSeconds * fps) : 0)}
          popSoundEnabled={motionSettings.inlays.popSoundEnabled}
          popVolume={motionSettings.inlays.popVolume}
          duration={motionSettings.inlays.duration}
          style={motionSettings.inlays.style}
        />
      )}
      {watermark}
    </AbsoluteFill>
  )
}
