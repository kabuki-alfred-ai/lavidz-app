import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

// Netflix-inspired end card — Lavidz + Kabuki Team

export function EndCard() {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // ── Flash burst (frame 0–10) ──────────────────────────────────────────────
  const flashOpacity = interpolate(frame, [0, 4, 10], [0, 0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // ── Lavidz: scale slam (Netflix-style punch in) ───────────────────────────
  const lavidzSpring = spring({ frame, fps, config: { damping: 11, stiffness: 180, mass: 0.7 } })
  const lavidzScale = interpolate(lavidzSpring, [0, 1], [4.5, 1])
  const lavidzOpacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })

  // ── Orange dot: slight delay + spin ──────────────────────────────────────
  const dotSpring = spring({ frame: Math.max(0, frame - 4), fps, config: { damping: 12, stiffness: 200 } })
  const dotScale = interpolate(dotSpring, [0, 1], [0, 1])
  const dotRotate = interpolate(frame, [4, 20], [90, 0], { extrapolateRight: 'clamp' })

  // ── Shine sweep across logo (frame 12–28) ────────────────────────────────
  const shineX = interpolate(frame, [12, 28], [-120, 520], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const shineOpacity = interpolate(frame, [12, 14, 25, 28], [0, 0.6, 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // ── Separator line draw (frame 20–38) ────────────────────────────────────
  const lineWidth = interpolate(frame, [20, 38], [0, 160], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const lineOpacity = interpolate(frame, [20, 26], [0, 1], { extrapolateRight: 'clamp' })

  // ── Kabuki SVG logo: scale + fade (frame 32–52) ──────────────────────────
  const kabukiSvgSpring = spring({ frame: Math.max(0, frame - 32), fps, config: { damping: 18, stiffness: 140 } })
  const kabukiSvgScale = interpolate(kabukiSvgSpring, [0, 1], [0.2, 1])
  const kabukiSvgOpacity = interpolate(frame, [32, 44], [0, 1], { extrapolateRight: 'clamp' })

  // ── "Kabuki Team" text: slide up (frame 44–62) ───────────────────────────
  const kabukiTextSpring = spring({ frame: Math.max(0, frame - 44), fps, config: { damping: 20, stiffness: 100 } })
  const kabukiTextY = interpolate(kabukiTextSpring, [0, 1], [30, 0])
  const kabukiTextOpacity = interpolate(frame, [44, 58], [0, 1], { extrapolateRight: 'clamp' })

  // ── "Powered by" label ───────────────────────────────────────────────────
  const poweredOpacity = interpolate(frame, [50, 64], [0, 0.45], { extrapolateRight: 'clamp' })

  // ── Glow pulse on Lavidz (after frame 60, subtle) ────────────────────────
  const glowPulse = frame > 60
    ? interpolate(Math.sin(((frame - 60) / fps) * Math.PI * 1.4), [-1, 1], [0.85, 1])
    : 1

  // ── Global fade out ───────────────────────────────────────────────────────
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ background: '#000000', overflow: 'hidden' }}>
      <Audio src={staticFile('endpart.wav')} volume={1} />
      {/* Flash burst */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#ffffff',
          opacity: flashOpacity,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
          opacity: fadeOut,
          overflow: 'hidden',
        }}
      >
        {/* ── Lavidz logo ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            position: 'relative',
            opacity: lavidzOpacity,
            transform: `scale(${lavidzScale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Standardized liquid logo morph icon — EXTRA ENLARGED */}
          <div
            style={{
              position: 'relative',
              width: 100,
              height: 100,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${dotScale})`,
              opacity: dotScale,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                background: '#FF4D1C',
                borderRadius: `${interpolate(
                  Math.sin((frame / fps / 4) * Math.PI * 2),
                  [-1, 1],
                  [0, 50]
                )}%`,
                transform: `rotate(${interpolate(
                  frame % (fps * 4),
                  [0, fps * 4],
                  [0, 360]
                )}deg) scale(${interpolate(
                  Math.sin((frame / fps / 4) * Math.PI * 2),
                  [-1, 1],
                  [1, 0.85]
                )})`,
                boxShadow: '0 0 50px rgba(255,77,28,0.5)',
              }}
            />
          </div>

          {/* LAVIDZ text — REDUCED */}
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <span
              style={{
                fontFamily: 'sans-serif',
                fontWeight: 900,
                fontSize: 64,
                color: '#FFFFFF',
                letterSpacing: -2,
                textTransform: 'uppercase',
                opacity: glowPulse,
                display: 'block',
                lineHeight: 1,
              }}
            >
              LAVIDZ
            </span>

            {/* Shine sweep */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: shineX,
                width: 60,
                background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                opacity: shineOpacity,
                transform: 'skewX(-15deg)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* ── Separator ───────────────────────────────────────────── */}
        <div
          style={{
            width: lineWidth,
            height: 1,
            background: 'rgba(255,255,255,0.2)',
            opacity: lineOpacity,
            display: 'none', // Hidden to make more space for bottom Kabuki
          }}
        />
      </div>

      {/* ── Kabuki section — MOVED TO BOTTOM ──────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          opacity: fadeOut * 0.4, // Reduced overall opacity
        }}
      >
        {/* SVG logo + Kabuki text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transform: `scale(${kabukiSvgScale * 0.8})`, // Slightly smaller
            opacity: kabukiSvgOpacity,
          }}
        >
          {/* Kabuki SVG icon */}
          <svg
            viewBox="0 0 32 32"
            style={{ height: 32, width: 32, flexShrink: 0 }}
            aria-hidden="true"
          >
            <defs>
              <path
                id="ec-kp"
                d="M3.25 26v.75H7c1.305 0 2.384-.21 3.346-.627.96-.415 1.763-1.02 2.536-1.752.695-.657 1.39-1.443 2.152-2.306l.233-.263c.864-.975 1.843-2.068 3.071-3.266 1.209-1.18 2.881-1.786 4.621-1.786h5.791V5.25H25c-1.305 0-2.384.21-3.346.627-.96.415-1.763 1.02-2.536 1.751-.695.658-1.39 1.444-2.152 2.307l-.233.263c-.864.975-1.843 2.068-3.071 3.266-1.209 1.18-2.881 1.786-4.621 1.786H3.25V26Z"
              />
              <clipPath id="ec-kc">
                <use href="#ec-kp" />
              </clipPath>
            </defs>
            <rect clipPath="url(#ec-kc)" fill="#FF4D1C" width="32" height="32" />
            <use href="#ec-kp" fill="none" stroke="white" strokeWidth="1.5" />
          </svg>

          <span
            style={{
              fontFamily: 'sans-serif',
              fontWeight: 800,
              fontSize: 32,
              color: '#FFFFFF',
              letterSpacing: 1,
            }}
          >
            Kabuki
          </span>
        </div>

        {/* "Team" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: kabukiTextOpacity,
            transform: `translateY(${kabukiTextY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: `rgba(255,255,255,${poweredOpacity})`,
              textTransform: 'uppercase',
              letterSpacing: '0.28em',
            }}
          >
            Team
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}
