import { AbsoluteFill, Audio, Video, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { useMemo, useRef, useEffect } from 'react'
import type { SubtitleSettings } from './subtitleTypes'
import { DEFAULT_SUBTITLE_SETTINGS } from './subtitleTypes'
import type { MotionSettings, WordTimestamp } from './themeTypes'

interface Props {
  videoUrl: string
  transcript: string | null
  wordTimestamps?: WordTimestamp[]
  durationInFrames: number
  /** Frame offset into the source video (for non-destructive cuts). */
  startFromFrame?: number
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

interface ZoomKeyframe { frame: number; scale: number }

// Sentence-aware subtitle windowing.
// Returns the end index (exclusive) of the window starting at `start`, respecting
// sentence-ending punctuation so a new sentence never bleeds into the current line.
function getWindowEnd(words: string[], start: number, wordsPerLine: number): number {
  let i = start
  let count = 0
  while (i < words.length && count < wordsPerLine) {
    const isSentenceEnd = /[.!?,;]$/.test(words[i])
    i++
    count++
    if (isSentenceEnd && i < words.length) break
  }
  return i
}

function findWindowBounds(words: string[], wordIdx: number, wordsPerLine: number): { start: number; end: number } {
  let i = 0
  while (i < words.length) {
    const end = getWindowEnd(words, i, wordsPerLine)
    if (wordIdx < end) return { start: i, end }
    i = end
  }
  return { start: 0, end: Math.min(wordsPerLine, words.length) }
}

// Binary search: finds the index of the word active at `currentTimeSec`.
// Returns a negative encoded value -(insertionPoint+1) when between words,
// where insertionPoint is the index of the next word (lo after the search).
function binarySearchWord(timestamps: WordTimestamp[], currentTimeSec: number): number {
  let lo = 0
  let hi = timestamps.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (timestamps[mid].end < currentTimeSec) lo = mid + 1
    else if (timestamps[mid].start > currentTimeSec) hi = mid - 1
    else return mid
  }
  return -(lo + 1) // between words: nextIdx = lo, prevIdx = lo - 1
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
    // Whisper timestamps mark word onset slightly early — shift back by 80ms so
    // subtitles appear in sync with the audible word rather than ahead of it.
    const SUBTITLE_DELAY_SEC = 0.08
    const currentTimeSec = Math.max(0, frame / fps - SUBTITLE_DELAY_SEC)
    const SILENCE_THRESHOLD_SEC = 0.15 // hide subtitles during pauses longer than this

    // Before first word: blank
    if (currentTimeSec < wordTimestamps[0].start - SILENCE_THRESHOLD_SEC) {
      return { words: [], activeIndex: 0, framesIntoActiveWord: 0 }
    }
    // After last word: blank
    if (currentTimeSec > wordTimestamps[wordTimestamps.length - 1].end + SILENCE_THRESHOLD_SEC) {
      return { words: [], activeIndex: 0, framesIntoActiveWord: 0 }
    }

    const searchResult = binarySearchWord(wordTimestamps, currentTimeSec)
    let idx: number

    if (searchResult >= 0) {
      idx = searchResult
    } else {
      // Between words — decode insertion point
      const nextIdx = -(searchResult + 1)
      const prevIdx = nextIdx - 1

      // Hide subtitles if the gap to the next word is large (mid-sentence silence)
      if (prevIdx >= 0 && nextIdx < wordTimestamps.length) {
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

    const { start: windowStart, end: windowEnd } = findWindowBounds(words, currentWordIndex, wordsPerLine)
    const windowWords = words.slice(windowStart, windowEnd)
    const activeIndex = currentWordIndex - windowStart

    return { words: windowWords, activeIndex, framesIntoActiveWord }
  }

  // Fallback: uniform distribution across transcript words
  const words = transcript.split(/\s+/).filter(Boolean)
  if (words.length === 0) return { words: [], activeIndex: 0, framesIntoActiveWord: 0 }

  const framesPerWord = totalFrames / words.length
  const currentWordIndex = Math.min(Math.floor(frame / framesPerWord), words.length - 1)
  const framesIntoActiveWord = frame - currentWordIndex * framesPerWord

  const { start: windowStart, end: windowEnd } = findWindowBounds(words, currentWordIndex, wordsPerLine)
  const windowWords = words.slice(windowStart, windowEnd)
  const activeIndex = currentWordIndex - windowStart

  return { words: windowWords, activeIndex, framesIntoActiveWord }
}

// ─── Animated emoji overlay (Submagic-style) ─────────────────────────────────

/**
 * Animated emoji pop around the subtitle block (Submagic-style).
 * Uses Google Noto Animated Emoji (GIF via CDN) for the animation.
 * Falls back to plain emoji span if the animated version fails to load.
 */

// 8 positions around the subtitle block: { dx, dy } pixel offsets from subtitle center.
// Negative dy = above, positive dy = below. Negative dx = left, positive dx = right.
const EMOJI_POSITIONS: { dx: number; dy: number }[] = [
  { dx:    0, dy: -110 }, // above-center
  { dx: -190, dy:  -80 }, // above-left
  { dx:  190, dy:  -80 }, // above-right
  { dx: -260, dy:   -5 }, // side-left
  { dx:  260, dy:   -5 }, // side-right
  { dx:    0, dy:   90 }, // below-center
  { dx: -190, dy:   65 }, // below-left
  { dx:  190, dy:   65 }, // below-right
]

function EmojiPop({
  emoji,
  framesIntoActiveWord,
  fps,
  subtitlePositionPct,
  emojiIndex,
}: {
  emoji: string
  framesIntoActiveWord: number
  fps: number
  subtitlePositionPct: number
  emojiIndex: number
}) {
  const FONT_SIZE = 96 // px — uniform for all emojis (native text rendering)
  const pos = EMOJI_POSITIONS[emojiIndex % EMOJI_POSITIONS.length]

  // Entry spring: punchy overshoot 0 → 1
  const entryScale = spring({
    frame: framesIntoActiveWord,
    fps,
    from: 0,
    to: 1,
    config: { damping: 5, mass: 0.35, stiffness: 320 },
  })

  // Rotation direction: left side → CCW, right/center → CW
  const rotateDir = pos.dx <= 0 ? -1 : 1
  const entryRotate = spring({
    frame: framesIntoActiveWord,
    fps,
    from: rotateDir * 20,
    to: 0,
    config: { damping: 8, mass: 0.5, stiffness: 220 },
  })

  // Idle float — speed varies per emoji
  const floatSpeed = 2.0 + (emojiIndex % 3) * 0.4
  const idle = framesIntoActiveWord > 10
    ? interpolate(Math.sin(((framesIntoActiveWord - 10) / fps) * Math.PI * floatSpeed), [-1, 1], [-6, 6])
    : 0

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: `${subtitlePositionPct}%`,
      transform: `translate(calc(-50% + ${pos.dx}px), calc(-50% + ${pos.dy + idle}px)) scale(${entryScale}) rotate(${entryRotate}deg)`,
      transformOrigin: 'center center',
      zIndex: 3,
      pointerEvents: 'none',
      lineHeight: 1,
    }}>
      <span style={{
        fontSize: FONT_SIZE,
        lineHeight: 1,
        display: 'block',
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.6))',
        userSelect: 'none',
      }}>
        {emoji}
      </span>
    </div>
  )
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

// ─── Karaoke ─────────────────────────────────────────────────────────────────
function KaraokeSubtitle({ words, activeIndex, size, wordPopScale }: { words: string[]; activeIndex: number; size: number; wordPopScale: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: size * 0.15, maxWidth: '85%' }}>
      {words.map((word, i) => (
        <span key={i} style={{
          fontFamily: "'Oswald', Impact, sans-serif", fontSize: size, fontWeight: 700,
          color: i === activeIndex ? '#000' : 'rgba(255,255,255,0.5)',
          background: i === activeIndex ? '#FFE600' : 'transparent',
          padding: i === activeIndex ? `${size * 0.05}px ${size * 0.18}px` : '0',
          borderRadius: size * 0.12, lineHeight: 1.2, display: 'inline-block',
          transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
          transformOrigin: 'center bottom', transition: 'background 0.06s',
        }}>{word}</span>
      ))}
    </div>
  )
}

// ─── Boxed ────────────────────────────────────────────────────────────────────
function BoxedSubtitle({ words, activeIndex, size, wordPopScale }: { words: string[]; activeIndex: number; size: number; wordPopScale: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: size * 0.18, maxWidth: '85%' }}>
      {words.map((word, i) => (
        <span key={i} style={{
          fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: size, fontWeight: 700,
          color: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.8)',
          background: i === activeIndex ? '#FF4D1C' : 'rgba(0,0,0,0.6)',
          border: `2px solid ${i === activeIndex ? '#FF4D1C' : 'rgba(255,255,255,0.2)'}`,
          padding: `${size * 0.08}px ${size * 0.22}px`, borderRadius: size * 0.15,
          lineHeight: 1.25, display: 'inline-block',
          transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
          transformOrigin: 'center bottom',
        }}>{word}</span>
      ))}
    </div>
  )
}

// ─── Outline ─────────────────────────────────────────────────────────────────
function OutlineSubtitle({ words, activeIndex, size, wordPopScale }: { words: string[]; activeIndex: number; size: number; wordPopScale: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: size * 0.2, maxWidth: '85%' }}>
      {words.map((word, i) => (
        <span key={i} style={{
          fontFamily: "'Anton', Impact, sans-serif", fontSize: size, fontWeight: 400,
          color: i === activeIndex ? '#FFE600' : 'transparent',
          WebkitTextStroke: `${Math.max(2, size * 0.03)}px ${i === activeIndex ? '#FFE600' : '#FFFFFF'}`,
          letterSpacing: 2, lineHeight: 1.15, display: 'inline-block',
          transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
          transformOrigin: 'center bottom',
        }}>{word}</span>
      ))}
    </div>
  )
}

// ─── Tape ─────────────────────────────────────────────────────────────────────
function TapeSubtitle({ words, activeIndex, size, wordPopScale }: { words: string[]; activeIndex: number; size: number; wordPopScale: number }) {
  return (
    <div style={{ background: '#000', padding: `${size * 0.2}px ${size * 0.5}px`, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: size * 0.22, maxWidth: '100%', width: '100%' }}>
      {words.map((word, i) => (
        <span key={i} style={{
          fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: size, fontWeight: 700,
          color: i === activeIndex ? '#FFE600' : 'rgba(255,255,255,0.85)',
          lineHeight: 1.25, display: 'inline-block',
          transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
          transformOrigin: 'center bottom',
          textDecoration: i === activeIndex ? 'underline' : 'none',
          textDecorationColor: '#FFE600',
          textUnderlineOffset: '4px',
        }}>{word}</span>
      ))}
    </div>
  )
}

// ─── Glitch ───────────────────────────────────────────────────────────────────
function GlitchSubtitle({ words, activeIndex, size, wordPopScale }: { words: string[]; activeIndex: number; size: number; wordPopScale: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: size * 0.22, maxWidth: '85%' }}>
      {words.map((word, i) => (
        <span key={i} style={{
          fontFamily: "'Teko', Impact, sans-serif", fontSize: size, fontWeight: 700,
          color: i === activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
          textShadow: i === activeIndex
            ? `3px 0 #FF0000, -3px 0 #00FFFF, 0 0 12px rgba(255,255,255,0.6)`
            : '2px 2px 6px rgba(0,0,0,0.8)',
          letterSpacing: i === activeIndex ? 3 : 1, lineHeight: 1.2, display: 'inline-block',
          transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
          transformOrigin: 'center bottom',
        }}>{word}</span>
      ))}
    </div>
  )
}

// ─── Fire ─────────────────────────────────────────────────────────────────────
function FireSubtitle({ words, activeIndex, size, wordPopScale }: { words: string[]; activeIndex: number; size: number; wordPopScale: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: size * 0.22, maxWidth: '85%' }}>
      {words.map((word, i) => (
        <span key={i} style={{
          fontFamily: "'Barlow Condensed', Arial, sans-serif", fontSize: size, fontWeight: 900,
          color: i === activeIndex ? '#FFF7ED' : '#FFFFFF',
          textShadow: i === activeIndex
            ? `0 0 8px #FF6B00, 0 0 18px #FF3500, 0 0 36px #FF1500, 0 0 60px #CC0000`
            : '2px 2px 6px rgba(0,0,0,0.7)',
          letterSpacing: 1, lineHeight: 1.2, display: 'inline-block',
          transform: i === activeIndex ? `scale(${wordPopScale})` : 'scale(1)',
          transformOrigin: 'center bottom',
        }}>{word}</span>
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
  startFromFrame,
  subtitleSettings,
  motionSettings,
  sfxUrl,
  sfxVolume = 1,
}: Props) {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const settings = subtitleSettings ?? DEFAULT_SUBTITLE_SETTINGS
  const { style, size, position, wordsPerLine, offsetMs = 0 } = settings

  const isVertical = height > width

  // ─── Entry transition (first frames) ────────────────────────────────────────
  const transitionStyle = motionSettings?.transitionStyle ?? 'zoom-punch'

  // zoom-punch
  const entryScale =
    transitionStyle === 'zoom-punch'
      ? interpolate(frame, [0, 10], [1.4, 1.0], { extrapolateRight: 'clamp' })
      : 1

  // slide-up
  const entryTranslateY =
    transitionStyle === 'slide-up'
      ? interpolate(frame, [0, 12], [160, 0], { extrapolateRight: 'clamp' })
      : 0
  const entryOpacity =
    transitionStyle === 'slide-up' || transitionStyle === 'blur-in'
      ? interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
      : 1

  // flash: white overlay that burns in then disappears
  const flashOverlayOpacity =
    transitionStyle === 'flash'
      ? interpolate(frame, [0, 7], [1, 0], { extrapolateRight: 'clamp' })
      : 0

  // wipe-right: clip slides in from left side
  const wipeProgress = transitionStyle === 'wipe-right'
    ? spring({ frame, fps, config: { damping: 28, stiffness: 140 } })
    : 1
  const entryTranslateX =
    transitionStyle === 'wipe-right'
      ? interpolate(wipeProgress, [0, 1], [-width, 0])
      : 0

  // spin-scale: quick rotation + scale spring (social media feel)
  const spinProgress = transitionStyle === 'spin-scale'
    ? spring({ frame, fps, config: { damping: 18, stiffness: 180 } })
    : 1
  const entryRotate = transitionStyle === 'spin-scale'
    ? interpolate(spinProgress, [0, 1], [7, 0])
    : 0
  const spinEntryScale = transitionStyle === 'spin-scale'
    ? interpolate(spinProgress, [0, 1], [0.82, 1])
    : 1

  // glitch-cut: horizontal shift + color filter for first 8 frames
  const glitchActive = transitionStyle === 'glitch-cut' && frame < 9
  const glitchX = glitchActive ? Math.sin(frame * 47.3) * 14 : 0
  const glitchFilter = glitchActive ? `hue-rotate(${frame * 22}deg) saturate(2.2)` : undefined

  // blur-in: video comes into focus from heavy blur
  const blurVal = transitionStyle === 'blur-in'
    ? interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' })
    : 0

  // shake: quick horizontal oscillation decaying over 18 frames
  const shakeX = transitionStyle === 'shake' && frame < 18
    ? Math.sin(frame * 3.8) * interpolate(frame, [0, 18], [22, 0], { extrapolateRight: 'clamp' })
    : 0

  // ─── Ken Burns ──────────────────────────────────────────────────────────────
  const kenBurnsScale = motionSettings?.kenBurns
    ? interpolate(frame, [0, durationInFrames], [1.0, 1.04], { extrapolateRight: 'clamp' })
    : 1.0

  // ─── Subtitles timestamps (needed by Dynamic Zoom below) ────────────────────
  // Memoized: recomputed only when wordTimestamps or offsetMs changes, not every frame
  const shiftedTimestamps = useMemo(
    () => wordTimestamps?.map(w => ({
      ...w,
      start: Math.max(0, w.start - offsetMs / 1000),
      end: Math.max(0, w.end - offsetMs / 1000),
    })),
    [wordTimestamps, offsetMs],
  )

  // Merge apostrophe-split tokens: ["j'", "étais"] → ["j'étais"]
  // Handles cached old timestamps where tokens were split by the ASR model.
  const mergedTimestamps = useMemo(() => {
    if (!shiftedTimestamps?.length) return shiftedTimestamps
    const result: WordTimestamp[] = []
    for (let i = 0; i < shiftedTimestamps.length; i++) {
      const w = shiftedTimestamps[i]
      const next = shiftedTimestamps[i + 1]
      if (next && (w.word.endsWith("'") || w.word.endsWith('\u2019'))) {
        result.push({ word: w.word + next.word, start: w.start, end: next.end })
        i++
      } else {
        result.push(w)
      }
    }
    return result
  }, [shiftedTimestamps])

  const { words, activeIndex, framesIntoActiveWord } = transcript
    ? getWordWindow(transcript, frame, durationInFrames, wordsPerLine, fps, mergedTimestamps)
    : { words: [], activeIndex: 0, framesIntoActiveWord: 0 }

  // ─── Dynamic Zoom — "camera operator" reframe ───────────────────────────────
  // Mimics professional editor behavior:
  //   • Emphasis scoring (weighted: pause + word length + punctuation + sentence start)
  //   • Push/pull alternation: zoom in → wider → zoom in deeper → breathe out
  //   • Intensity tiered by emphasis strength (subtle / medium / punch)
  //   • Spring easing over ~12 frames for organic camera feel
  //   • Periodic return to wide (1.0) so viewer never feels trapped

  // Transition duration: ~12 frames ≈ 0.4s — feels like a human camera move
  const SNAP_FRAMES = 12
  // Min hold between reframes (2s) — avoids nausea
  const MIN_HOLD_FRAMES = Math.round(fps * 2.0)
  // Force a return to wide (1.0) after this many consecutive zoomed-in reframes
  const WIDE_RESET_EVERY = 3

  const zoomKeyframes = useMemo((): ZoomKeyframe[] => {
    if (!motionSettings?.dynamicZoom) return []

    const kf: ZoomKeyframe[] = [{ frame: 0, scale: 1.0 }]
    let lastFrame = 0
    let consecutivePushes = 0

    // Push/pull pattern: each push zooms in, every WIDE_RESET_EVERY we pull back
    // Levels: subtle (1.08), medium (1.18), punch (1.32), deep (1.42)
    const PUSH_LEVELS = [1.32, 1.18, 1.42, 1.08, 1.28, 1.15, 1.38, 1.12]
    let pushIdx = 0

    if (mergedTimestamps && mergedTimestamps.length > 0) {
      for (let i = 1; i < mergedTimestamps.length; i++) {
        const w = mergedTimestamps[i]
        const prev = mergedTimestamps[i - 1]
        const triggerFrame = Math.round(w.start * fps)

        if (triggerFrame - lastFrame < MIN_HOLD_FRAMES) continue

        const gap = w.start - prev.end           // silence gap = breath before word
        const wordDur = w.end - w.start           // long word = deliberate emphasis
        const afterSentence = /[.!?]/.test(prev.word)   // new sentence = fresh beat
        const afterComma = /[,;]/.test(prev.word)        // lighter pause
        const isFirstWord = i <= 1                       // hook moment

        // Weighted emphasis score (0.0 → 1.0)
        let score = 0
        if (gap >= 0.5)      score += 0.5   // long pause = strong beat
        else if (gap >= 0.2) score += 0.25  // short pause = mild beat
        if (wordDur >= 0.45) score += 0.3   // very long word
        else if (wordDur >= 0.3) score += 0.15
        if (afterSentence)   score += 0.35  // new sentence = visual reset beat
        if (afterComma)      score += 0.1
        if (isFirstWord)     score += 0.4

        // Only trigger on meaningful moments (score above threshold)
        if (score < 0.25) continue

        // Every WIDE_RESET_EVERY pushes → pull back to wide for a breath
        if (consecutivePushes >= WIDE_RESET_EVERY) {
          // Wide shot: pull back toward 1.0 (slightly above to stay dynamic)
          const wideScale = score >= 0.6 ? 1.0 : 1.05
          kf.push({ frame: triggerFrame, scale: wideScale })
          consecutivePushes = 0
        } else {
          // Push in — intensity modulated by emphasis score
          // High score (≥0.7) → punch level; low score → subtle reframe
          const baseScale = score >= 0.7
            ? PUSH_LEVELS[pushIdx % PUSH_LEVELS.length]             // punch
            : PUSH_LEVELS[pushIdx % PUSH_LEVELS.length] * 0.85 + 0.15 // subtle
          kf.push({ frame: triggerFrame, scale: Math.min(baseScale, 1.45) })
          pushIdx++
          consecutivePushes++
        }

        lastFrame = triggerFrame
      }
    }

    // Fallback: push/pull at regular intervals when no timestamps or too sparse
    if (kf.length < 3) {
      const interval = Math.round(fps * 2.5)
      let pushCount = 0
      const FALLBACK_LEVELS = [1.25, 1.12, 1.38, 1.0, 1.30, 1.08]
      let fi = 0
      for (let f = interval; f < durationInFrames; f += interval) {
        if (pushCount >= WIDE_RESET_EVERY) {
          kf.push({ frame: f, scale: 1.0 })
          pushCount = 0
        } else {
          kf.push({ frame: f, scale: FALLBACK_LEVELS[fi % FALLBACK_LEVELS.length] })
          fi++
          pushCount++
        }
      }
    }

    return kf
  }, [motionSettings?.dynamicZoom, mergedTimestamps, fps, durationInFrames])

  // Compute zoom at current frame using spring easing:
  // Ease-out cubic over SNAP_FRAMES for organic camera feel, then hold.
  let dynamicZoomScale = 1.0
  if (motionSettings?.dynamicZoom && zoomKeyframes.length >= 2) {
    let prevIdx = 0
    for (let i = 1; i < zoomKeyframes.length; i++) {
      if (zoomKeyframes[i].frame <= frame) prevIdx = i
      else break
    }
    const curr = zoomKeyframes[prevIdx]
    const fromScale = prevIdx > 0 ? zoomKeyframes[prevIdx - 1].scale : curr.scale
    const framesSince = frame - curr.frame

    if (framesSince < SNAP_FRAMES) {
      const t = framesSince / SNAP_FRAMES
      // Ease-out cubic: starts fast, decelerates — like a camera settling on frame
      const eased = 1 - Math.pow(1 - t, 3)
      dynamicZoomScale = fromScale + (curr.scale - fromScale) * eased
    } else {
      dynamicZoomScale = curr.scale
    }
  }

  const finalVideoScale = entryScale * spinEntryScale * kenBurnsScale * dynamicZoomScale
  const combinedTranslateX = entryTranslateX + glitchX + shakeX
  const videoTransform = [
    `scale(${finalVideoScale})`,
    `translateY(${entryTranslateY}px)`,
    combinedTranslateX !== 0 ? `translateX(${combinedTranslateX}px)` : '',
    entryRotate !== 0 ? `rotate(${entryRotate}deg)` : '',
  ].filter(Boolean).join(' ')

  const videoFilter = [
    blurVal > 0 ? `blur(${blurVal}px)` : '',
    glitchFilter ?? '',
  ].filter(Boolean).join(' ') || undefined

  // ─── Subtitles with Word Pop ─────────────────────────────────────────────────

  const hasWords = words.length > 0

  const wordPopScale = motionSettings?.wordPop
    ? interpolate(framesIntoActiveWord, [0, 2, 5], [1.0, 1.3, 1.0], { extrapolateRight: 'clamp' })
    : 1.0

  const StyleComponent =
    style === 'hormozi'  ? HormoziSubtitle
    : style === 'minimal'  ? MinimalSubtitle
    : style === 'neon'     ? NeonSubtitle
    : style === 'karaoke'  ? KaraokeSubtitle
    : style === 'boxed'    ? BoxedSubtitle
    : style === 'outline'  ? OutlineSubtitle
    : style === 'tape'     ? TapeSubtitle
    : style === 'glitch'   ? GlitchSubtitle
    : style === 'fire'     ? FireSubtitle
    : ClassicSubtitle

  // Word-level emoji: pre-compute a deterministic schedule from wordTimestamps.
  // This works correctly in Remotion export (no refs — purely frame-based).
  const wordEmojis = settings.wordEmojis ?? []
  const animatedEmojis = settings.animatedEmojis !== false

  const MIN_EMOJI_SEC = 0.8 // minimum display duration in seconds

  const emojiSchedule = useMemo(() => {
    if (!wordEmojis.length || !mergedTimestamps?.length) return []
    const normalize = (s: string) =>
      s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[.,!?;:'"«»]/g, '').trim()

    const used = new Set<number>() // one match per wordTimestamp entry — no repetitions
    const schedule: { emoji: string; idx: number; startFrame: number; endFrame: number }[] = []

    for (let ei = 0; ei < wordEmojis.length; ei++) {
      const target = normalize(wordEmojis[ei].word)
      if (!target) continue
      // Find first unmatched timestamp with exact normalized match
      const matchIdx = mergedTimestamps.findIndex((wt, i) => !used.has(i) && normalize(wt.word) === target)
      if (matchIdx < 0) continue
      used.add(matchIdx)
      const startFrame = Math.floor(mergedTimestamps[matchIdx].start * fps)
      const naturalEnd = Math.ceil(mergedTimestamps[matchIdx].end * fps)
      const minEnd = startFrame + Math.round(fps * MIN_EMOJI_SEC)
      schedule.push({ emoji: wordEmojis[ei].emoji, idx: ei, startFrame, endFrame: Math.max(naturalEnd, minEnd) })
    }

    return schedule
  }, [wordEmojis, mergedTimestamps, fps])

  const activeSchedule = emojiSchedule.find(s => frame >= s.startFrame && frame <= s.endFrame) ?? null
  const framesIntoDisplay = activeSchedule ? Math.max(0, frame - activeSchedule.startFrame) : 0

  const subtitlesNode = settings.enabled && hasWords && (
    <>
      {/* Word-level animated emoji — deterministic schedule, works in export */}
      {activeSchedule && animatedEmojis && (
        <EmojiPop
          emoji={activeSchedule.emoji}
          framesIntoActiveWord={framesIntoDisplay}
          fps={fps}
          subtitlePositionPct={position}
          emojiIndex={activeSchedule.idx}
        />
      )}
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
    </>
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
  const ltEntry = lowerThird ? spring({ frame, fps, config: { damping: 20, stiffness: 80 } }) : 0
  // Persistent: stay fully visible; non-persistent: fade out at 3s
  const ltOpacity = lowerThird
    ? lowerThird.persistent
      ? interpolate(ltEntry, [0, 1], [0, 1])
      : interpolate(frame, [0, fps * 0.3, fps * 3, fps * 3.5], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0
  const ltTranslateX = interpolate(ltEntry, [0, 1], [-220, 0])

  const ltStyle     = lowerThird?.style    ?? 'bar'
  const ltPos       = lowerThird?.position ?? 'bottom-left'
  const ltNameColor = lowerThird?.nameColor  ?? '#FFFFFF'
  const ltTitleColor = lowerThird?.titleColor ?? 'rgba(255,255,255,0.75)'
  const ltAccent    = lowerThird?.accentColor ?? '#FFFFFF'
  const ltBg        = lowerThird?.bgColor ?? 'rgba(0,0,0,0.55)'
  const ltFontSize  = lowerThird?.fontSize ?? 22

  const ltPositionStyle: React.CSSProperties =
    ltPos === 'bottom-left'   ? { bottom: 80, left: 40 }
    : ltPos === 'bottom-center' ? { bottom: 80, left: '50%', transform: `translateX(calc(-50% + ${ltTranslateX}px))` }
    : ltPos === 'bottom-right'  ? { bottom: 80, right: 40 }
    : ltPos === 'top-left'      ? { top: 80,    left: 40 }
    :                             { top: 80,    right: 40 }

  // For non-center positions use translateX, center uses combined transform above
  const ltTransform = ltPos === 'bottom-center'
    ? undefined
    : `translateX(${ltTranslateX}px)`

  const lowerThirdNode = lowerThird && (
    <div style={{
      position: 'absolute',
      zIndex: 3,
      opacity: ltOpacity,
      transform: ltTransform,
      ...ltPositionStyle,
      display: 'flex',
      alignItems: 'stretch',
    }}>
      {/* BAR style */}
      {ltStyle === 'bar' && <>
        <div style={{ width: 4, background: ltAccent, borderRadius: 2, marginRight: 12, flexShrink: 0 }} />
        <div>
          <p style={{ color: ltNameColor, fontWeight: 800, fontSize: ltFontSize, lineHeight: 1.2, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>{lowerThird.name}</p>
          {lowerThird.title && <p style={{ color: ltTitleColor, fontWeight: 400, fontSize: ltFontSize * 0.64, margin: 0, marginTop: 3, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{lowerThird.title}</p>}
        </div>
      </>}

      {/* PILL style */}
      {ltStyle === 'pill' && (
        <div style={{ background: ltBg, borderRadius: 40, padding: `${ltFontSize * 0.45}px ${ltFontSize * 0.9}px`, backdropFilter: 'blur(8px)', border: `1.5px solid ${ltAccent}33` }}>
          <p style={{ color: ltNameColor, fontWeight: 800, fontSize: ltFontSize, lineHeight: 1.2, margin: 0 }}>{lowerThird.name}</p>
          {lowerThird.title && <p style={{ color: ltTitleColor, fontWeight: 400, fontSize: ltFontSize * 0.64, margin: 0, marginTop: 2 }}>{lowerThird.title}</p>}
        </div>
      )}

      {/* MINIMAL style */}
      {ltStyle === 'minimal' && (
        <div style={{ borderBottom: `2px solid ${ltAccent}`, paddingBottom: 6 }}>
          <p style={{ color: ltNameColor, fontWeight: 600, fontSize: ltFontSize, lineHeight: 1.2, margin: 0, letterSpacing: 1 }}>{lowerThird.name}</p>
          {lowerThird.title && <p style={{ color: ltTitleColor, fontWeight: 300, fontSize: ltFontSize * 0.64, margin: 0, marginTop: 2, letterSpacing: 2, textTransform: 'uppercase' }}>{lowerThird.title}</p>}
        </div>
      )}

      {/* BOLD style */}
      {ltStyle === 'bold' && (
        <div style={{ background: ltAccent, padding: `${ltFontSize * 0.3}px ${ltFontSize * 0.7}px` }}>
          <p style={{ color: ltBg, fontWeight: 900, fontSize: ltFontSize, lineHeight: 1.2, margin: 0, textTransform: 'uppercase' }}>{lowerThird.name}</p>
          {lowerThird.title && <p style={{ color: ltBg, fontWeight: 400, fontSize: ltFontSize * 0.6, margin: 0, marginTop: 2, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 }}>{lowerThird.title}</p>}
        </div>
      )}

      {/* NEON style */}
      {ltStyle === 'neon' && (
        <div style={{ borderLeft: `3px solid ${ltAccent}`, paddingLeft: 12 }}>
          <p style={{ color: ltAccent, fontWeight: 800, fontSize: ltFontSize, lineHeight: 1.2, margin: 0, textShadow: `0 0 12px ${ltAccent}CC, 0 0 30px ${ltAccent}66` }}>{lowerThird.name}</p>
          {lowerThird.title && <p style={{ color: ltTitleColor, fontWeight: 400, fontSize: ltFontSize * 0.64, margin: 0, marginTop: 3, textShadow: `0 0 8px ${ltAccent}55` }}>{lowerThird.title}</p>}
        </div>
      )}

      {/* CORPORATE style — semi-transparent dark panel, accent top border */}
      {ltStyle === 'corporate' && (
        <div style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', borderTop: `3px solid ${ltAccent}`, padding: `${ltFontSize * 0.5}px ${ltFontSize * 0.9}px`, minWidth: 200 }}>
          <p style={{ color: ltNameColor, fontWeight: 700, fontSize: ltFontSize, lineHeight: 1.2, margin: 0, letterSpacing: 0.5 }}>{lowerThird.name}</p>
          {lowerThird.title && <p style={{ color: ltTitleColor, fontWeight: 400, fontSize: ltFontSize * 0.6, margin: 0, marginTop: 4, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>{lowerThird.title}</p>}
        </div>
      )}

      {/* EXECUTIVE style — dark bg, gold accent line, serif feel */}
      {ltStyle === 'executive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, ${ltAccent}, transparent)`, marginBottom: 8, width: '100%' }} />
          <p style={{ color: ltNameColor, fontWeight: 300, fontSize: ltFontSize, lineHeight: 1.2, margin: 0, letterSpacing: 3, textTransform: 'uppercase' }}>{lowerThird.name}</p>
          {lowerThird.title && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <div style={{ width: 20, height: 1, background: ltAccent, opacity: 0.8 }} />
              <p style={{ color: ltTitleColor, fontWeight: 400, fontSize: ltFontSize * 0.58, margin: 0, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8 }}>{lowerThird.title}</p>
            </div>
          )}
        </div>
      )}

      {/* BROADCAST style — solid color band, classic TV news */}
      {ltStyle === 'broadcast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 220 }}>
          <div style={{ background: ltAccent, padding: `${ltFontSize * 0.3}px ${ltFontSize * 0.7}px` }}>
            <p style={{ color: ltBg || '#000000', fontWeight: 800, fontSize: ltFontSize, lineHeight: 1.2, margin: 0 }}>{lowerThird.name}</p>
          </div>
          {lowerThird.title && (
            <div style={{ background: 'rgba(0,0,0,0.85)', padding: `${ltFontSize * 0.2}px ${ltFontSize * 0.7}px` }}>
              <p style={{ color: ltTitleColor, fontWeight: 400, fontSize: ltFontSize * 0.6, margin: 0, letterSpacing: 1 }}>{lowerThird.title}</p>
            </div>
          )}
        </div>
      )}

      {/* CLEAN style — white bg card, minimal shadow, LinkedIn/corporate deck feel */}
      {ltStyle === 'clean' && (
        <div style={{ background: '#FFFFFF', borderRadius: 6, padding: `${ltFontSize * 0.45}px ${ltFontSize * 0.8}px`, boxShadow: '0 4px 24px rgba(0,0,0,0.35)', borderLeft: `4px solid ${ltAccent}` }}>
          <p style={{ color: '#111111', fontWeight: 700, fontSize: ltFontSize, lineHeight: 1.2, margin: 0 }}>{lowerThird.name}</p>
          {lowerThird.title && <p style={{ color: '#555555', fontWeight: 400, fontSize: ltFontSize * 0.62, margin: 0, marginTop: 3 }}>{lowerThird.title}</p>}
        </div>
      )}

      {/* EDITORIAL style — magazine/press kit, large name, hairline rule */}
      {ltStyle === 'editorial' && (
        <div style={{ borderBottom: `1px solid ${ltAccent}66`, paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <p style={{ color: ltNameColor, fontWeight: 900, fontSize: ltFontSize * 1.1, lineHeight: 1, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{lowerThird.name}</p>
            {lowerThird.title && <div style={{ width: 1, height: ltFontSize * 0.8, background: ltAccent, opacity: 0.5 }} />}
            {lowerThird.title && <p style={{ color: ltTitleColor, fontWeight: 300, fontSize: ltFontSize * 0.6, margin: 0, letterSpacing: 2, textTransform: 'uppercase' }}>{lowerThird.title}</p>}
          </div>
        </div>
      )}
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
        {/* Single video element — blurred background achieved via CSS on a wrapper div */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: videoTransform,
            filter: videoFilter,
          }}
        >
          {/* Blurred background — OffthreadVideo renders as image (no HTMLVideoElement buffer) */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <OffthreadVideo
              src={videoUrl}
              muted
              {...(startFromFrame ? { startFrom: startFromFrame } : {})}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(22px)',
                transform: 'scale(1.12)',
                opacity: 0.55,
              }}
            />
          </div>
          {/* Foreground centered video */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Video src={videoUrl} {...(startFromFrame ? { startFrom: startFromFrame } : {})} style={{ width: '100%', objectFit: 'contain' }} />
          </div>
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
      <div style={{ position: 'absolute', inset: 0, transform: videoTransform, filter: videoFilter }}>
        <Video src={videoUrl} {...(startFromFrame ? { startFrom: startFromFrame } : {})} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {progressBarNode}
      {subtitlesNode}
      {lowerThirdNode}
      {flashNode}
    </AbsoluteFill>
  )
}
