'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import type { PlayerRef } from '@remotion/player'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import { END_CARD_FRAMES } from '@/remotion/LavidzComposition'
import { WaveformCanvas } from './WaveformCanvas'
import { useWaveform } from '@/hooks/useWaveform'
import { Scissors, Trash2, RotateCcw } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClipEdit {
  recordingId: string
  visibleRanges: { startFrame: number; endFrame: number }[]
}

interface TimelineBlock {
  type: 'coldopen' | 'intro' | 'question' | 'clip' | 'outro' | 'endcard'
  label: string
  startFrame: number
  durationFrames: number
  segmentId?: string
  /** Index within ClipEdit.visibleRanges for sub-clips */
  rangeIndex?: number
  color: string
  videoUrl?: string
}

interface Props {
  segments: CompositionSegment[] | null
  coldOpenFrames?: number
  introFrames: number
  outroFrames: number
  questionCardFrames: number
  fps: number
  playerRef: React.RefObject<PlayerRef | null>
  playerFrameRef: React.RefObject<number>
  /** Clip edits state managed by parent */
  clipEdits: ClipEdit[]
  onSplit: (recordingId: string, frameInClip: number) => void
  onDeleteRange: (recordingId: string, rangeIndex: number) => void
  onResetClip: (recordingId: string) => void
  onUndo?: () => void
  playbackRate: number
  onPlaybackRateChange: (rate: number) => void
}

// ── Colors ─────────────────────────────────────────────────────────────────

const CLIP_COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#EC4899', '#10B981']
const Q_COLOR = 'rgba(255,255,255,0.12)'
const COLDOPEN_COLOR = '#F97316'
const INTRO_COLOR = '#22C55E'
const OUTRO_COLOR = '#EF4444'
const ENDCARD_COLOR = 'rgba(255,255,255,0.08)'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(frame: number, fps: number): string {
  const s = frame / fps
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Waveform wrapper per clip ──────────────────────────────────────────────

function ClipWaveform({ videoUrl, width, height, progress }: { videoUrl: string; width: number; height: number; progress: number }) {
  const peaks = useWaveform(videoUrl)
  return <WaveformCanvas peaks={peaks} width={width} height={height} progress={progress} />
}

// ── Main Timeline ──────────────────────────────────────────────────────────

export function Timeline({
  segments,
  coldOpenFrames = 0,
  introFrames,
  outroFrames,
  questionCardFrames,
  fps,
  playerRef,
  playerFrameRef,
  clipEdits,
  onSplit,
  onDeleteRange,
  onResetClip,
  onUndo,
  playbackRate,
  onPlaybackRateChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pixelsPerFrame, setPixelsPerFrame] = useState(0.8)
  const [playheadFrame, setPlayheadFrame] = useState(0)
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // ── Build blocks from segments + clipEdits ──────────────────────────────

  const { blocks, totalFrames } = useMemo(() => {
    if (!segments?.length) return { blocks: [] as TimelineBlock[], totalFrames: 1 }

    const result: TimelineBlock[] = []
    let offset = 0

    // Cold Open
    if (coldOpenFrames > 0) {
      result.push({ type: 'coldopen', label: '🎬 Hook', startFrame: 0, durationFrames: coldOpenFrames, color: COLDOPEN_COLOR })
      offset = coldOpenFrames
    }

    // Intro
    if (introFrames > 0) {
      result.push({ type: 'intro', label: 'Intro', startFrame: offset, durationFrames: introFrames, color: INTRO_COLOR })
      offset += introFrames
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const qFrames = seg.questionDurationFrames ?? questionCardFrames

      // Question card
      result.push({
        type: 'question', label: `Q${i + 1}`, startFrame: offset,
        durationFrames: qFrames, segmentId: seg.id, color: Q_COLOR,
      })
      offset += qFrames

      // Clip — check for edits
      const edit = clipEdits.find(e => e.recordingId === seg.id)
      if (edit && edit.visibleRanges.length > 0) {
        // Render sub-clips
        for (let r = 0; r < edit.visibleRanges.length; r++) {
          const range = edit.visibleRanges[r]
          const dur = range.endFrame - range.startFrame
          result.push({
            type: 'clip', label: `V${i + 1}.${r + 1}`, startFrame: offset,
            durationFrames: dur, segmentId: seg.id, rangeIndex: r,
            color: CLIP_COLORS[i % CLIP_COLORS.length], videoUrl: seg.videoUrl,
          })
          offset += dur
        }
      } else {
        // Full clip
        result.push({
          type: 'clip', label: `V${i + 1}`, startFrame: offset,
          durationFrames: seg.videoDurationFrames, segmentId: seg.id,
          color: CLIP_COLORS[i % CLIP_COLORS.length], videoUrl: seg.videoUrl,
        })
        offset += seg.videoDurationFrames
      }
    }

    // Outro
    if (outroFrames > 0) {
      result.push({ type: 'outro', label: 'Outro', startFrame: offset, durationFrames: outroFrames, color: OUTRO_COLOR })
      offset += outroFrames
    }

    // End card
    result.push({ type: 'endcard', label: 'End', startFrame: offset, durationFrames: END_CARD_FRAMES, color: ENDCARD_COLOR })
    offset += END_CARD_FRAMES

    return { blocks: result, totalFrames: offset }
  }, [segments, coldOpenFrames, introFrames, outroFrames, questionCardFrames, clipEdits])

  const timelineWidth = totalFrames * pixelsPerFrame

  // ── Playhead RAF sync ───────────────────────────────────────────────────

  useEffect(() => {
    let rafId: number
    const tick = () => {
      const f = playerFrameRef.current ?? 0
      setPlayheadFrame(f)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [playerFrameRef])

  // Auto-scroll to playhead
  useEffect(() => {
    if (!autoScroll || !containerRef.current) return
    const el = containerRef.current
    const phX = playheadFrame * pixelsPerFrame
    const scrollLeft = el.scrollLeft
    const viewWidth = el.clientWidth
    if (phX < scrollLeft + 60 || phX > scrollLeft + viewWidth - 60) {
      el.scrollLeft = phX - viewWidth / 3
    }
  }, [playheadFrame, pixelsPerFrame, autoScroll])

  // ── Click-to-seek ───────────────────────────────────────────────────────

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0)
    const frame = Math.round(x / pixelsPerFrame)
    const clamped = Math.max(0, Math.min(frame, totalFrames - 1))
    ;(playerRef.current as any)?.seekTo?.(clamped)
    setAutoScroll(false)
  }, [pixelsPerFrame, totalFrames, playerRef])

  // ── Split handler ───────────────────────────────────────────────────────

  const handleSplit = useCallback((block: TimelineBlock) => {
    if (block.type !== 'clip' || !block.segmentId) return
    // Frame within this block where the playhead is
    const frameInBlock = playheadFrame - block.startFrame
    if (frameInBlock <= 0 || frameInBlock >= block.durationFrames) return

    // If this is a sub-clip, we need the frame relative to the original video
    const edit = clipEdits.find(e => e.recordingId === block.segmentId)
    if (edit && block.rangeIndex !== undefined) {
      const range = edit.visibleRanges[block.rangeIndex]
      onSplit(block.segmentId, range.startFrame + frameInBlock)
    } else {
      onSplit(block.segmentId, frameInBlock)
    }
  }, [playheadFrame, clipEdits, onSplit])

  // ── Zoom ────────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setPixelsPerFrame(p => Math.max(0.05, Math.min(5, p * (1 - e.deltaY * 0.002))))
    }
  }, [])

  // ── Playback speed ──────────────────────────────────────────────────────

  const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 's' || e.key === 'S') {
        // Split at playhead
        const block = blocks.find(b => b.type === 'clip' && playheadFrame >= b.startFrame && playheadFrame < b.startFrame + b.durationFrames)
        if (block) handleSplit(block)
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onUndo?.()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete hovered block
        const block = blocks.find(b => b.type === 'clip' && b.rangeIndex !== undefined && playheadFrame >= b.startFrame && playheadFrame < b.startFrame + b.durationFrames)
        if (block?.segmentId != null && block.rangeIndex != null) onDeleteRange(block.segmentId, block.rangeIndex)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [blocks, playheadFrame, handleSplit])

  if (!segments?.length) return null

  const playheadX = playheadFrame * pixelsPerFrame

  // ── Ruler marks ─────────────────────────────────────────────────────────

  const rulerMarks: { x: number; label: string }[] = []
  const stepFrames = Math.max(fps, Math.round((80 / pixelsPerFrame) / fps) * fps) // ~80px between marks
  for (let f = 0; f <= totalFrames; f += stepFrames) {
    rulerMarks.push({ x: f * pixelsPerFrame, label: formatTime(f, fps) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#0A0A0F', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 }}>Timeline</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}>{formatTime(playheadFrame, fps)}</span>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace' }}>/</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}>{formatTime(totalFrames, fps)}</span>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.06)' }} />
        {/* Playback speed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {SPEED_OPTIONS.map(rate => (
            <button key={rate} onClick={() => onPlaybackRateChange(rate)}
              style={{
                padding: '2px 5px', borderRadius: 4, fontSize: 9, fontFamily: 'monospace',
                background: playbackRate === rate ? 'rgba(59,130,246,0.25)' : 'transparent',
                color: playbackRate === rate ? '#60A5FA' : 'rgba(255,255,255,0.3)',
                border: playbackRate === rate ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                cursor: 'pointer', lineHeight: 1,
              }}
            >
              {rate}x
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.06)' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="range" min={0.05} max={3} step={0.05} value={pixelsPerFrame}
            onChange={e => setPixelsPerFrame(Number(e.target.value))}
            style={{ width: 60, accentColor: '#3B82F6', height: 3 }}
          />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}>zoom</span>
        </label>
        <button onClick={() => setAutoScroll(!autoScroll)}
          style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontFamily: 'monospace', background: autoScroll ? 'rgba(59,130,246,0.2)' : 'transparent', color: autoScroll ? '#60A5FA' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer' }}
        >
          follow
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, fontFamily: 'monospace' }}>S = couper</span>
      </div>

      {/* Scrollable timeline area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        style={{ overflowX: 'auto', overflowY: 'hidden', position: 'relative', cursor: 'pointer' }}
        onClick={handleTimelineClick}
      >
        <div style={{ width: timelineWidth, position: 'relative', minHeight: 120 }}>

          {/* Ruler */}
          <div style={{ height: 20, position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {rulerMarks.map((m, i) => (
              <div key={i} style={{ position: 'absolute', left: m.x, top: 0, height: '100%' }}>
                <div style={{ width: 1, height: 8, background: 'rgba(255,255,255,0.15)' }} />
                <span style={{ position: 'absolute', top: 8, left: 2, fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{m.label}</span>
              </div>
            ))}
          </div>

          {/* Video track */}
          <div style={{ height: 44, position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {blocks.map((block, i) => {
              const left = block.startFrame * pixelsPerFrame
              const width = Math.max(2, block.durationFrames * pixelsPerFrame)
              const isClip = block.type === 'clip'
              const isHovered = hoveredBlock === `${block.segmentId}-${block.rangeIndex ?? 'full'}-${i}`
              const playheadInBlock = playheadFrame >= block.startFrame && playheadFrame < block.startFrame + block.durationFrames
              const hasEdit = isClip && block.segmentId && clipEdits.some(e => e.recordingId === block.segmentId && e.visibleRanges.length > 1)
              const blockKey = `${block.segmentId}-${block.rangeIndex ?? 'full'}-${i}`

              return (
                <div
                  key={blockKey}
                  onMouseEnter={() => setHoveredBlock(blockKey)}
                  onMouseLeave={() => setHoveredBlock(null)}
                  style={{
                    position: 'absolute', left, width, top: 2, bottom: 2,
                    background: block.color,
                    borderRadius: 4,
                    border: isHovered ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', transition: 'border 0.15s',
                  }}
                >
                  {width > 30 && (
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', fontWeight: 600, pointerEvents: 'none', userSelect: 'none' }}>
                      {block.label}
                    </span>
                  )}

                  {/* Split button — appears when playhead is in this clip and hovered */}
                  {isClip && isHovered && playheadInBlock && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSplit(block) }}
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 20, height: 20, borderRadius: 4,
                        background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', zIndex: 5,
                      }}
                      title="Couper ici (S)"
                    >
                      <Scissors size={10} color="#fff" />
                    </button>
                  )}

                  {/* Delete button for sub-clips */}
                  {isClip && isHovered && block.rangeIndex !== undefined && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (block.segmentId != null && block.rangeIndex != null) onDeleteRange(block.segmentId, block.rangeIndex) }}
                      style={{
                        position: 'absolute', bottom: 2, right: 2,
                        width: 20, height: 20, borderRadius: 4,
                        background: 'rgba(239,68,68,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', zIndex: 5,
                      }}
                      title="Supprimer ce segment"
                    >
                      <Trash2 size={10} color="#fff" />
                    </button>
                  )}

                  {/* Reset button when clip has edits */}
                  {isClip && isHovered && hasEdit && block.rangeIndex === 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (block.segmentId) onResetClip(block.segmentId) }}
                      style={{
                        position: 'absolute', top: 2, left: 2,
                        width: 20, height: 20, borderRadius: 4,
                        background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', zIndex: 5,
                      }}
                      title="Restaurer le clip original"
                    >
                      <RotateCcw size={10} color="#fff" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Audio waveform track */}
          <div style={{ height: 36, position: 'relative' }}>
            {blocks.filter(b => b.type === 'clip' && b.videoUrl).map((block, i) => {
              const left = block.startFrame * pixelsPerFrame
              const width = Math.max(2, block.durationFrames * pixelsPerFrame)
              const clipProgress = playheadFrame >= block.startFrame
                ? Math.min(1, (playheadFrame - block.startFrame) / block.durationFrames)
                : 0

              return (
                <div key={`wave-${i}`} style={{ position: 'absolute', left, width: Math.max(2, width), top: 2, bottom: 2, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
                  <ClipWaveform videoUrl={block.videoUrl!} width={Math.max(2, Math.floor(width))} height={32} progress={clipProgress} />
                </div>
              )
            })}
          </div>

          {/* Playhead */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: playheadX,
            width: 2, background: '#EF4444', zIndex: 10, pointerEvents: 'none',
            boxShadow: '0 0 6px rgba(239,68,68,0.5)',
          }}>
            {/* Playhead handle */}
            <div style={{
              position: 'absolute', top: -2, left: -5,
              width: 12, height: 12, background: '#EF4444', borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
            }} />
          </div>

        </div>
      </div>
    </div>
  )
}
