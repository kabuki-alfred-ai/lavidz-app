import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TransitionTheme } from './themeTypes'

interface Props {
  question: string
  ttsUrl: string | null
  theme: TransitionTheme
  backgroundColor?: string
  ttsVolume?: number
  sfxUrl?: string
  sfxVolume?: number
}

export function QuestionCard({ question, ttsUrl, theme, backgroundColor, ttsVolume = 1, sfxUrl, sfxVolume = 1 }: Props) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const appear = spring({ frame, fps, config: { damping: 22, stiffness: 70 } })
  const translateY = interpolate(appear, [0, 1], [40, 0])

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor ?? theme.backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
      }}
    >
      {sfxUrl && <Audio src={sfxUrl} volume={sfxVolume} />}
      {ttsUrl && <Audio src={ttsUrl} volume={ttsVolume} />}

      <h2
        style={{
          fontFamily: theme.fontFamily,
          fontWeight: theme.fontWeight,
          fontSize: 64,
          color: theme.textColor,
          textAlign: 'center',
          lineHeight: 1.1,
          maxWidth: 1000,
          margin: 0,
          opacity: appear,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {question}
      </h2>
    </AbsoluteFill>
  )
}
