import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface ColdOpenProps {
  videoUrl: string
  startInSeconds: number
  hookPhrase: string
  swooshEnabled: boolean
  textColor?: string
  highlightColor?: string
  fontFamily?: string
  fontSize?: number
  textPosition?: 'bottom' | 'center' | 'top'
  videoStyle?: 'bw' | 'desaturated' | 'color' | 'raw'
}

/** Reveal words one-by-one, each with a spring pop */
function WordByWord({
  phrase,
  fps,
  textColor = '#FFFFFF',
  highlightColor = '#FFD60A',
  fontFamily = "Impact, 'Arial Narrow', sans-serif",
  fontSize = 72,
}: {
  phrase: string
  fps: number
  textColor?: string
  highlightColor?: string
  fontFamily?: string
  fontSize?: number
}) {
  const frame = useCurrentFrame()
  const words = phrase.split(' ')

  // Each word gets ~6 frames to appear, last word stays highlighted
  const FRAMES_PER_WORD = 7

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0px 12px',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {words.map((word, i) => {
        const wordFrame = frame - i * FRAMES_PER_WORD
        const isLast = i === words.length - 1

        // Word only appears after its start frame
        if (wordFrame < 0) return null

        const scale = spring({
          frame: wordFrame,
          fps,
          from: 0,
          to: 1,
          config: { damping: 8, mass: 0.5, stiffness: 300 },
        })

        const rotate = interpolate(wordFrame, [0, 4, 8], [8, -3, 0], {
          extrapolateRight: 'clamp',
        })

        const isHighlighted = isLast || (words.length <= 3 && i === Math.floor(words.length / 2))

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `scale(${scale}) rotate(${rotate}deg)`,
              transformOrigin: 'center bottom',
              fontFamily,
              fontSize,
              fontWeight: 900,
              lineHeight: 1.1,
              textTransform: 'uppercase',
              letterSpacing: 2,
              color: isHighlighted ? highlightColor : textColor,
              // Thick black stroke for readability on any background
              WebkitTextStroke: '3px #000000',
              textShadow: isHighlighted
                ? `0 0 40px ${highlightColor}99, 0 4px 16px rgba(0,0,0,0.9)`
                : '0 4px 16px rgba(0,0,0,0.9)',
              margin: '0 4px 8px',
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

const VIDEO_STYLE_FILTER: Record<string, string> = {
  bw:          'saturate(0) contrast(1.4) brightness(0.75)',
  desaturated: 'saturate(0.3) contrast(1.3) brightness(0.75)',
  color:       'saturate(1.1) contrast(1.1) brightness(0.85)',
  raw:         'none',
}

const TEXT_POSITION_STYLE: Record<string, React.CSSProperties> = {
  bottom: { bottom: 80, left: 40, right: 40 },
  center: { top: '50%', left: 40, right: 40, transform: 'translateY(-50%)' },
  top:    { top: 80,    left: 40, right: 40 },
}

export function ColdOpen({
  videoUrl,
  startInSeconds,
  hookPhrase,
  swooshEnabled,
  textColor = '#FFFFFF',
  highlightColor = '#FFD60A',
  fontFamily = "Impact, 'Arial Narrow', sans-serif",
  fontSize = 72,
  textPosition = 'bottom',
  videoStyle = 'desaturated',
}: ColdOpenProps) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const startFromFrame = Math.round(startInSeconds * fps)

  // Aggressive spring zoom (freeze frame feel)
  const zoomScale = spring({
    frame,
    fps,
    from: 1.15,
    to: 1.0,
    config: { damping: 18, mass: 1.2, stiffness: 80 },
  })

  // Slow progressive re-zoom after initial spring settles
  const slowZoom = interpolate(frame, [0, durationInFrames], [1.0, 1.1], {
    extrapolateRight: 'clamp',
  })

  const finalScale = zoomScale * slowZoom

  // Fade in (fast)
  const fadeIn = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' })

  // Fade out at end
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const opacity = fadeIn * fadeOut

  // Text container appears after 4 frames
  const textOpacity = interpolate(frame, [4, 9], [0, 1], { extrapolateRight: 'clamp' })

  const videoFilter = VIDEO_STYLE_FILTER[videoStyle] ?? VIDEO_STYLE_FILTER.desaturated
  const textPositionStyle = TEXT_POSITION_STYLE[textPosition] ?? TEXT_POSITION_STYLE.bottom

  return (
    <AbsoluteFill style={{ background: 'black', opacity }}>

      {/* Video */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${finalScale})`,
          filter: videoFilter,
        }}
      >
        <OffthreadVideo
          src={videoUrl}
          startFrom={startFromFrame}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Heavy vignette — dark edges focus attention on the text */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      {/* Bottom gradient for text legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Hook phrase — word by word */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          justifyContent: 'center',
          opacity: textOpacity,
          ...textPositionStyle,
        }}
      >
        <WordByWord
          phrase={hookPhrase}
          fps={fps}
          textColor={textColor}
          highlightColor={highlightColor}
          fontFamily={fontFamily}
          fontSize={fontSize}
        />
      </div>

      {/* Swoosh near end */}
      {swooshEnabled && (
        <Sequence from={Math.max(0, durationInFrames - Math.round(fps * 0.5))}>
          <Audio src="/sfx/swoosh.mp3" volume={0.8} />
        </Sequence>
      )}
    </AbsoluteFill>
  )
}
