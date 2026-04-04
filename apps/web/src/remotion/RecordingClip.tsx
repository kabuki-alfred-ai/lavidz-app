import { AbsoluteFill, Audio, Video, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { useMemo } from 'react'
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
  // Detects emphasis moments (post-pause, long word, sentence start) and snaps
  // to a new zoom level, holding it for several seconds before the next reframe.
  // Feels like a human cameraperson adjusting the shot, not a mechanical pulse.

  // Zoom levels the camera cycles through (like changing shot composition)
  const ZOOM_LEVELS = [1.0, 1.30, 1.12, 1.40, 1.05, 1.25, 1.08, 1.35]
  // Transition speed: snap to new zoom in ~10 frames (≈0.33s at 30fps)
  const SNAP_FRAMES = 1
  // Min hold between reframes (1.8s) — avoids nausea-inducing rapid changes
  const MIN_HOLD_FRAMES = Math.round(fps * 1.8)

  const zoomKeyframes = useMemo((): ZoomKeyframe[] => {
    if (!motionSettings?.dynamicZoom) return []

    const kf: ZoomKeyframe[] = [{ frame: 0, scale: 1.0 }]
    let lastFrame = 0
    let levelIdx = 0

    if (mergedTimestamps && mergedTimestamps.length > 0) {
      for (let i = 1; i < mergedTimestamps.length; i++) {
        const w = mergedTimestamps[i]
        const prev = mergedTimestamps[i - 1]
        const triggerFrame = Math.round(w.start * fps)

        if (triggerFrame - lastFrame < MIN_HOLD_FRAMES) continue

        const gap = w.start - prev.end           // silence before this word
        const wordDur = w.end - w.start           // duration = emphasis proxy
        const afterPunct = /[.!?,;]/.test(prev.word)

        // Emphasis score: pause ≥0.2s, long word ≥0.32s, after sentence end
        const isEmphasis = gap >= 0.2 || wordDur >= 0.32 || afterPunct

        if (isEmphasis) {
          levelIdx++
          kf.push({ frame: triggerFrame, scale: ZOOM_LEVELS[levelIdx % ZOOM_LEVELS.length] })
          lastFrame = triggerFrame
        }
      }
    }

    // Fallback: fixed interval every 2.5s when no word timestamps or too few events
    if (kf.length < 3) {
      const interval = Math.round(fps * 2.5)
      for (let f = interval; f < durationInFrames; f += interval) {
        levelIdx++
        kf.push({ frame: f, scale: ZOOM_LEVELS[levelIdx % ZOOM_LEVELS.length] })
      }
    }

    return kf
  }, [motionSettings?.dynamicZoom, mergedTimestamps, fps, durationInFrames])

  // Compute zoom at current frame:
  // Quick snap (SNAP_FRAMES) to the keyframe's scale, then hold until next keyframe.
  let dynamicZoomScale = 1.0
  if (motionSettings?.dynamicZoom && zoomKeyframes.length >= 2) {
    // Find the most recent keyframe ≤ current frame
    let prevIdx = 0
    for (let i = 1; i < zoomKeyframes.length; i++) {
      if (zoomKeyframes[i].frame <= frame) prevIdx = i
      else break
    }
    const curr = zoomKeyframes[prevIdx]
    const fromScale = prevIdx > 0 ? zoomKeyframes[prevIdx - 1].scale : curr.scale
    const framesSince = frame - curr.frame

    if (framesSince < SNAP_FRAMES) {
      // Transition: smoothstep from fromScale → curr.scale
      const t = framesSince / SNAP_FRAMES
      const eased = t * t * (3 - 2 * t) // smoothstep — natural camera feel
      dynamicZoomScale = fromScale + (curr.scale - fromScale) * eased
    } else {
      // Hold at current zoom level
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
