import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TransitionTheme, OutroSettings } from './themeTypes'

interface Props {
  outro: OutroSettings
  theme: TransitionTheme
}

export function OutroCard({ outro, theme }: Props) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  // CTA: simple fade in, no bounce
  const ctaScale = 1
  const ctaOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' })

  // Sub-text: slides up with slight delay
  const subTranslateY = interpolate(frame, [6, 20], [24, 0], { extrapolateRight: 'clamp' })
  const subOpacity = interpolate(frame, [6, 18], [0, 1], { extrapolateRight: 'clamp' })

  // Logo: fades in last
  const logoOpacity = interpolate(frame, [10, 20], [0, 1], { extrapolateRight: 'clamp' })

  const pulse = 1

  // Fade out near the end
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Accent color: derive from theme text color for contrast
  const accentColor = theme.textColor === '#FFFFFF' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <AbsoluteFill
      style={{
        background: theme.backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 80,
        opacity: fadeOut,
      }}
    >
      {/* Decorative top bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: theme.textColor,
          opacity: logoOpacity,
        }}
      />

      {/* Logo */}
      {outro.logoUrl && (
        <Img
          src={outro.logoUrl}
          style={{
            height: 56,
            objectFit: 'contain',
            opacity: logoOpacity,
          }}
        />
      )}

      {/* CTA — main punch text */}
      {outro.ctaText && (
        <div
          style={{
            background: accentColor,
            borderRadius: 20,
            padding: '20px 40px',
            opacity: ctaOpacity,
            transform: `scale(${ctaScale * pulse})`,
            transformOrigin: 'center center',
          }}
        >
          <h1
            style={{
              fontFamily: theme.fontFamily,
              fontWeight: theme.fontWeight,
              fontSize: 68,
              color: theme.textColor,
              textAlign: 'center',
              lineHeight: 1.1,
              maxWidth: 1000,
              margin: 0,
            }}
          >
            {outro.ctaText}
          </h1>
        </div>
      )}

      {/* Sub-text — handle or secondary CTA */}
      {outro.subText && (
        <p
          style={{
            fontFamily: theme.fontFamily,
            fontSize: 32,
            fontWeight: 600,
            color: theme.textColor,
            opacity: subOpacity * 0.65,
            transform: `translateY(${subTranslateY}px)`,
            textAlign: 'center',
            margin: 0,
            letterSpacing: 1,
          }}
        >
          {outro.subText}
        </p>
      )}

      {/* Decorative bottom bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: theme.textColor,
          opacity: logoOpacity,
        }}
      />
    </AbsoluteFill>
  )
}
