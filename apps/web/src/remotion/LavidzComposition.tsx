import type { ReactNode } from 'react'
import { AbsoluteFill, Audio, Sequence } from 'remotion'
import { QuestionCard } from './QuestionCard'
import { RecordingClip } from './RecordingClip'
import { IntroCard } from './IntroCard'
import type { SubtitleSettings } from './subtitleTypes'
import type { TransitionTheme, IntroSettings, MotionSettings, AudioSettings, WordTimestamp } from './themeTypes'

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
}: Props) {
  let offset = 0
  const sequences: ReactNode[] = []

  // Intro slide
  if (intro.enabled && intro.hookText) {
    const introDurationFrames = Math.round(intro.durationSeconds * fps)
    sequences.push(
      <Sequence key="intro" from={0} durationInFrames={introDurationFrames}>
        <IntroCard intro={intro} theme={theme} />
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
        <QuestionCard question={seg.questionText} ttsUrl={seg.ttsUrl} theme={theme} backgroundColor={cardBg} />
      </Sequence>,
    )

    sequences.push(
      <Sequence key={`r-${seg.id}`} from={recordingFrom} durationInFrames={seg.videoDurationFrames}>
        <RecordingClip
          videoUrl={seg.videoUrl}
          transcript={seg.transcript}
          wordTimestamps={seg.wordTimestamps}
          durationInFrames={seg.videoDurationFrames}
          subtitleSettings={subtitleSettings}
          motionSettings={motionSettings}
          sfxUrl={audioSettings?.transitionSfx?.url}
          sfxVolume={audioSettings?.transitionSfx?.volume}
        />
      </Sequence>,
    )

    offset += qFrames + seg.videoDurationFrames
  }

  const bgMusic = audioSettings?.bgMusic
  const totalFrames = offset

  return (
    <AbsoluteFill style={{ background: theme.backgroundColor }}>
      {bgMusic?.url && (
        <Sequence from={0} durationInFrames={totalFrames}>
          <Audio src={bgMusic.url} volume={bgMusic.volume} loop />
        </Sequence>
      )}
      {sequences}
    </AbsoluteFill>
  )
}
