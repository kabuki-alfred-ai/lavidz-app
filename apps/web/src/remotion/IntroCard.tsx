import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TransitionTheme, IntroSettings, SlideBgPattern, SlideTextAnimation, SlideDecorator } from './themeTypes'

interface Props {
  intro: IntroSettings
  theme: TransitionTheme
}

// ── Decorator layer ───────────────────────────────────────────────────────────

function SlideDecoratorLayer({ decorator, decoratorText, accentColor, fontFamily, frame, fps, durationInFrames, width, height }: {
  decorator: SlideDecorator
  decoratorText: string; accentColor: string; fontFamily: string
  frame: number; fps: number; durationInFrames: number; width: number; height: number
}) {
  if (decorator === 'ticker') {
    const totalScroll = width * 2
    const x = interpolate(frame, [0, durationInFrames], [0, -totalScroll], { extrapolateRight: 'clamp' })
    const tickerOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
    const label = decoratorText || '✦ LAVIDZ'
    const repeated = Array(8).fill(`  ✦  ${label}`).join('')
    const tickerTextColor = accentColor === '#FFFFFF' || accentColor === '#F5F0E8' || accentColor === '#FFD60A'
      ? '#000000'
      : '#FFFFFF'
    return (
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 52, backgroundColor: accentColor,
        overflow: 'hidden', display: 'flex', alignItems: 'center',
        opacity: tickerOpacity,
      }}>
        <div style={{
          position: 'absolute', whiteSpace: 'nowrap',
          transform: `translateX(${x}px)`,
          fontFamily, fontWeight: 700, fontSize: 18,
          color: tickerTextColor,
          letterSpacing: 3, textTransform: 'uppercase',
        }}>
          {repeated}
        </div>
      </div>
    )
  }
  if (decorator === 'frame-border') {
    const perim = (width + height) * 2
    const progress = interpolate(frame, [0, 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const strokeDashoffset = interpolate(progress, [0, 1], [perim, 0])
    const borderOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
    return (
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: borderOpacity }} viewBox={`0 0 ${width} ${height}`}>
        <rect x="24" y="24" width={width - 48} height={height - 48}
          stroke={accentColor} strokeWidth="5" fill="none"
          strokeDasharray={perim} strokeDashoffset={strokeDashoffset}
          strokeLinecap="square"
        />
      </svg>
    )
  }
  if (decorator === 'corner-label') {
    const s = spring({ frame: frame - 6, fps, config: { damping: 22, stiffness: 100 } })
    const tx = interpolate(s, [0, 1], [60, 0])
    return (
      <div style={{
        position: 'absolute', bottom: 64, right: 64,
        opacity: s, transform: `translateX(${tx}px)`,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
      }}>
        <div style={{ width: 40, height: 3, backgroundColor: accentColor }} />
        <p style={{
          fontFamily, fontSize: 22, fontWeight: 700, letterSpacing: 4,
          textTransform: 'uppercase', color: accentColor, margin: 0,
        }}>
          {decoratorText || '@handle'}
        </p>
      </div>
    )
  }
  return null
}

// ── Background pattern renderer ──────────────────────────────────────────────

function SlideBg({ bgColor, accentColor, pattern, frame, fps }: {
  bgColor: string; accentColor: string; pattern: SlideBgPattern; frame: number; fps: number
}) {
  const base: React.CSSProperties = {
    position: 'absolute', inset: 0,
  }

  if (pattern === 'dots') {
    return (
      <div style={{
        ...base,
        backgroundColor: bgColor,
        backgroundImage: `radial-gradient(circle, ${accentColor}33 1.5px, transparent 1.5px)`,
        backgroundSize: '48px 48px',
      }} />
    )
  }
  if (pattern === 'grid') {
    return (
      <div style={{
        ...base,
        backgroundColor: bgColor,
        backgroundImage: `linear-gradient(${accentColor}22 1px, transparent 1px), linear-gradient(90deg, ${accentColor}22 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
      }} />
    )
  }
  if (pattern === 'diagonal') {
    return (
      <div style={{
        ...base,
        backgroundColor: bgColor,
        backgroundImage: `repeating-linear-gradient(45deg, ${accentColor}18 0, ${accentColor}18 1px, transparent 0, transparent 50%)`,
        backgroundSize: '32px 32px',
      }} />
    )
  }
  if (pattern === 'radial') {
    return (
      <div style={{
        ...base,
        background: `radial-gradient(ellipse at 50% 50%, ${accentColor}44 0%, ${bgColor} 65%)`,
      }} />
    )
  }
  if (pattern === 'noise') {
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        <svg style={{ ...base, opacity: 0.08 }}>
          <filter id="noise-intro">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise-intro)" />
        </svg>
      </>
    )
  }
  if (pattern === 'confetti') {
    // Konbini-style: animated colored blocks scattered around
    const blocks = [
      { x: 8, y: 10, w: 120, h: 90, delay: 0, opacity: 1.0 },
      { x: 82, y: 6,  w: 90,  h: 120, delay: 3, opacity: 0.7 },
      { x: 5, y: 72,  w: 100, h: 80, delay: 5, opacity: 0.5 },
      { x: 78, y: 74, w: 140, h: 100, delay: 2, opacity: 0.8 },
      { x: 40, y: 3,  w: 80,  h: 60, delay: 7, opacity: 0.4 },
      { x: 50, y: 88, w: 110, h: 70, delay: 4, opacity: 0.6 },
    ]
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {blocks.map((b, i) => {
          const s = spring({ frame: frame - b.delay, fps: 30, config: { damping: 20, stiffness: 120 } })
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${b.x}%`, top: `${b.y}%`,
              width: b.w, height: b.h,
              backgroundColor: accentColor,
              opacity: b.opacity * s,
              transform: `scale(${s})`,
              transformOrigin: 'center',
              borderRadius: 4,
            }} />
          )
        })}
      </>
    )
  }
  if (pattern === 'stripes') {
    const NUM_STRIPES = 6
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {Array.from({ length: NUM_STRIPES }, (_, i) => {
          const s = spring({ frame: frame - i * 3, fps: 30, config: { damping: 20, stiffness: 100 } })
          return (
            <div key={i} style={{
              position: 'absolute', left: `${(i / NUM_STRIPES) * 100}%`, top: 0,
              width: `${100 / NUM_STRIPES}%`, height: `${s * 100}%`,
              backgroundColor: accentColor, opacity: 0.15 + (i % 2) * 0.1,
            }} />
          )
        })}
      </>
    )
  }
  if (pattern === 'scanlines') {
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        <div style={{
          ...base,
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 2px, ${accentColor}0A 2px, ${accentColor}0A 4px)`,
          backgroundPositionY: `${(frame * 0.4) % 4}px`,
        }} />
      </>
    )
  }
  if (pattern === 'gradient-sweep') {
    return (
      <div style={{
        ...base,
        background: `conic-gradient(from ${frame * 0.8}deg at 50% 50%, ${bgColor} 0%, ${accentColor}40 30%, ${bgColor} 60%, ${accentColor}20 90%, ${bgColor} 100%)`,
      }} />
    )
  }
  if (pattern === 'aurora') {
    const t = frame * 0.025
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        <div style={{
          ...base,
          background: `radial-gradient(ellipse 90% 70% at ${50 + Math.sin(t) * 22}% ${30 + Math.cos(t * 0.7) * 18}%, ${accentColor}50 0%, transparent 65%)`,
        }} />
        <div style={{
          ...base,
          background: `radial-gradient(ellipse 70% 90% at ${28 + Math.cos(t * 1.3) * 22}% ${65 + Math.sin(t * 0.9) * 18}%, ${accentColor}30 0%, transparent 60%)`,
        }} />
        <div style={{
          ...base,
          background: `radial-gradient(ellipse 60% 60% at ${72 + Math.sin(t * 0.8 + 1) * 18}% ${42 + Math.cos(t * 1.1) * 22}%, ${accentColor}20 0%, transparent 55%)`,
        }} />
      </>
    )
  }
  if (pattern === 'halftone') {
    const r = 3 + Math.sin(frame * 0.1) * 1.5
    const spacing = 26
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        <svg style={{ ...base, opacity: 0.22 }}>
          <defs>
            <pattern id="ht-intro" x="0" y="0" width={spacing} height={spacing} patternUnits="userSpaceOnUse">
              <circle cx={spacing / 2} cy={spacing / 2} r={r} fill={accentColor} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ht-intro)" />
        </svg>
      </>
    )
  }
  if (pattern === 'vhs') {
    const bands = Array.from({ length: 7 }, (_, i) => {
      const y = ((Math.abs(Math.sin(frame * 0.31 + i * 133.7)) * 100)) % 100
      const h = 2 + Math.abs(Math.sin(frame * 0.8 + i * 17)) * 5
      const op = Math.abs(Math.sin(frame * 2.1 + i * 3.3)) * 0.35
      return { y, h, op }
    })
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {bands.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${b.y}%`, height: b.h,
            backgroundColor: accentColor, opacity: b.op,
          }} />
        ))}
        <div style={{
          ...base,
          background: `linear-gradient(to bottom, ${accentColor}06 0%, transparent 15%, transparent 85%, ${accentColor}06 100%)`,
        }} />
      </>
    )
  }
    // solid
  return <div style={{ ...base, backgroundColor: bgColor }} />
}

// ── Text animations ───────────────────────────────────────────────────────────

function AnimatedText({ text, animation, frame, fps, textColor, fontFamily, fontWeight, fontSize }: {
  text: string; animation: SlideTextAnimation; frame: number; fps: number
  textColor: string; fontFamily: string; fontWeight: number; fontSize: number
}) {
  const baseStyle: React.CSSProperties = {
    fontFamily, fontWeight, fontSize,
    color: textColor,
    textAlign: 'center',
    lineHeight: 1.1,
    maxWidth: 1000,
    margin: 0,
  }

  if (animation === 'flash') {
    // Hard cut: instant appear at frame 2
    const opacity = frame >= 2 ? 1 : 0
    return <h1 style={{ ...baseStyle, opacity }}>{text}</h1>
  }

  if (animation === 'zoom-blast') {
    const s = spring({ frame, fps, config: { damping: 18, stiffness: 200 } })
    const scale = interpolate(s, [0, 1], [4, 1])
    const opacity = interpolate(frame, [0, 4], [0, 1], { extrapolateRight: 'clamp' })
    return <h1 style={{ ...baseStyle, opacity, transform: `scale(${scale})`, transformOrigin: 'center' }}>{text}</h1>
  }

  if (animation === 'typewriter') {
    const charsPerFrame = 3
    const visibleChars = Math.min(text.length, Math.floor(frame * charsPerFrame))
    const showCursor = frame < Math.ceil(text.length / charsPerFrame) + 8
    return (
      <h1 style={{ ...baseStyle }}>
        {text.slice(0, visibleChars)}
        {showCursor && <span style={{ opacity: Math.floor(frame / 6) % 2 === 0 ? 1 : 0 }}>|</span>}
      </h1>
    )
  }

  if (animation === 'word-stack') {
    const words = text.split(' ')
    return (
      <h1 style={{ ...baseStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 16px' }}>
        {words.map((word, i) => {
          const s = spring({ frame: frame - i * 4, fps, config: { damping: 22, stiffness: 120 } })
          const ty = interpolate(s, [0, 1], [60, 0])
          const dirs = [1, -1, 1, -1]
          const tx = interpolate(s, [0, 1], [dirs[i % 4] * 40, 0])
          return (
            <span key={i} style={{ opacity: s, transform: `translate(${tx}px, ${ty}px)`, display: 'inline-block' }}>
              {word}
            </span>
          )
        })}
      </h1>
    )
  }

  if (animation === 'glitch') {
    // RGB split glitch
    const glitchActive = frame % 12 < 3
    const offset = glitchActive ? 6 : 0
    return (
      <div style={{ position: 'relative' }}>
        <h1 style={{ ...baseStyle, position: 'absolute', color: '#ff0040', opacity: glitchActive ? 0.7 : 0, transform: `translate(-${offset}px, 0)`, mixBlendMode: 'screen' }}>{text}</h1>
        <h1 style={{ ...baseStyle, position: 'absolute', color: '#00ffcc', opacity: glitchActive ? 0.7 : 0, transform: `translate(${offset}px, 0)`, mixBlendMode: 'screen' }}>{text}</h1>
        <h1 style={{ ...baseStyle }}>{text}</h1>
      </div>
    )
  }

  if (animation === 'scramble') {
    const CHARS = '!@#$%^&*ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const progress = Math.min(1, frame * 0.07)
    const displayed = text.split('').map((char, i) => {
      if (char === ' ') return ' '
      const threshold = i / text.length
      if (progress > threshold) return char
      const seed = Math.abs(Math.sin(frame * 13.7 + i * 97.3))
      return CHARS[Math.floor(seed * CHARS.length)]
    }).join('')
    const opacity = Math.min(1, frame * 0.1)
    return <h1 style={{ ...baseStyle, opacity, letterSpacing: 2 }}>{displayed}</h1>
  }

  if (animation === 'letter-stack') {
    return (
      <h1 style={{ ...baseStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', letterSpacing: 2 }}>
        {text.split('').map((char, i) => {
          if (char === ' ') return <span key={i} style={{ display: 'inline-block', width: '0.4em' }} />
          const s = spring({ frame: frame - i * 2, fps, config: { damping: 28, stiffness: 300 } })
          return (
            <span key={i} style={{
              display: 'inline-block',
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
            }}>{char}</span>
          )
        })}
      </h1>
    )
  }

  if (animation === 'highlight') {
    const sweepProgress = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
    const textOpacity = interpolate(frame, [2, 18], [0, 1], { extrapolateRight: 'clamp' })
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {/* Highlight bar behind text */}
        <div style={{
          position: 'absolute', left: 0, top: '10%', height: '80%',
          width: `${sweepProgress * 100}%`,
          backgroundColor: textColor,
          opacity: 0.25,
        }} />
        <h1 style={{ ...baseStyle, opacity: textOpacity, position: 'relative' }}>{text}</h1>
      </div>
    )
  }

  if (animation === 'flip-3d') {
    const s = spring({ frame, fps, config: { damping: 20, stiffness: 160 } })
    const rotateY = interpolate(s, [0, 1], [90, 0])
    const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })
    return (
      <div style={{ perspective: 1200, opacity }}>
        <h1 style={{
          ...baseStyle,
          transform: `rotateY(${rotateY}deg)`,
          transformOrigin: 'center center',
        }}>{text}</h1>
      </div>
    )
  }

  if (animation === 'neon-flicker') {
    const flickerSeq = [0,1,0,0,1,0,1,1,0,1,0,1,1,1,1,1]
    const fi = Math.min(frame, flickerSeq.length - 1)
    const isOn = flickerSeq[fi] === 1
    const steadyPhase = Math.max(0, (frame - flickerSeq.length) / fps)
    const pulseGlow = 1 + Math.sin(steadyPhase * Math.PI * 2) * 0.15
    const opacity = isOn || frame >= flickerSeq.length ? 1 : 0
    const glowSize = (isOn ? 1 : 0.6) * pulseGlow
    const textShadow = `0 0 ${8 * glowSize}px ${textColor}, 0 0 ${24 * glowSize}px ${textColor}99, 0 0 ${60 * glowSize}px ${textColor}44`
    return <h1 style={{ ...baseStyle, opacity, textShadow }}>{text}</h1>
  }

  if (animation === 'blur-reveal') {
    const blurVal = interpolate(frame, [0, 22], [50, 0], { extrapolateRight: 'clamp' })
    const opacity = interpolate(frame, [0, 8], [0.2, 1], { extrapolateRight: 'clamp' })
    const scale = interpolate(frame, [0, 22], [1.06, 1], { extrapolateRight: 'clamp' })
    return (
      <h1 style={{
        ...baseStyle, opacity,
        filter: `blur(${blurVal}px)`,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
      }}>{text}</h1>
    )
  }

  if (animation === 'stamp') {
    const s = spring({ frame, fps, config: { damping: 8, stiffness: 320 } })
    const scale = interpolate(s, [0, 1], [2.8, 1])
    const opacity = frame >= 1 ? 1 : 0
    const impact = interpolate(frame, [3, 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div style={{
          position: 'absolute',
          inset: `-${impact * 24}px`,
          border: `${3 * impact}px solid ${textColor}`,
          opacity: impact * 0.5,
          borderRadius: 4,
          pointerEvents: 'none',
        }} />
        <h1 style={{
          ...baseStyle, opacity,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}>{text}</h1>
      </div>
    )
  }

  if (animation === 'wave') {
    return (
      <h1 style={{ ...baseStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
        {text.split('').map((char, i) => {
          if (char === ' ') return <span key={i} style={{ display: 'inline-block', width: '0.35em' }} />
          const entry = spring({ frame: frame - i * 1.8, fps, config: { damping: 22, stiffness: 120 } })
          const entryY = interpolate(entry, [0, 1], [40, 0])
          const waveY = Math.sin(frame * 0.14 + i * 0.55) * 10
          return (
            <span key={i} style={{
              display: 'inline-block',
              opacity: entry,
              transform: `translateY(${entryY + waveY}px)`,
            }}>{char}</span>
          )
        })}
      </h1>
    )
  }

  if (animation === 'cascade') {
    return (
      <h1 style={{ ...baseStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', letterSpacing: 1 }}>
        {text.split('').map((char, i) => {
          if (char === ' ') return <span key={i} style={{ display: 'inline-block', width: '0.35em' }} />
          const delay = i * 1.8
          const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 250 } })
          const ty = interpolate(s, [0, 1], [-180, 0])
          const rot = interpolate(s, [0, 1], [Math.sin(i * 37.3) * 18, 0])
          const opacity = interpolate(frame - delay, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          return (
            <span key={i} style={{
              display: 'inline-block', opacity,
              transform: `translateY(${ty}px) rotate(${rot}deg)`,
            }}>{char}</span>
          )
        })}
      </h1>
    )
  }

  if (animation === 'split-reveal') {
    const s = spring({ frame: frame - 2, fps, config: { damping: 22, stiffness: 90 } })
    const panelY = interpolate(s, [0, 1], [0, 120])
    const textOpacity = interpolate(s, [0.25, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    return (
      <div style={{ position: 'relative', display: 'inline-block', textAlign: 'center' }}>
        <h1 style={{ ...baseStyle, opacity: textOpacity }}>{text}</h1>
        <div style={{
          position: 'absolute', left: -16, right: -16, top: -48,
          height: 'calc(50% + 48px)',
          backgroundColor: textColor,
          transform: `translateY(-${panelY}%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', left: -16, right: -16, bottom: -48,
          height: 'calc(50% + 48px)',
          backgroundColor: textColor,
          transform: `translateY(${panelY}%)`,
          pointerEvents: 'none',
        }} />
      </div>
    )
  }

    // spring-up (default)
  const s = spring({ frame, fps, config: { damping: 22, stiffness: 70 } })
  const ty = interpolate(s, [0, 1], [50, 0])
  return <h1 style={{ ...baseStyle, opacity: s, transform: `translateY(${ty}px)` }}>{text}</h1>
}

// ── Flash overlay (for 'flash' animation) ────────────────────────────────────

function FlashOverlay({ frame }: { frame: number }) {
  const opacity = interpolate(frame, [0, 3], [1, 0], { extrapolateRight: 'clamp' })
  if (opacity === 0) return null
  return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#FFFFFF', opacity }} />
}

// ── Main component ────────────────────────────────────────────────────────────

export function IntroCard({ intro, theme }: Props) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames, width, height } = useVideoConfig()

  const bgColor = intro.bgColor || theme.backgroundColor
  const accentColor = intro.accentColor || theme.textColor
  const fontFamily = intro.fontFamily || theme.fontFamily
  const fontWeight = intro.fontWeight ?? theme.fontWeight
  const pattern: SlideBgPattern = intro.bgPattern || 'solid'
  const animation: SlideTextAnimation = intro.textAnimation || 'spring-up'
  const textSize = intro.textSize || 72
  const logoSize = intro.logoSize || 64
  const decorator = intro.decorator || 'none'
  const decoratorText = intro.decoratorText || ''

  const appear = spring({ frame, fps, config: { damping: 22, stiffness: 70 } })

  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <SlideBg bgColor={bgColor} accentColor={accentColor} pattern={pattern} frame={frame} fps={fps} />

      {animation === 'flash' && <FlashOverlay frame={frame} />}

      <div style={{
        position: 'absolute', inset: decorator === 'ticker' ? '0 0 52px 0' : 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 32, padding: 80,
      }}>
        {intro.logoUrl && (
          <Img
            src={intro.logoUrl}
            style={{
              height: logoSize, objectFit: 'contain',
              opacity: appear,
              transform: `translateY(${interpolate(appear, [0, 1], [50, 0])}px)`,
            }}
          />
        )}
        {intro.hookText && (
          <AnimatedText
            text={intro.hookText} animation={animation} frame={frame} fps={fps}
            textColor={accentColor} fontFamily={fontFamily}
            fontWeight={fontWeight} fontSize={textSize}
          />
        )}
      </div>

      <SlideDecoratorLayer
        decorator={decorator} decoratorText={decoratorText}
        accentColor={accentColor} fontFamily={fontFamily}
        frame={frame} fps={fps} durationInFrames={durationInFrames}
        width={width} height={height}
      />
    </AbsoluteFill>
  )
}
