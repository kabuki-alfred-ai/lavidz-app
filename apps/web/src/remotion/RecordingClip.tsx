import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig } from 'remotion'
import type { SubtitleSettings } from './subtitleTypes'
import { DEFAULT_SUBTITLE_SETTINGS } from './subtitleTypes'

interface Props {
  videoUrl: string
  transcript: string | null
  durationInFrames: number
  subtitleSettings?: SubtitleSettings
}

interface WordWindow {
  words: string[]
  activeIndex: number
}

function getWordWindow(
  transcript: string,
  frame: number,
  totalFrames: number,
  wordsPerLine: number,
): WordWindow {
  const words = transcript.split(/\s+/).filter(Boolean)
  if (words.length === 0) return { words: [], activeIndex: 0 }

  const framesPerWord = totalFrames / words.length
  const currentWordIndex = Math.min(Math.floor(frame / framesPerWord), words.length - 1)

  // Snap window: floor to multiple of wordsPerLine
  const windowStart = Math.floor(currentWordIndex / wordsPerLine) * wordsPerLine
  const windowWords = words.slice(windowStart, windowStart + wordsPerLine)
  const activeIndex = currentWordIndex - windowStart

  return { words: windowWords, activeIndex }
}

// ─── Style renderers ──────────────────────────────────────────────────────────

function HormoziSubtitle({
  words,
  activeIndex,
  size,
}: {
  words: string[]
  activeIndex: number
  size: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: size * 0.2,
        maxWidth: '85%',
      }}
    >
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            fontFamily: 'Impact, "Arial Narrow", sans-serif',
            fontSize: size,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: 2,
            color: i === activeIndex ? '#FFE600' : '#FFFFFF',
            textShadow: [
              `-3px -3px 0 #000`,
              ` 3px -3px 0 #000`,
              `-3px  3px 0 #000`,
              ` 3px  3px 0 #000`,
              ` 0    4px 0 #000`,
            ].join(','),
            lineHeight: 1.15,
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

function MinimalSubtitle({
  words,
  activeIndex,
  size,
}: {
  words: string[]
  activeIndex: number
  size: number
}) {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        borderRadius: 8,
        padding: `${size * 0.25}px ${size * 0.6}px`,
        display: 'flex',
        gap: size * 0.25,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '80%',
      }}
    >
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: size,
            fontWeight: 600,
            color: i === activeIndex ? '#FF4D1C' : 'rgba(255,255,255,0.9)',
            lineHeight: 1.3,
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

function ClassicSubtitle({
  words,
  activeIndex,
  size,
}: {
  words: string[]
  activeIndex: number
  size: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: size * 0.22,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '85%',
      }}
    >
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: size,
            fontWeight: i === activeIndex ? 700 : 400,
            color: '#FFFFFF',
            textShadow: '2px 2px 4px #000, -2px 2px 4px #000, 2px -2px 4px #000, -2px -2px 4px #000',
            lineHeight: 1.3,
            borderBottom: i === activeIndex ? `3px solid #FFFFFF` : '3px solid transparent',
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

function NeonSubtitle({
  words,
  activeIndex,
  size,
}: {
  words: string[]
  activeIndex: number
  size: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: size * 0.22,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '85%',
      }}
    >
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            fontFamily: '"Arial Black", sans-serif',
            fontSize: size,
            fontWeight: 900,
            color: i === activeIndex ? '#00F5FF' : '#FFFFFF',
            textShadow: i === activeIndex
              ? '0 0 10px #00F5FF, 0 0 30px #00F5FF, 0 0 60px #00A8FF'
              : '0 0 8px rgba(255,255,255,0.3)',
            lineHeight: 1.3,
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecordingClip({
  videoUrl,
  transcript,
  durationInFrames,
  subtitleSettings,
}: Props) {
  const frame = useCurrentFrame()
  const settings = subtitleSettings ?? DEFAULT_SUBTITLE_SETTINGS
  const { style, size, position, wordsPerLine } = settings

  const { words, activeIndex } = transcript
    ? getWordWindow(transcript, frame, durationInFrames, wordsPerLine)
    : { words: [], activeIndex: 0 }

  const hasWords = words.length > 0

  const StyleComponent =
    style === 'hormozi' ? HormoziSubtitle
    : style === 'minimal' ? MinimalSubtitle
    : style === 'neon' ? NeonSubtitle
    : ClassicSubtitle

  return (
    <AbsoluteFill style={{ background: 'black' }}>
      <Video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {hasWords && (
        <div
          style={{
            position: 'absolute',
            top: `${position}%`,
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            display: 'flex',
            justifyContent: 'center',
            padding: '0 40px',
          }}
        >
          <StyleComponent words={words} activeIndex={activeIndex} size={size} />
        </div>
      )}
    </AbsoluteFill>
  )
}
