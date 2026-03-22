import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TransitionTheme } from './themeTypes'

interface Props {
  question: string
  ttsUrl: string | null
  theme: TransitionTheme
}

export function QuestionCard({ question, ttsUrl, theme }: Props) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const appear = spring({ frame, fps, config: { damping: 22, stiffness: 70 } })
  const translateY = interpolate(appear, [0, 1], [40, 0])

  return (
    <AbsoluteFill
      style={{
        background: theme.backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
      }}
    >
      {ttsUrl && <Audio src={ttsUrl} />}

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
