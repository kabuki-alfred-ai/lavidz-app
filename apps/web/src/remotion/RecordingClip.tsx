import { AbsoluteFill, Audio, Video, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { SubtitleSettings } from './subtitleTypes'
import { DEFAULT_SUBTITLE_SETTINGS } from './subtitleTypes'
import type { MotionSettings, WordTimestamp } from './themeTypes'

interface Props {
  videoUrl: string
  transcript: string | null
  wordTimestamps?: WordTimestamp[]
  durationInFrames: number
  subtitleSettings?: SubtitleSettings
  motionSettings?: MotionSettings
  sfxUrl?: string
  sfxVolume?: number
}

interface WordWindow {
  words: string[]
  activeIndex: number
  framesIntoActiveWord: number
}

function getWordWindow(
  transcript: string,
  frame: number,
  totalFrames: number,
  wordsPerLine: number,
  fps: number,
  wordTimestamps?: WordTimestamp[],
): WordWindow {
  if (wordTimestamps && wordTimestamps.length > 0) {
    // Use wordTimestamps as the single source of truth for both words and timing.
    const words = wordTimestamps.map(w => w.word)
    const currentTimeSec = frame / fps
    const SILENCE_THRESHOLD_SEC = 0.15 // hide subtitles during pauses longer than this

    // Before first word: blank
    if (currentTimeSec < wordTimestamps[0].start - SILENCE_THRESHOLD_SEC) {
      return { words: [], activeIndex: 0, framesIntoActiveWord: 0 }
    }
    // After last word: blank
    if (currentTimeSec > wordTimestamps[wordTimestamps.length - 1].end + SILENCE_THRESHOLD_SEC) {
      return { words: [], activeIndex: 0, framesIntoActiveWord: 0 }
    }

    let idx = wordTimestamps.findIndex(w => currentTimeSec >= w.start && currentTimeSec <= w.end)
    if (idx === -1) {
      // Between words — find surrounding words
      let prevIdx = -1
      let nextIdx = -1
      for (let i = 0; i < wordTimestamps.length; i++) {
        if (wordTimestamps[i].end < currentTimeSec) prevIdx = i
        else if (nextIdx === -1) nextIdx = i
      }

      // Hide subtitles if the gap to the next word is large (mid-sentence silence)
      if (prevIdx >= 0 && nextIdx >= 0) {
        const gap = wordTimestamps[nextIdx].start - wordTimestamps[prevIdx].end
        const timeSincePrev = currentTimeSec - wordTimestamps[prevIdx].end
        if (gap > 0.5 && timeSincePrev > SILENCE_THRESHOLD_SEC) {
          return { words: [], activeIndex: 0, framesIntoActiveWord: 0 }
        }
      }

      idx = prevIdx >= 0 ? prevIdx : 0
    }

    const currentWordIndex = Math.min(idx, words.length - 1)
    const wordStartFrame = Math.floor(wordTimestamps[currentWordIndex].start * fps)
    const framesIntoActiveWord = Math.max(0, frame - wordStartFrame)

    const windowStart = Math.floor(currentWordIndex / wordsPerLine) * wordsPerLine
    const windowWords = words.slice(windowStart, windowStart + wordsPerLine)
    const activeIndex = currentWordIndex - windowStart

    return { words: windowWords, activeIndex, framesIntoActiveWord }
  }

  // Fallback: uniform distribution across transcript words
  const words = transcript.split(/\s+/).filter(Boolean)
  if (words.length === 0) return { words: [], activeIndex: 0, framesIntoActiveWord: 0 }

  const framesPerWord = totalFrames / words.length
  const currentWordIndex = Math.min(Math.floor(frame / framesPerWord), words.length - 1)
  const framesIntoActiveWord = frame - currentWordIndex * framesPerWord

  const windowStart = Math.floor(currentWordIndex / wordsPerLine) * wordsPerLine
  const windowWords = words.slice(windowStart, windowStart + wordsPerLine)
  const activeIndex = currentWordIndex - windowStart

  return { words: windowWords, activeIndex, framesIntoActiveWord }
}

// ─── Style renderers ──────────────────────────────────────────────────────────

function HormoziSubtitle({
  words,
  activeIndex,
  size,
  wordPopScale,
}: {
  words: string[]
  activeIndex: number
  size: number
  wordPopScale: number
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
            display: 'inline-block',
            transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
            transformOrigin: 'center bottom',
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
  wordPopScale,
}: {
  words: string[]
  activeIndex: number
  size: number
  wordPopScale: number
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
            display: 'inline-block',
            transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
            transformOrigin: 'center bottom',
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
  wordPopScale,
}: {
  words: string[]
  activeIndex: number
  size: number
  wordPopScale: number
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
            display: 'inline-block',
            transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
            transformOrigin: 'center bottom',
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
  wordPopScale,
}: {
  words: string[]
  activeIndex: number
  size: number
  wordPopScale: number
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
            display: 'inline-block',
            transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
            transformOrigin: 'center bottom',
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
  wordTimestamps,
  durationInFrames,
  subtitleSettings,
  motionSettings,
  sfxUrl,
  sfxVolume = 1,
}: Props) {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const settings = subtitleSettings ?? DEFAULT_SUBTITLE_SETTINGS
  const { style, size, position, wordsPerLine, offsetMs = 0 } = settings

  const transitionStyle = motionSettings?.transitionStyle ?? 'zoom-punch'
  const isVertical = height > width

  // ─── Entry transition (first frames) ───────────────────────────────────────
  const entryScale =
    transitionStyle === 'zoom-punch'
      ? interpolate(frame, [0, 10], [1.4, 1.0], { extrapolateRight: 'clamp' })
      : 1
  const entryTranslateY =
    transitionStyle === 'slide-up'
      ? interpolate(frame, [0, 12], [160, 0], { extrapolateRight: 'clamp' })
      : 0
  const entryOpacity =
    transitionStyle === 'slide-up'
      ? interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
      : 1
  // Flash: white overlay that burns in then disappears
  const flashOverlayOpacity =
    transitionStyle === 'flash'
      ? interpolate(frame, [0, 7], [1, 0], { extrapolateRight: 'clamp' })
      : 0

  // ─── Ken Burns ──────────────────────────────────────────────────────────────
  const kenBurnsScale = motionSettings?.kenBurns
    ? interpolate(frame, [0, durationInFrames], [1.0, 1.04], { extrapolateRight: 'clamp' })
    : 1.0
  const finalVideoScale = entryScale * kenBurnsScale
  const videoTransform = `scale(${finalVideoScale}) translateY(${entryTranslateY}px)`

  // ─── Subtitles with Word Pop ────────────────────────────────────────────────
  // Apply offset: shift timestamps by -offsetMs (negative = subtitles appear earlier)
  const shiftedTimestamps = wordTimestamps?.map(w => ({
    ...w,
    start: Math.max(0, w.start - offsetMs / 1000),
    end: Math.max(0, w.end - offsetMs / 1000),
  }))

  const { words, activeIndex, framesIntoActiveWord } = transcript
    ? getWordWindow(transcript, frame, durationInFrames, wordsPerLine, fps, shiftedTimestamps)
    : { words: [], activeIndex: 0, framesIntoActiveWord: 0 }

  const hasWords = words.length > 0

  const wordPopScale = motionSettings?.wordPop
    ? interpolate(framesIntoActiveWord, [0, 2, 5], [1.0, 1.3, 1.0], { extrapolateRight: 'clamp' })
    : 1.0

  const StyleComponent =
    style === 'hormozi' ? HormoziSubtitle
    : style === 'minimal' ? MinimalSubtitle
    : style === 'neon' ? NeonSubtitle
    : ClassicSubtitle

  const subtitlesNode = settings.enabled && hasWords && (
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
        zIndex: 2,
      }}
    >
      <StyleComponent words={words} activeIndex={activeIndex} size={size} wordPopScale={wordPopScale} />
    </div>
  )

  // ─── Progress bar ───────────────────────────────────────────────────────────
  const progressBarNode = motionSettings?.progressBar && (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 4,
        height: 3,
        background: '#fff',
        width: `${Math.min((frame / durationInFrames) * 100, 100)}%`,
      }}
    />
  )

  // ─── Lower third ────────────────────────────────────────────────────────────
  const lowerThird = motionSettings?.lowerThird
  const ltSpring = lowerThird ? spring({ frame, fps, config: { damping: 20, stiffness: 80 } }) : 0
  const ltOpacity = lowerThird
    ? interpolate(frame, [fps * 3, fps * 3.5], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0
  const ltTranslateX = interpolate(ltSpring, [0, 1], [-220, 0])

  const lowerThirdNode = lowerThird && (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: 40,
        zIndex: 3,
        opacity: ltOpacity,
        transform: `translateX(${ltTranslateX}px)`,
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
      }}
    >
      <div style={{ width: 4, background: '#fff', borderRadius: 2, marginRight: 12, flexShrink: 0 }} />
      <div>
        <p style={{ color: '#fff', fontWeight: 800, fontSize: 22, lineHeight: 1.2, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
          {lowerThird.name}
        </p>
        {lowerThird.title && (
          <p style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 400, fontSize: 14, margin: 0, marginTop: 3, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            {lowerThird.title}
          </p>
        )}
      </div>
    </div>
  )

  const flashNode = flashOverlayOpacity > 0 && (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flashOverlayOpacity, zIndex: 10, pointerEvents: 'none' }} />
  )

  const sfxNode = sfxUrl && <Audio src={sfxUrl} volume={sfxVolume} />

  if (isVertical) {
    return (
      <AbsoluteFill style={{ background: 'black', overflow: 'hidden', opacity: entryOpacity }}>
        {sfxNode}
        {/* Blurred background — muted to avoid double audio */}
        <Video
          src={videoUrl}
          muted
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(22px)',
            transform: 'scale(1.12)',
            opacity: 0.55,
          }}
        />
        {/* Centered main video with entry + ken burns */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: videoTransform,
          }}
        >
          <Video src={videoUrl} style={{ width: '100%', objectFit: 'contain' }} />
        </div>
        {progressBarNode}
        {subtitlesNode}
        {lowerThirdNode}
        {flashNode}
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill style={{ background: 'black', opacity: entryOpacity }}>
      {sfxNode}
      <div style={{ position: 'absolute', inset: 0, transform: videoTransform }}>
        <Video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {progressBarNode}
      {subtitlesNode}
      {lowerThirdNode}
      {flashNode}
    </AbsoluteFill>
  )
}
