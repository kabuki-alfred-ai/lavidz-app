import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TransitionTheme, IntroSettings } from './themeTypes'

interface Props {
  intro: IntroSettings
  theme: TransitionTheme
}

export function IntroCard({ intro, theme }: Props) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const appear = spring({ frame, fps, config: { damping: 22, stiffness: 70 } })
  const translateY = interpolate(appear, [0, 1], [50, 0])

  // Fade out near the end
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        background: theme.backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        padding: 80,
        opacity: fadeOut,
      }}
    >
      {intro.logoUrl && (
        <Img
          src={intro.logoUrl}
          style={{
            height: 64,
            objectFit: 'contain',
            opacity: appear,
            transform: `translateY(${translateY}px)`,
          }}
        />
      )}

      {intro.hookText && (
        <h1
          style={{
            fontFamily: theme.fontFamily,
            fontWeight: theme.fontWeight,
            fontSize: 72,
            color: theme.textColor,
            textAlign: 'center',
            lineHeight: 1.1,
            maxWidth: 1000,
            margin: 0,
            opacity: appear,
            transform: `translateY(${translateY}px)`,
          }}
        >
          {intro.hookText}
        </h1>
      )}
    </AbsoluteFill>
  )
}
