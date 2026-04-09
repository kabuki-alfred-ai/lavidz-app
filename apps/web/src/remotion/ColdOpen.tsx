import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import type { SfxTrack } from './themeTypes'

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
  // Viral options
  freezeFrame?: boolean
  textAnimation?: 'pop' | 'slam' | 'typewriter'
  highlightMode?: 'word' | 'all' | 'box'
  coldOpenSfx?: SfxTrack
  entrySfx?: SfxTrack
}

// ─── Text animations ──────────────────────────────────────────────────────────

/** Word-by-word spring pop (default) */
function PopText({
  phrase, fps, textColor = '#FFFFFF', highlightColor = '#FFD60A',
  fontFamily = "Impact, 'Arial Narrow', sans-serif", fontSize = 72,
  highlightMode = 'word',
}: {
  phrase: string; fps: number; textColor?: string; highlightColor?: string
  fontFamily?: string; fontSize?: number; highlightMode?: 'word' | 'all' | 'box'
}) {
  const frame = useCurrentFrame()
  const words = phrase.split(' ')
  const FRAMES_PER_WORD = 7

  if (highlightMode === 'box') {
    return (
      <div style={{
        display: 'inline-block',
        background: highlightColor,
        padding: '12px 24px',
        borderRadius: 8,
      }}>
        <WordsInline
          words={words} frame={frame} fps={fps} framesPerWord={FRAMES_PER_WORD}
          fontFamily={fontFamily} fontSize={fontSize}
          textColor='#000000' highlightColor='#000000' highlightMode='all'
        />
      </div>
    )
  }

  return (
    <WordsInline
      words={words} frame={frame} fps={fps} framesPerWord={FRAMES_PER_WORD}
      fontFamily={fontFamily} fontSize={fontSize}
      textColor={textColor} highlightColor={highlightColor} highlightMode={highlightMode}
    />
  )
}

function WordsInline({ words, frame, fps, framesPerWord, textColor, highlightColor, highlightMode, fontFamily, fontSize }: {
  words: string[]; frame: number; fps: number; framesPerWord: number
  textColor: string; highlightColor: string; highlightMode: 'word' | 'all'
  fontFamily: string; fontSize: number
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0px 12px', justifyContent: 'center', alignItems: 'center' }}>
      {words.map((word, i) => {
        const wordFrame = frame - i * framesPerWord
        if (wordFrame < 0) return null
        const scale = spring({ frame: wordFrame, fps, from: 0, to: 1, config: { damping: 8, mass: 0.5, stiffness: 300 } })
        const rotate = interpolate(wordFrame, [0, 4, 8], [8, -3, 0], { extrapolateRight: 'clamp' })
        const isLast = i === words.length - 1
        const isHighlighted = highlightMode === 'all' || isLast || (words.length <= 3 && i === Math.floor(words.length / 2))
        return (
          <span key={i} style={{
            display: 'inline-block',
            transform: `scale(${scale}) rotate(${rotate}deg)`,
            transformOrigin: 'center bottom',
            fontFamily, fontSize, fontWeight: 900,
            lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: 2,
            color: isHighlighted ? highlightColor : textColor,
            WebkitTextStroke: '3px #000000',
            textShadow: isHighlighted
              ? `0 0 40px ${highlightColor}99, 0 4px 16px rgba(0,0,0,0.9)`
              : '0 4px 16px rgba(0,0,0,0.9)',
            margin: '0 4px 8px',
          }}>{word}</span>
        )
      })}
    </div>
  )
}

/** All words slam in as one block from above */
function SlamText({
  phrase, fps, textColor = '#FFFFFF', highlightColor = '#FFD60A',
  fontFamily = "Impact, 'Arial Narrow', sans-serif", fontSize = 72,
  highlightMode = 'word',
}: {
  phrase: string; fps: number; textColor?: string; highlightColor?: string
  fontFamily?: string; fontSize?: number; highlightMode?: 'word' | 'all' | 'box'
}) {
  const frame = useCurrentFrame()
  const words = phrase.split(' ')

  const scale = spring({ frame, fps, from: 0.4, to: 1, config: { damping: 12, stiffness: 500, mass: 0.6 } })
  const translateY = interpolate(frame, [0, 6], [-25, 0], { extrapolateRight: 'clamp' })

  const inner = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0px 12px', justifyContent: 'center', alignItems: 'center' }}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1
        const isHighlighted = highlightMode === 'all' || highlightMode === 'box' || isLast || (words.length <= 3 && i === Math.floor(words.length / 2))
        const color = highlightMode === 'box' ? '#000000' : (isHighlighted ? highlightColor : textColor)
        return (
          <span key={i} style={{
            display: 'inline-block',
            fontFamily, fontSize, fontWeight: 900,
            lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: 2,
            color,
            WebkitTextStroke: highlightMode === 'box' ? 'none' : '3px #000000',
            textShadow: highlightMode === 'box' ? 'none' : (isHighlighted
              ? `0 0 40px ${highlightColor}99, 0 4px 16px rgba(0,0,0,0.9)`
              : '0 4px 16px rgba(0,0,0,0.9)'),
            margin: '0 4px 8px',
          }}>{word}</span>
        )
      })}
    </div>
  )

  return (
    <div style={{ transform: `scale(${scale}) translateY(${translateY}px)`, transformOrigin: 'center bottom' }}>
      {highlightMode === 'box' ? (
        <div style={{ background: highlightColor, padding: '12px 24px', borderRadius: 8 }}>{inner}</div>
      ) : inner}
    </div>
  )
}

/** Characters appear one by one (typewriter) */
function TypewriterText({
  phrase, fps, textColor = '#FFFFFF', highlightColor = '#FFD60A',
  fontFamily = "Impact, 'Arial Narrow', sans-serif", fontSize = 72,
}: {
  phrase: string; fps: number; textColor?: string; highlightColor?: string
  fontFamily?: string; fontSize?: number
}) {
  const frame = useCurrentFrame()
  const charsVisible = Math.floor(frame * 2.5)
  const visible = phrase.slice(0, charsVisible)
  const showCursor = frame % Math.round(fps * 0.5) < Math.round(fps * 0.25)

  return (
    <span style={{
      fontFamily, fontSize, fontWeight: 900,
      lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: 2,
      color: textColor,
      WebkitTextStroke: '3px #000000',
      textShadow: '0 4px 16px rgba(0,0,0,0.9)',
    }}>
      {visible}
      <span style={{
        color: highlightColor,
        opacity: showCursor ? 1 : 0,
        WebkitTextStroke: 'none',
        textShadow: `0 0 20px ${highlightColor}`,
      }}>|</span>
    </span>
  )
}

// ─── Filters & positions ──────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

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
  freezeFrame = false,
  textAnimation = 'pop',
  highlightMode = 'word',
  coldOpenSfx,
  entrySfx,
}: ColdOpenProps) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const startFromFrame = Math.round(startInSeconds * fps)

  // Aggressive spring zoom (freeze frame feel)
  const zoomScale = spring({ frame, fps, from: 1.15, to: 1.0, config: { damping: 18, mass: 1.2, stiffness: 80 } })
  const slowZoom = interpolate(frame, [0, durationInFrames], [1.0, 1.1], { extrapolateRight: 'clamp' })
  const finalScale = zoomScale * slowZoom

  const fadeIn = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const opacity = fadeIn * fadeOut

  const textOpacity = interpolate(frame, [4, 9], [0, 1], { extrapolateRight: 'clamp' })

  const videoFilter = VIDEO_STYLE_FILTER[videoStyle] ?? VIDEO_STYLE_FILTER.desaturated
  const textPositionStyle = TEXT_POSITION_STYLE[textPosition] ?? TEXT_POSITION_STYLE.bottom

  const videoEl = (
    <OffthreadVideo
      src={videoUrl}
      startFrom={startFromFrame}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )

  const TextComponent =
    textAnimation === 'slam' ? SlamText
    : textAnimation === 'typewriter' ? TypewriterText
    : PopText

  return (
    <AbsoluteFill style={{ background: 'black', opacity }}>

      {/* Video — optionally frozen at startFromFrame */}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${finalScale})`, filter: videoFilter }}>
        {freezeFrame ? <Freeze frame={0}>{videoEl}</Freeze> : videoEl}
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)' }} />

      {/* Bottom gradient */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.85) 100%)' }} />

      {/* Hook phrase */}
      <div style={{ position: 'absolute', display: 'flex', justifyContent: 'center', opacity: textOpacity, ...textPositionStyle }}>
        <TextComponent
          phrase={hookPhrase} fps={fps}
          textColor={textColor} highlightColor={highlightColor}
          fontFamily={fontFamily} fontSize={fontSize}
          highlightMode={highlightMode}
        />
      </div>

      {/* Entry sound (when text appears, frame 4) */}
      {entrySfx && (
        <Sequence from={4} durationInFrames={15}>
          <Audio src={entrySfx.url} volume={entrySfx.volume ?? 0.7} />
        </Sequence>
      )}

      {/* End sound — library SFX takes priority over local swoosh */}
      {coldOpenSfx ? (
        <Sequence from={Math.max(0, durationInFrames - Math.round(fps * 0.5))}>
          <Audio src={coldOpenSfx.url} volume={coldOpenSfx.volume ?? 0.8} />
        </Sequence>
      ) : swooshEnabled ? (
        <Sequence from={Math.max(0, durationInFrames - Math.round(fps * 0.5))}>
          <Audio src={staticFile('sfx/swoosh.mp3')} volume={0.8} />
        </Sequence>
      ) : null}

    </AbsoluteFill>
  )
}
