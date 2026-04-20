import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import type { VisualInlay, InlayCategory } from './themeTypes'

// ── Emoji map (Submagic-style: gros emojis colorés, pas des icônes SVG) ──────

const EMOJI_MAP: Record<InlayCategory, string> = {
  alert:  '⚠️',
  money:  '💰',
  growth: '📈',
  idea:   '💡',
  fire:   '🔥',
  heart:  '❤️',
  target: '🎯',
  star:   '⭐',
}

const GLOW_MAP: Record<InlayCategory, string> = {
  alert:  'rgba(255,59,48,0.6)',
  money:  'rgba(52,199,89,0.6)',
  growth: 'rgba(48,209,88,0.6)',
  idea:   'rgba(255,214,10,0.6)',
  fire:   'rgba(255,107,0,0.6)',
  heart:  'rgba(255,45,85,0.6)',
  target: 'rgba(0,122,255,0.6)',
  star:   'rgba(255,215,0,0.6)',
}

// ── Particle burst on entry ───────────────────────────────────────────────────

const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315].map(d => (d * Math.PI) / 180)

function ParticleBurst({ color, fps }: { color: string; fps: number }) {
  const frame = useCurrentFrame()

  return (
    <>
      {PARTICLE_ANGLES.map((angle, i) => {
        const delay = i % 2 === 0 ? 0 : 1
        const f = Math.max(0, frame - delay)

        const distance = interpolate(f, [0, 12], [0, 55], { extrapolateRight: 'clamp' })
        const opacity  = interpolate(f, [0, 4, 12], [0, 1, 0], { extrapolateRight: 'clamp' })
        const size     = interpolate(f, [0, 4, 12], [2, 6, 3], { extrapolateRight: 'clamp' })

        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              opacity,
              transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))`,
              pointerEvents: 'none',
            }}
          />
        )
      })}
    </>
  )
}

// ── Single inlay with Submagic-style animation ────────────────────────────────

function InlayEmoji({
  inlay,
  index,
  displayStyle,
  fps,
}: {
  inlay: VisualInlay
  index: number
  displayStyle: 'pill' | 'minimal' | 'bold'
  fps: number
}) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const emoji = EMOJI_MAP[inlay.category]
  const glow  = GLOW_MAP[inlay.category]

  // ── Entry: overshoot spring (0 → 1.25 → 1.0) ──────────────────────────────
  const entryScale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 6, mass: 0.4, stiffness: 280 },
  })

  // ── Idle: subtle up-down oscillation after entry settles ──────────────────
  const idleOffset = frame > 8
    ? interpolate(Math.sin(((frame - 8) / fps) * Math.PI * 2.2), [-1, 1], [-4, 4])
    : 0

  // ── Rotation snap on entry ────────────────────────────────────────────────
  const entryRotate = spring({
    frame,
    fps,
    from: -18,
    to: 0,
    config: { damping: 8, mass: 0.5, stiffness: 200 },
  })

  // ── Fade out last 10 frames ───────────────────────────────────────────────
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  // ── Position: alternate sides, stagger vertically ─────────────────────────
  const isRight = index % 2 === 0
  const verticalOffset = (index % 3) * 100
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    top: 80 + verticalOffset,
    ...(isRight ? { right: 40 } : { left: 40 }),
  }

  const emojiSize = displayStyle === 'minimal' ? 52 : 68

  return (
    <div
      style={{
        ...positionStyle,
        opacity: fadeOut,
        transform: `scale(${entryScale}) rotate(${entryRotate}deg) translateY(${idleOffset}px)`,
        transformOrigin: 'center center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
        // Glow effect
        filter: `drop-shadow(0 0 16px ${glow}) drop-shadow(0 4px 12px rgba(0,0,0,0.6))`,
      }}
    >
      {/* Particle burst (only on entry, first 15 frames) */}
      {frame < 16 && (
        <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ParticleBurst color={glow} fps={fps} />
        </div>
      )}

      {/* Emoji */}
      <span
        style={{
          fontSize: emojiSize,
          lineHeight: 1,
          display: 'block',
          userSelect: 'none',
          fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Twemoji Mozilla", sans-serif',
        }}
      >
        {emoji}
      </span>

      {/* Label / keyword — pill style only */}
      {inlay.label && displayStyle !== 'minimal' && (
        <div
          style={{
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            borderRadius: 20,
            padding: '4px 12px',
            border: `1px solid ${glow}`,
          }}
        >
          <span
            style={{
              fontFamily: "Impact, 'Arial Narrow', sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: '#FFFFFF',
              textTransform: 'uppercase',
              letterSpacing: 1,
              textShadow: `0 0 12px ${glow}`,
            }}
          >
            {inlay.label}
          </span>
        </div>
      )}
    </div>
  )
}

// ── InlaysManager ─────────────────────────────────────────────────────────────

interface InlaysManagerProps {
  inlays: VisualInlay[]
  globalFrameOffset: number
  popSoundEnabled: boolean
  popVolume?: number
  duration?: number
  style?: 'pill' | 'minimal' | 'bold'
}

export function InlaysManager({
  inlays,
  globalFrameOffset,
  popSoundEnabled,
  popVolume = 0.5,
  duration = 2,
  style = 'pill',
}: InlaysManagerProps) {
  const { fps } = useVideoConfig()

  if (!inlays.length) return null

  const INLAY_DURATION_FRAMES = Math.round(fps * duration)

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15 }}>
      {inlays.map((inlay, i) => {
        const fromFrame = Math.round(inlay.timeInSeconds * fps) + globalFrameOffset

        return (
          <Sequence key={`inlay-${i}`} from={fromFrame} durationInFrames={INLAY_DURATION_FRAMES}>
            <InlayEmoji inlay={inlay} index={i} displayStyle={style} fps={fps} />
            {popSoundEnabled && (
              <Audio src={staticFile('sfx/pop.mp3')} volume={popVolume} />
            )}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
