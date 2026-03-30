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
  colors?: string[]
}

// ── Color helpers ──────────────────────────────────────────────────────────────
function contrastColor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#0a0a0a' : '#ffffff'
}
function toRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

const DEFAULT_PALETTE = ['#FF2D55', '#FFD60A', '#30D158', '#0A84FF', '#FF6B35', '#BF5AF2']

// ── Background pattern ────────────────────────────────────────────────────────

function CardBg({ bgColor, accentColor, pattern, frame, fps, width, height }: {
  bgColor: string; accentColor: string; pattern: SlideBgPattern; frame: number; fps: number; width: number; height: number
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

  // ── vhs ─────────────────────────────────────────────────────────────────────
  // Rendu cassette professionnel : aberration chromatique + bandes de tracking +
  // grain tape + scanlines + color bleed + vignette
  if (pattern === 'vhs') {
    const t = frame * 0.018

    // Aberration chromatique : offset oscillant + pics périodiques de glitch
    const glitchPulse = Math.abs(Math.sin(frame * 0.09)) > 0.92
      ? (Math.sin(frame * 11.3) * 8)
      : 0
    const caX = 2.2 + Math.sin(t * 0.61) * 1.1 + glitchPulse

    // Bandes de tracking (tape head error) — déplacement horizontal
    const tracking = [
      { y: 4  + Math.sin(t * 0.57) * 3,  h: 2.8, shift: Math.sin(t * 4.1 + 0.5) * 14 + glitchPulse * 1.4, op: 0.18 + Math.abs(Math.sin(t * 1.2)) * 0.22 },
      { y: 91 + Math.cos(t * 0.44) * 3,  h: 2.0, shift: Math.cos(t * 3.7 + 1.8) * 10 + glitchPulse * 0.8, op: 0.14 + Math.abs(Math.cos(t * 0.9)) * 0.18 },
    ]

    // Rolling brightness band (signal instability)
    const rollY = ((frame * 0.22) % 120) - 10

    // Head-switching noise bar at bottom (VHS signature artifact)
    const headBarY = height - (10 + Math.sin(t * 1.9) * 3)

    // Grain noise seed change every 2 frames for film grain feel
    const noiseSeed = Math.floor(frame / 2) % 60

    return (
      <>
        {/* 1. Base */}
        <div style={{ ...base, backgroundColor: bgColor }} />

        {/* 2. Aberration chromatique R canal — edge left bleed */}
        <div style={{
          ...base,
          background: `linear-gradient(to right, rgba(255,30,60,0.13) 0%, rgba(255,30,60,0.04) 18%, transparent 38%)`,
          transform: `translateX(-${caX}px)`,
          mixBlendMode: 'screen',
        }} />
        {/* B canal — edge right bleed */}
        <div style={{
          ...base,
          background: `linear-gradient(to left, rgba(30,80,255,0.13) 0%, rgba(30,80,255,0.04) 18%, transparent 38%)`,
          transform: `translateX(${caX}px)`,
          mixBlendMode: 'screen',
        }} />
        {/* G canal — léger décalage vertical */}
        <div style={{
          ...base,
          background: `linear-gradient(to bottom, rgba(30,255,120,0.06) 0%, transparent 22%, transparent 78%, rgba(30,255,120,0.06) 100%)`,
          transform: `translateY(${Math.sin(t * 0.38) * 1.2}px)`,
          mixBlendMode: 'screen',
        }} />

        {/* 3. Tape grain via SVG turbulence */}
        <svg style={{ ...base, opacity: 0.055 }} xmlns="http://www.w3.org/2000/svg">
          <filter id="vhs-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.80 0.42" numOctaves="4" seed={noiseSeed} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#vhs-grain)" />
        </svg>

        {/* 4. Scanlines (entrelacement) */}
        <div style={{
          ...base,
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)`,
          backgroundPositionY: `${(frame * 0.15) % 4}px`,
        }} />

        {/* 5. Rolling brightness band */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: `${rollY}%`, height: '12%',
          background: `linear-gradient(to bottom, transparent, ${toRgba(accentColor, 0.07)}, transparent)`,
          mixBlendMode: 'overlay',
        }} />

        {/* 6. Bandes de tracking avec décalage X */}
        {tracking.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: -20, right: -20,
            top: `${b.y}%`, height: b.h,
            backgroundColor: accentColor,
            opacity: b.op,
            transform: `translateX(${b.shift}px)`,
          }} />
        ))}

        {/* 7. Head-switching bar (ligne noire/blanche bas de cadre) */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: headBarY, height: 6,
          background: `linear-gradient(to bottom, transparent, ${toRgba(accentColor, 0.55)}, transparent)`,
          mixBlendMode: 'overlay',
        }} />

        {/* 8. Color bleed accentColor sur bords verticaux */}
        <div style={{
          ...base,
          background: `linear-gradient(to right, ${toRgba(accentColor, 0.06)} 0%, transparent 12%, transparent 88%, ${toRgba(accentColor, 0.04)} 100%)`,
        }} />

        {/* 9. Vignette sombre sur les bords */}
        <div style={{
          ...base,
          background: `radial-gradient(ellipse 82% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.52) 100%)`,
        }} />

        {/* 10. Scrim central — texte lisible */}
        <div style={{
          ...base,
          background: `radial-gradient(ellipse 58% 54% at 50% 50%, ${toRgba(bgColor, 0.80)} 0%, ${toRgba(bgColor, 0.35)} 70%, transparent 100%)`,
          pointerEvents: 'none',
        }} />
      </>
    )
  }

  // ── plasma ─────────────────────────────────────────────────────────────────
  // 2025 gradient mesh : blobs de couleur aux coins, centre protégé — Apple / Linear style
  if (pattern === 'plasma') {
    const t = frame * 0.014
    // Blobs ancrés aux 4 coins, légèrement mobiles
    const corners = [
      { bx: -8  + Math.sin(t) * 5,           by: -8  + Math.cos(t * 0.78) * 4 },
      { bx: 108 + Math.cos(t * 1.07) * 5,    by: -5  + Math.sin(t * 0.66) * 4 },
      { bx: -5  + Math.cos(t * 0.91 + 1.1) * 4, by: 108 + Math.sin(t * 0.57) * 4 },
      { bx: 108 + Math.sin(t * 0.73 + 2.0) * 5, by: 105 + Math.cos(t * 1.14) * 4 },
    ]
    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {corners.map((c, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${c.bx - 38}%`, top: `${c.by - 38}%`,
            width: '76%', height: '76%',
            background: `radial-gradient(circle, ${toRgba(accentColor, 0.50)} 0%, transparent 62%)`,
            pointerEvents: 'none',
          }} />
        ))}
        {/* Scrim central fort — texte toujours lisible */}
        <div style={{ ...base, background: `radial-gradient(ellipse 56% 64% at 50% 50%, ${toRgba(bgColor, 0.88)} 15%, ${toRgba(bgColor, 0.50)} 65%, transparent 100%)`, pointerEvents: 'none' }} />
      </>
    )
  }

  // ── synthwave ───────────────────────────────────────────────────────────────
  // Grille perspective néon qui avance — épurée, horizon lumineux
  if (pattern === 'synthwave') {
    const vpX = width / 2
    const vpY = height * 0.44
    const groundH = height - vpY
    const N_H = 9
    const N_V = 14
    const scrollT = (frame * 0.008) % (1 / N_H)

    const hLines: { y: number; op: number }[] = []
    for (let i = 0; i < N_H; i++) {
      const t = ((i / N_H) + scrollT) % 1
      hLines.push({ y: vpY + t * t * groundH, op: 0.15 + t * 0.28 })
    }

    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {/* Dégradé ciel discret */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: vpY + 10, background: `linear-gradient(to bottom, ${toRgba(accentColor, 0.07)} 0%, transparent 100%)` }} />
        {/* Horizon */}
        <div style={{ position: 'absolute', left: '10%', right: '10%', top: vpY - 1, height: 2, backgroundColor: accentColor, opacity: 0.55, boxShadow: `0 0 16px 3px ${toRgba(accentColor, 0.45)}` }} />
        {/* Grille SVG dans la zone sol uniquement */}
        <svg style={{ position: 'absolute', left: 0, top: vpY, width, height: groundH }} viewBox={`0 0 ${width} ${groundH}`}>
          {Array.from({ length: N_V + 1 }, (_, j) => (
            <line key={`v${j}`} x1={vpX} y1={0} x2={(j / N_V) * width} y2={groundH}
              stroke={accentColor} strokeWidth={0.7} opacity={j % 3 === 0 ? 0.28 : 0.11} />
          ))}
          {hLines.map((l, i) => (
            <line key={`h${i}`} x1={0} y1={l.y - vpY} x2={width} y2={l.y - vpY}
              stroke={accentColor} strokeWidth={0.7} opacity={l.op} />
          ))}
        </svg>
        {/* Scrim centre : zone texte propre */}
        <div style={{ ...base, background: `radial-gradient(ellipse 60% 52% at 50% 44%, ${toRgba(bgColor, 0.86)} 0%, transparent 100%)`, pointerEvents: 'none' }} />
      </>
    )
  }

  // ── burst ───────────────────────────────────────────────────────────────────
  // Géométrie de précision : corner marks + anneaux rotatifs tirets — motion design broadcast
  if (pattern === 'burst') {
    const cx = width / 2
    const cy = height / 2
    const minDim = Math.min(width, height)
    const dashOff = frame * 1.8
    const pulse = 0.92 + Math.sin(frame * 0.07) * 0.08

    const rings = [
      { r: minDim * 0.40 * pulse,  sw: 1.2, op: 0.22, dd: '14 22', spd:  1.0 },
      { r: minDim * 0.56,          sw: 0.6, op: 0.14, dd: '5 14',  spd: -0.7 },
      { r: minDim * 0.26 * pulse,  sw: 1.8, op: 0.28, dd: '10 16', spd:  1.4 },
    ]

    const cornerLen = minDim * 0.075
    const pad = 24
    const cornerDefs = [
      { x: pad,         y: pad,          sx:  1, sy:  1 },
      { x: width - pad, y: pad,          sx: -1, sy:  1 },
      { x: pad,         y: height - pad, sx:  1, sy: -1 },
      { x: width - pad, y: height - pad, sx: -1, sy: -1 },
    ]

    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        <svg style={{ position: 'absolute', inset: 0 }} viewBox={`0 0 ${width} ${height}`}>
          {/* Anneaux en tirets rotatifs */}
          {rings.map((r, i) => (
            <circle key={i} cx={cx} cy={cy} r={r.r}
              fill="none" stroke={accentColor} strokeWidth={r.sw}
              strokeDasharray={r.dd}
              strokeDashoffset={dashOff * r.spd * 18}
              opacity={r.op} />
          ))}
          {/* Corner L-brackets */}
          {cornerDefs.map((c, i) => (
            <g key={i} opacity={0.38}>
              <line x1={c.x} y1={c.y} x2={c.x + c.sx * cornerLen} y2={c.y}
                stroke={accentColor} strokeWidth={1.8} strokeLinecap="square" />
              <line x1={c.x} y1={c.y} x2={c.x} y2={c.y + c.sy * cornerLen}
                stroke={accentColor} strokeWidth={1.8} strokeLinecap="square" />
            </g>
          ))}
          {/* Point central pulsant */}
          <circle cx={cx} cy={cy} r={3.5 + Math.sin(frame * 0.08) * 1.5}
            fill={accentColor} opacity={0.32} />
        </svg>
        {/* Scrim centre */}
        <div style={{ ...base, background: `radial-gradient(ellipse 50% 58% at 50% 50%, ${toRgba(bgColor, 0.80)} 0%, transparent 100%)`, pointerEvents: 'none' }} />
      </>
    )
  }

  // ── liquid ──────────────────────────────────────────────────────────────────
  // Ink blob : 2 grandes formes organiques filtrées aux coins opposés
  if (pattern === 'liquid') {
    const t = frame * 0.013
    const blobAx = (-0.06 + Math.sin(t) * 0.04) * width
    const blobAy = (0.78  + Math.cos(t * 0.82) * 0.05) * height
    const blobBx = (1.05  + Math.cos(t * 0.69 + 1.2) * 0.04) * width
    const blobBy = (0.08  + Math.sin(t * 1.15) * 0.05) * height
    const rxA = (0.48 + Math.sin(t * 1.08) * 0.04) * width
    const ryA = (0.40 + Math.cos(t * 0.93) * 0.04) * height
    const rxB = (0.36 + Math.cos(t * 0.77) * 0.03) * width
    const ryB = (0.38 + Math.sin(t * 1.01) * 0.04) * height

    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        <svg style={{ position: 'absolute', inset: 0, overflow: 'visible' }} viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
          <defs>
            <filter id="goo-qc" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="44" result="blur" />
              <feColorMatrix in="blur" mode="matrix" type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -6" />
            </filter>
          </defs>
          <g filter="url(#goo-qc)" opacity={0.42}>
            <ellipse cx={blobAx} cy={blobAy} rx={rxA} ry={ryA} fill={accentColor} />
            <ellipse cx={blobBx} cy={blobBy} rx={rxB} ry={ryB} fill={accentColor} opacity={0.75} />
          </g>
        </svg>
        {/* Scrim fort centre */}
        <div style={{ ...base, background: `radial-gradient(ellipse 62% 68% at 50% 50%, ${toRgba(bgColor, 0.90)} 0%, ${toRgba(bgColor, 0.55)} 70%, transparent 100%)`, pointerEvents: 'none' }} />
      </>
    )
  }

  // ── eq ──────────────────────────────────────────────────────────────────────
  // Spectre audio minimaliste : fines barres basses + hautes, zone texte libre
  if (pattern === 'eq') {
    const N = 38
    const barW = width / N
    const maxH = height * 0.28 // max 28% — reste hors de la zone texte centrale

    const bars = Array.from({ length: N }, (_, i) => Math.max(0.03,
      0.07 + (Math.sin(i * 1.28) * 0.5 + 0.5) * 0.24
      + Math.sin(frame * 0.062 + i * 0.54) * 0.19
      + Math.sin(frame * 0.108 + i * 0.91) * 0.10
    ))

    return (
      <>
        <div style={{ ...base, backgroundColor: bgColor }} />
        {/* Barres basses */}
        {bars.map((h, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: i * barW + 1, bottom: 0,
            width: Math.max(1, barW - 2),
            height: h * maxH,
            backgroundColor: accentColor,
            opacity: 0.10 + h * 0.20,
          }} />
        ))}
        {/* Reflet haut — encore plus discret */}
        {bars.map((h, i) => (
          <div key={`t${i}`} style={{
            position: 'absolute',
            left: i * barW + 1, top: 0,
            width: Math.max(1, barW - 2),
            height: h * maxH * 0.45,
            backgroundColor: accentColor,
            opacity: 0.05 + h * 0.07,
          }} />
        ))}
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
  colors,
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

  const bg = <CardBg bgColor={bgColor} accentColor={accent} pattern={bgPattern} frame={frame} fps={fps} width={width} height={height} />

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
            fontFamily: theme.fontFamily, fontWeight: theme.fontWeight, fontSize: 58,
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
            fontFamily: theme.fontFamily, fontWeight: theme.fontWeight, fontSize: 58,
            color: accent, textAlign: 'center', lineHeight: 1.3, maxWidth: 900, margin: 0,
            opacity: textOpacity, transform: `scale(${interpolate(frame, [0, 25], [1.04, 1], { extrapolateRight: 'clamp' })})`,
            fontStyle: 'italic', letterSpacing: 1,
          }}>{question}</h2>
        </AbsoluteFill>
      </div>
    )
  }

  // ── pop-art ──────────────────────────────────────────────────────────────────
  // Konbini-style: colorful word pills, smooth staggered entry
  if (questionCardStyle === 'pop-art') {
    const words = question.split(' ')
    const palette = colors?.length ? colors : DEFAULT_PALETTE
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          {audioNodes}
          {flashNode}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '14px 16px', maxWidth: 1100 }}>
            {words.map((word, i) => {
              const s = spring({ frame: frame - i * 8, fps, config: { damping: 22, stiffness: 130 } })
              const color = palette[i % palette.length]
              const textCol = contrastColor(color)
              const rotation = ((i % 3) - 1) * 1.5
              return (
                <span key={i} style={{
                  fontFamily: theme.fontFamily,
                  fontWeight: theme.fontWeight,
                  fontSize: i === 0 ? 88 : 74,
                  backgroundColor: color,
                  color: textCol,
                  padding: '6px 24px',
                  borderRadius: 6,
                  display: 'inline-block',
                  lineHeight: 1.05,
                  boxShadow: '4px 6px 0px rgba(0,0,0,0.25)',
                  opacity: s,
                  transform: `scale(${interpolate(s, [0, 1], [0.7, 1])}) rotate(${rotation}deg) translateY(${interpolate(s, [0, 1], [36, 0])}px)`,
                }}>{word}</span>
              )
            })}
          </div>
        </AbsoluteFill>
      </div>
    )
  }

  // ── word-slam ────────────────────────────────────────────────────────────────
  // Each word slams in from alternating sides with colored stripe
  if (questionCardStyle === 'word-slam') {
    const words = question.split(' ')
    const palette = colors?.length ? colors : DEFAULT_PALETTE
    const n = words.length
    const fontSize = n <= 4 ? 78 : n <= 6 ? 62 : n <= 9 ? 50 : 40
    const padV = n <= 4 ? 8 : n <= 6 ? 6 : 4
    const padH = n <= 4 ? 40 : n <= 6 ? 28 : 18
    const gap = n <= 4 ? 6 : n <= 6 ? 4 : 3
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          justifyContent: 'center', padding: `${Math.max(16, 40 - n * 2)}px 0`, gap,
        }}>
          {audioNodes}
          {flashNode}
          {words.map((word, i) => {
            const s = spring({ frame: frame - i * 9, fps, config: { damping: 24, stiffness: 160 } })
            const fromLeft = i % 2 === 0
            const color = palette[i % palette.length]
            const textCol = contrastColor(color)
            const tx = interpolate(s, [0, 1], [fromLeft ? -width * 0.5 : width * 0.5, 0])
            return (
              <div key={i} style={{
                width: '100%',
                display: 'flex',
                justifyContent: fromLeft ? 'flex-start' : 'flex-end',
                opacity: s,
                transform: `translateX(${tx}px)`,
              }}>
                <div style={{
                  backgroundColor: color,
                  padding: `${padV}px ${padH}px`,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}>
                  <span style={{
                    fontFamily: theme.fontFamily,
                    fontWeight: theme.fontWeight,
                    fontSize,
                    color: textCol,
                    textTransform: 'uppercase',
                    letterSpacing: -1,
                    lineHeight: 1.0,
                  }}>{word}</span>
                </div>
              </div>
            )
          })}
        </AbsoluteFill>
      </div>
    )
  }

  // ── kinetic ──────────────────────────────────────────────────────────────────
  // Words zoom from 3.5x → 1x staggered ultra-fast, every 3rd word gets a color pill
  if (questionCardStyle === 'kinetic') {
    const words = question.split(' ')
    const palette = colors?.length ? colors : DEFAULT_PALETTE
    return (
      <div style={wrapperStyle}>
        {bg}
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          {audioNodes}
          {flashNode}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 22px', maxWidth: 1100 }}>
            {words.map((word, i) => {
              const s = spring({ frame: frame - i * 7, fps, config: { damping: 24, stiffness: 160 } })
              const useColor = i % 3 === 0
              const color = palette[(i / 3 | 0) % palette.length]
              const textCol = useColor ? contrastColor(color) : accent
              return (
                <span key={i} style={{
                  fontFamily: theme.fontFamily,
                  fontWeight: theme.fontWeight,
                  fontSize: 82,
                  color: textCol,
                  backgroundColor: useColor ? color : 'transparent',
                  padding: useColor ? '0 16px' : '0',
                  display: 'inline-block',
                  lineHeight: 1.05,
                  opacity: s,
                  transform: `scale(${interpolate(s, [0, 1], [1.6, 1])})`,
                  transformOrigin: 'center',
                }}>{word}</span>
              )
            })}
          </div>
        </AbsoluteFill>
      </div>
    )
  }

  // ── neon-pulse ───────────────────────────────────────────────────────────────
  // Each word glows with its own neon color, pulsing glow animation + scanlines
  if (questionCardStyle === 'neon-pulse') {
    const words = question.split(' ')
    const neonPalette = colors?.length ? colors : ['#00FF88', '#00D4FF', '#FF2D55', '#FFD60A', '#BF5AF2']
    const pulse = 0.65 + Math.sin(frame * 0.17) * 0.35
    return (
      <div style={wrapperStyle}>
        {bg}
        {/* Scanline overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.10) 3px, rgba(0,0,0,0.10) 4px)`,
          pointerEvents: 'none',
        }} />
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          {audioNodes}
          {flashNode}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 26px', maxWidth: 1100 }}>
            {words.map((word, i) => {
              const s = spring({ frame: frame - i * 9, fps, config: { damping: 26, stiffness: 100 } })
              const neonColor = neonPalette[i % neonPalette.length]
              const glowIntensity = pulse * 0.8
              return (
                <span key={i} style={{
                  fontFamily: theme.fontFamily,
                  fontWeight: theme.fontWeight,
                  fontSize: 76,
                  color: neonColor,
                  display: 'inline-block',
                  lineHeight: 1.1,
                  opacity: s,
                  transform: `translateY(${interpolate(s, [0, 1], [28, 0])}px) scale(${interpolate(s, [0, 1], [0.92, 1])})`,
                  textShadow: [
                    `0 0 ${16 * glowIntensity}px ${neonColor}`,
                    `0 0 ${44 * glowIntensity}px ${neonColor}99`,
                    `0 0 ${80 * glowIntensity}px ${neonColor}44`,
                    `0 0 ${120 * glowIntensity}px ${neonColor}22`,
                  ].join(', '),
                }}>{word}</span>
              )
            })}
          </div>
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
