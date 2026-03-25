import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TransitionTheme, OutroSettings } from './themeTypes'

interface Props {
  outro: OutroSettings
  theme: TransitionTheme
}

export function OutroCard({ outro, theme }: Props) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // CTA: aggressive scale punch in
  const ctaSpring = spring({ frame, fps, config: { damping: 14, stiffness: 120 } })
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.6, 1])
  const ctaOpacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })

  // Sub-text: slides up with slight delay
  const subSpring = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 20, stiffness: 80 } })
  const subTranslateY = interpolate(subSpring, [0, 1], [40, 0])
  const subOpacity = interpolate(frame, [6, 14], [0, 1], { extrapolateRight: 'clamp' })

  // Logo: fades in last
  const logoOpacity = interpolate(frame, [10, 20], [0, 1], { extrapolateRight: 'clamp' })

  // Pulse on CTA after it lands
  const pulseFrame = Math.max(0, frame - 10)
  const pulse = interpolate(
    Math.sin((pulseFrame / fps) * Math.PI * 2 * 1.2),
    [-1, 1],
    [0.97, 1.03],
  )

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
