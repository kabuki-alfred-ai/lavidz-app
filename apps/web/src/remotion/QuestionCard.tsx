import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TransitionTheme, QuestionCardStyle, TransitionStyle, SlideBgPattern } from './themeTypes'

interface Props {
  question: string
  ttsUrl: string | null
  theme: TransitionTheme
  backgroundColor?: string
  ttsVolume?: number
  sfxUrl?: string
  sfxVolume?: number
  questionCardStyle?: QuestionCardStyle
  transitionStyle?: TransitionStyle
  bgPattern?: SlideBgPattern
}

// ── Background pattern ────────────────────────────────────────────────────────

function CardBg({ bgColor, accentColor, pattern, frame, fps }: {
  bgColor: string; accentColor: string; pattern: SlideBgPattern; frame: number; fps: number
}) {
  const base: React.CSSProperties = { position: 'absolute', inset: 0 }

  if (pattern === 'dots') return <div style={{ ...base, backgroundColor: bgColor, backgroundImage: `radial-gradient(circle, ${accentColor}33 1.5px, transparent 1.5px)`, backgroundSize: '48px 48px' }} />
  if (pattern === 'grid') return <div style={{ ...base, backgroundColor: bgColor, backgroundImage: `linear-gradient(${accentColor}22 1px, transparent 1px), linear-gradient(90deg, ${accentColor}22 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />
  if (pattern === 'diagonal') return <div style={{ ...base, backgroundColor: bgColor, backgroundImage: `repeating-linear-gradient(45deg, ${accentColor}18 0, ${accentColor}18 1px, transparent 0, transparent 50%)`, backgroundSize: '32px 32px' }} />
  if (pattern === 'radial') return <div style={{ ...base, background: `radial-gradient(ellipse at 50% 50%, ${accentColor}44 0%, ${bgColor} 65%)` }} />

  if (pattern === 'noise') return (
    <>
      <div style={{ ...base, backgroundColor: bgColor }} />
      <svg style={{ ...base, opacity: 0.08 }}>
        <filter id="noise-qcard"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#noise-qcard)" />
      </svg>
    </>
  )

  if (pattern === 'confetti') {
    const blocks = [
      { x: 8,  y: 10, w: 120, h: 90,  delay: 0, op: 1.0 },
      { x: 82, y: 6,  w: 90,  h: 120, delay: 3, op: 0.7 },
      { x: 5,  y: 72, w: 100, h: 80,  delay: 5, op: 0.5 },
      { x: 78, y: 74, w: 140, h: 100, delay: 2, op: 0.8 },
      { x: 40, y: 3,  w: 80,  h: 60,  delay: 7, op: 0.4 },
      { x: 50, y: 88, w: 110, h: 70,  delay: 4, op: 0.6 },
    ]
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {blocks.map((b, i) => {
          const s = spring({ frame: frame - b.delay, fps, config: { damping: 20, stiffness: 120 } })
          return <div key={i} style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%`, width: b.w, height: b.h, backgroundColor: accentColor, opacity: b.op * s, transform: `scale(${s})`, transformOrigin: 'center', borderRadius: 4 }} />
        })}
      </>
    )
  }

  if (pattern === 'stripes') {
    const N = 6
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {Array.from({ length: N }, (_, i) => {
          const s = spring({ frame: frame - i * 3, fps, config: { damping: 20, stiffness: 100 } })
          return <div key={i} style={{ position: 'absolute', left: `${(i / N) * 100}%`, top: 0, width: `${100 / N}%`, height: `${s * 100}%`, backgroundColor: accentColor, opacity: 0.15 + (i % 2) * 0.1 }} />
        })}
      </>
    )
  }

  if (pattern === 'scanlines') return (
    <>
      <div style={{ ...base, backgroundColor: bgColor }} />
      <div style={{ ...base, backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 2px, ${accentColor}0A 2px, ${accentColor}0A 4px)`, backgroundPositionY: `${(frame * 0.4) % 4}px` }} />
    </>
  )

  if (pattern === 'gradient-sweep') return (
    <div style={{ ...base, background: `conic-gradient(from ${frame * 0.8}deg at 50% 50%, ${bgColor} 0%, ${accentColor}40 30%, ${bgColor} 60%, ${accentColor}20 90%, ${bgColor} 100%)` }} />
  )

  if (pattern === 'aurora') {
    const t = frame * 0.025
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        <div style={{ ...base, background: `radial-gradient(ellipse 90% 70% at ${50 + Math.sin(t) * 22}% ${30 + Math.cos(t * 0.7) * 18}%, ${accentColor}50 0%, transparent 65%)` }} />
        <div style={{ ...base, background: `radial-gradient(ellipse 70% 90% at ${28 + Math.cos(t * 1.3) * 22}% ${65 + Math.sin(t * 0.9) * 18}%, ${accentColor}30 0%, transparent 60%)` }} />
        <div style={{ ...base, background: `radial-gradient(ellipse 60% 60% at ${72 + Math.sin(t * 0.8 + 1) * 18}% ${42 + Math.cos(t * 1.1) * 22}%, ${accentColor}20 0%, transparent 55%)` }} />
      </>
    )
  }

  if (pattern === 'halftone') {
    const r = 3 + Math.sin(frame * 0.1) * 1.5
    const sp = 26
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        <svg style={{ ...base, opacity: 0.22 }}>
          <defs>
            <pattern id="ht-qcard" x="0" y="0" width={sp} height={sp} patternUnits="userSpaceOnUse">
              <circle cx={sp / 2} cy={sp / 2} r={r} fill={accentColor} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ht-qcard)" />
        </svg>
      </>
    )
  }

  if (pattern === 'vhs') {
    const bands = Array.from({ length: 7 }, (_, i) => ({
      y: ((Math.abs(Math.sin(frame * 0.31 + i * 133.7)) * 100)) % 100,
      h: 2 + Math.abs(Math.sin(frame * 0.8 + i * 17)) * 5,
      op: Math.abs(Math.sin(frame * 2.1 + i * 3.3)) * 0.35,
    }))
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {bands.map((b, i) => <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${b.y}%`, height: b.h, backgroundColor: accentColor, opacity: b.op }} />)}
        <div style={{ ...base, background: `linear-gradient(to bottom, ${accentColor}06 0%, transparent 15%, transparent 85%, ${accentColor}06 100%)` }} />
      </>
    )
  }

  // solid (default)
  return <div style={{ ...base, backgroundColor: bgColor }} />
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuestionCard({
  question, ttsUrl, theme, backgroundColor,
  ttsVolume = 1, sfxUrl, sfxVolume = 1,
  questionCardStyle = 'default',
  transitionStyle = 'none',
  bgPattern = 'solid',
}: Props) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const bgColor = backgroundColor ?? theme.backgroundColor
  const accent = theme.textColor

  // ── Card entry animation ──────────────────────────────────────────────────
  const entrySpring = spring({ frame, fps, config: { damping: 26, stiffness: 130 } })

  const cardOpacity = (transitionStyle === 'slide-up' || transitionStyle === 'blur-in')
    ? interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
    : 1

  const cardTransformParts: string[] = []
  if (transitionStyle === 'zoom-punch') {
    cardTransformParts.push(`scale(${interpolate(frame, [0, 10], [1.12, 1.0], { extrapolateRight: 'clamp' })})`)
  } else if (transitionStyle === 'slide-up') {
    cardTransformParts.push(`translateY(${interpolate(entrySpring, [0, 1], [height, 0])}px)`)
  } else if (transitionStyle === 'wipe-right') {
    cardTransformParts.push(`translateX(${interpolate(entrySpring, [0, 1], [-width, 0])}px)`)
  } else if (transitionStyle === 'spin-scale') {
    cardTransformParts.push(`scale(${interpolate(entrySpring, [0, 1], [0.88, 1])}) rotate(${interpolate(entrySpring, [0, 1], [4, 0])}deg)`)
  } else if (transitionStyle === 'shake' && frame < 18) {
    cardTransformParts.push(`translateX(${Math.sin(frame * 3.8) * interpolate(frame, [0, 18], [20, 0], { extrapolateRight: 'clamp' })}px)`)
  } else if (transitionStyle === 'glitch-cut' && frame < 9) {
    cardTransformParts.push(`translateX(${Math.sin(frame * 47.3) * 10}px)`)
  }

  const cardFilter = transitionStyle === 'blur-in'
    ? `blur(${interpolate(frame, [0, 20], [24, 0], { extrapolateRight: 'clamp' })}px)`
    : transitionStyle === 'glitch-cut' && frame < 9
      ? `hue-rotate(${frame * 20}deg) saturate(2)`
      : undefined

  const flashOpacity = transitionStyle === 'flash'
    ? interpolate(frame, [0, 7], [1, 0], { extrapolateRight: 'clamp' })
    : 0

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    opacity: cardOpacity,
    transform: cardTransformParts.length ? cardTransformParts.join(' ') : undefined,
    filter: cardFilter,
  }

  const bg = <CardBg bgColor={bgColor} accentColor={accent} pattern={bgPattern} frame={frame} fps={fps} />

  const flashNode = flashOpacity > 0
    ? <div style={{ position: 'absolute', inset: 0, backgroundColor: '#fff', opacity: flashOpacity, zIndex: 20, pointerEvents: 'none' }} />
    : null

  const audioNodes = (
    <>
      {sfxUrl && <Audio src={sfxUrl} volume={sfxVolume} />}
      {ttsUrl && <Audio src={ttsUrl} volume={ttsVolume} />}
    </>
  )

  // ── default ─────────────────────────────────────────────────────────────────
  if (questionCardStyle === 'default') {
    const appear = spring({ frame, fps, config: { damping: 22, stiffness: 70 } })
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          {audioNodes}
          {flashNode}
          <h2 style={{
            fontFamily: theme.fontFamily, fontWeight: theme.fontWeight, fontSize: 64,
            color: accent, textAlign: 'center', lineHeight: 1.1, maxWidth: 1000, margin: 0,
            opacity: appear, transform: `translateY(${interpolate(appear, [0, 1], [40, 0])}px)`,
          }}>{question}</h2>
        </AbsoluteFill>
      </div>
    )
  }

  // ── flash-word ───────────────────────────────────────────────────────────────
  if (questionCardStyle === 'flash-word') {
    const words = question.split(' ')
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          {audioNodes}
          {flashNode}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 18px', maxWidth: 1000 }}>
            {words.map((word, i) => {
              const s = spring({ frame: frame - i * 3, fps, config: { damping: 16, stiffness: 280 } })
              const isFirst = i === 0
              return (
                <span key={i} style={{
                  fontFamily: theme.fontFamily, fontWeight: theme.fontWeight,
                  fontSize: isFirst ? 82 : 72,
                  color: isFirst ? bgColor : accent,
                  backgroundColor: isFirst ? accent : 'transparent',
                  padding: isFirst ? '2px 14px' : '0',
                  textAlign: 'center', lineHeight: 1.15, display: 'inline-block',
                  opacity: s, transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
                }}>{word}</span>
              )
            })}
          </div>
        </AbsoluteFill>
      </div>
    )
  }

  // ── brut ────────────────────────────────────────────────────────────────────
  if (questionCardStyle === 'brut') {
    const s = spring({ frame: frame - 4, fps, config: { damping: 24, stiffness: 120 } })
    const lineScale = spring({ frame, fps, config: { damping: 26, stiffness: 180 } })
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '80px 100px' }}>
          {audioNodes}
          {flashNode}
          <div style={{ position: 'absolute', left: 60, top: '25%', bottom: '25%', width: 6, backgroundColor: accent, transform: `scaleY(${lineScale})`, transformOrigin: 'top' }} />
          <div style={{ marginLeft: 36, opacity: s, transform: `translateX(${interpolate(s, [0, 1], [-80, 0])}px)`, maxWidth: 900 }}>
            <h2 style={{ fontFamily: theme.fontFamily, fontWeight: theme.fontWeight, fontSize: 68, color: accent, textAlign: 'left', lineHeight: 1.05, margin: 0, textTransform: 'uppercase', letterSpacing: -1 }}>{question}</h2>
          </div>
        </AbsoluteFill>
      </div>
    )
  }

  // ── split-color ──────────────────────────────────────────────────────────────
  if (questionCardStyle === 'split-color') {
    const splitProgress = spring({ frame, fps, config: { damping: 26, stiffness: 100 } })
    const splitOffset = interpolate(splitProgress, [0, 1], [height * 0.5, 0])
    const textAppear = spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 80 } })
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          {audioNodes}
          {flashNode}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: accent, transform: `translateY(${-splitOffset}px)` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
            <h2 style={{
              fontFamily: theme.fontFamily, fontWeight: theme.fontWeight, fontSize: 64,
              textAlign: 'center', lineHeight: 1.1, maxWidth: 1000, margin: 0,
              opacity: textAppear, transform: `translateY(${interpolate(textAppear, [0, 1], [30, 0])}px)`,
              background: `linear-gradient(to bottom, ${bgColor} 50%, ${accent} 50%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{question}</h2>
          </div>
        </AbsoluteFill>
      </div>
    )
  }

  // ── typewriter ───────────────────────────────────────────────────────────────
  if (questionCardStyle === 'typewriter') {
    const visibleChars = Math.floor(frame * 2.5)
    const showCursor = visibleChars < question.length + 8
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          {audioNodes}
          {flashNode}
          <h2 style={{
            fontFamily: `'Courier New', Courier, monospace`, fontWeight: 700, fontSize: 58,
            color: accent, textAlign: 'center', lineHeight: 1.25, maxWidth: 1000, margin: 0,
            opacity: interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {question.slice(0, visibleChars)}
            {showCursor && <span style={{ opacity: Math.floor(frame / 5) % 2 === 0 ? 1 : 0 }}>▌</span>}
          </h2>
        </AbsoluteFill>
      </div>
    )
  }

  // ── cinematic ────────────────────────────────────────────────────────────────
  if (questionCardStyle === 'cinematic') {
    const textOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' })
    const barHeight = height * 0.14
    const barAppear = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          {audioNodes}
          {flashNode}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: barHeight, backgroundColor: '#000', opacity: barAppear }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: barHeight, backgroundColor: '#000', opacity: barAppear }} />
          <div style={{ position: 'absolute', left: '15%', right: '15%', top: barHeight + 16, height: 1, backgroundColor: accent, opacity: textOpacity * 0.5 }} />
          <h2 style={{
            fontFamily: `Georgia, 'Times New Roman', serif`, fontWeight: 400, fontSize: 58,
            color: accent, textAlign: 'center', lineHeight: 1.3, maxWidth: 900, margin: 0,
            opacity: textOpacity, transform: `scale(${interpolate(frame, [0, 25], [1.04, 1], { extrapolateRight: 'clamp' })})`,
            fontStyle: 'italic', letterSpacing: 1,
          }}>{question}</h2>
        </AbsoluteFill>
      </div>
    )
  }

  // fallback
  const appear = spring({ frame, fps, config: { damping: 22, stiffness: 70 } })
  return (
    <div style={wrapperStyle}>
      {bg}
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        {audioNodes}
        {flashNode}
        <h2 style={{ fontFamily: theme.fontFamily, fontWeight: theme.fontWeight, fontSize: 64, color: accent, textAlign: 'center', lineHeight: 1.1, maxWidth: 1000, margin: 0, opacity: appear }}>{question}</h2>
      </AbsoluteFill>
    </div>
  )
}
