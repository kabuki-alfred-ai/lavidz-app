'use client'

import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import type { WordTimestamp } from '@/remotion/themeTypes'

interface Props {
  tokens: WordTimestamp[]
  /** Returns current local playback time for this recording (-1 = not playing) */
  getTimeSec?: () => number
  onChange?: (tokens: WordTimestamp[]) => void
}

const S = {
  text: '#e5e7eb',
  muted: '#6b7280',
  dim: '#4b5563',
  border: 'rgba(255,255,255,0.07)',
  accent: '#3b82f6',
  silentBg: 'rgba(59,130,246,0.15)',
  silentBorder: 'rgba(59,130,246,0.4)',
  activeBg: 'rgba(59,130,246,0.07)',
}

const MAJOR_SILENCE = 1.5   // gap >= this → new row
const MINOR_SILENCE = 0.35  // gap >= this → inline badge

function pad2(n: number) { return String(Math.floor(n)).padStart(2, '0') }
function hms(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${pad2(h)}:${pad2(m)}:${pad2(Math.floor(s % 60))}`
}

// ── Types ──────────────────────────────────────────────────────────────────────

type WordItem   = { kind: 'word';   tok: WordTimestamp; globalIdx: number }
type MarkerItem = { kind: 'marker'; second: number }
type GapItem    = { kind: 'gap';    duration: number }
type RowItem    = WordItem | MarkerItem | GapItem

type SpeechRow = { kind: 'speech'; words: WordTimestamp[]; start: number; end: number }
type SilentRow = { kind: 'silent'; start: number; end: number; duration: number }
type Row = SpeechRow | SilentRow

// ── Build rows ─────────────────────────────────────────────────────────────────

function buildRows(tokens: WordTimestamp[]): Row[] {
  if (!tokens.length) return []
  const rows: Row[] = []
  if (tokens[0].start > MAJOR_SILENCE)
    rows.push({ kind: 'silent', start: 0, end: tokens[0].start, duration: tokens[0].start })

  let group: WordTimestamp[] = [tokens[0]]
  for (let i = 1; i < tokens.length; i++) {
    const gap = tokens[i].start - tokens[i - 1].end
    if (gap >= MAJOR_SILENCE) {
      rows.push({ kind: 'speech', words: [...group], start: group[0].start, end: group[group.length - 1].end })
      rows.push({ kind: 'silent', start: tokens[i - 1].end, end: tokens[i].start, duration: gap })
      group = [tokens[i]]
    } else {
      group.push(tokens[i])
    }
  }
  if (group.length) rows.push({ kind: 'speech', words: [...group], start: group[0].start, end: group[group.length - 1].end })
  return rows
}

function buildRowItems(words: WordTimestamp[], tokenOffset: number): RowItem[] {
  if (!words.length) return []
  const items: RowItem[] = []
  const markers = new Set<number>()
  const firstSec = Math.floor(words[0].start)
  const lastSec  = Math.ceil(words[words.length - 1].end)
  for (let s = firstSec; s <= lastSec; s++) markers.add(s)

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    for (const s of [...markers].sort((a, b) => a - b)) {
      if (s <= w.start) { items.push({ kind: 'marker', second: s }); markers.delete(s) }
    }
    items.push({ kind: 'word', tok: w, globalIdx: tokenOffset + i })
    if (i < words.length - 1) {
      const gap = words[i + 1].start - w.end
      if (gap >= MINOR_SILENCE && gap < MAJOR_SILENCE)
        items.push({ kind: 'gap', duration: gap })
    }
  }
  for (const s of [...markers].sort((a, b) => a - b)) items.push({ kind: 'marker', second: s })
  return items
}

function redistributeWords(text: string, start: number, end: number): WordTimestamp[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const dw = (end - start) / words.length
  return words.map((w, i) => ({ word: w, start: start + i * dw, end: start + (i + 1) * dw }))
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TranscriptEditor({ tokens, getTimeSec, onChange }: Props) {
  const rows = useMemo(() => buildRows(tokens), [tokens])

  // Internal polling — updates ~10fps, only affects this subtree
  const [localTimeSec, setLocalTimeSec] = useState(-1)
  const lastT = useRef(-1)
  useEffect(() => {
    if (!getTimeSec) return
    let rafId: number
    let skip = 0
    const tick = () => {
      // Poll at ~10fps (every 3 frames at 30fps) to reduce re-renders
      if (++skip % 3 === 0) {
        const t = getTimeSec()
        // Round to 100ms to avoid tiny float jitter causing re-renders
        const rounded = Math.round(t * 10) / 10
        if (rounded !== lastT.current) { lastT.current = rounded; setLocalTimeSec(rounded) }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [getTimeSec])

  // Find active row + active word index in the full tokens array
  const { activeRowIdx, activeWordGlobalIdx } = useMemo(() => {
    if (localTimeSec < 0) return { activeRowIdx: -1, activeWordGlobalIdx: -1 }
    let offset = 0
    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri]
      if (r.kind === 'speech') {
        if (localTimeSec >= r.start && localTimeSec <= r.end + 0.1) {
          // Find word within this row
          let wi = -1
          for (let j = 0; j < r.words.length; j++) {
            if (localTimeSec >= r.words[j].start && localTimeSec <= r.words[j].end) { wi = j; break }
          }
          // If between words, keep previous
          if (wi === -1) {
            for (let j = 0; j < r.words.length; j++) {
              if (localTimeSec < r.words[j].start) { wi = j - 1; break }
            }
            if (wi === -1 && localTimeSec > (r.words[r.words.length - 1]?.start ?? 0)) wi = r.words.length - 1
          }
          return { activeRowIdx: ri, activeWordGlobalIdx: wi >= 0 ? offset + wi : -1 }
        }
        offset += r.words.length
      }
    }
    return { activeRowIdx: -1, activeWordGlobalIdx: -1 }
  }, [localTimeSec, rows])

  const handleEdit = (row: SpeechRow, newText: string) => {
    if (!onChange) return
    const newWords = redistributeWords(newText, row.start, row.end)
    const updated: WordTimestamp[] = []
    for (const r of rows) {
      if (r.kind === 'silent') continue
      updated.push(...(r === row ? newWords : r.words))
    }
    updated.sort((a, b) => a.start - b.start)
    onChange(updated)
  }

  // Compute per-row token offsets
  let tokenOffset = 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((row, i) => {
        if (row.kind === 'silent') return <SilentBlock key={i} row={row} />
        const off = tokenOffset
        tokenOffset += row.words.length
        return (
          <SpeechBlock
            key={i}
            row={row}
            tokenOffset={off}
            isActive={i === activeRowIdx}
            activeWordGlobalIdx={activeWordGlobalIdx}
            onEdit={handleEdit}
            readonly={!onChange}
          />
        )
      })}
    </div>
  )
}

// ── Silent block ───────────────────────────────────────────────────────────────

function SilentBlock({ row }: { row: SilentRow }) {
  return (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.dim }}>{hms(row.start)}</span>
      <span style={{ padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: S.silentBg, border: `1px solid ${S.silentBorder}`, color: '#93c5fd' }}>Silent</span>
      <span style={{ color: S.dim, fontSize: 11 }}>┤</span>
      <span style={{ color: S.accent, fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{row.duration.toFixed(1)}s</span>
      <span style={{ color: S.dim, fontSize: 11 }}>├</span>
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.dim, marginLeft: 'auto' }}>{hms(row.end)}</span>
    </div>
  )
}

// ── Speech block ───────────────────────────────────────────────────────────────

function SpeechBlock({ row, tokenOffset, isActive, activeWordGlobalIdx, onEdit, readonly }: {
  row: SpeechRow; tokenOffset: number; isActive: boolean
  activeWordGlobalIdx: number; onEdit: (r: SpeechRow, t: string) => void; readonly: boolean
}) {
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const items = useMemo(() => buildRowItems(row.words, tokenOffset), [row.words, tokenOffset])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.value = row.words.map(w => w.word).join(' ')
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [editing])

  const handleBlur = () => {
    const val = textareaRef.current?.value ?? ''
    onEdit(row, val)
    setEditing(false)
  }

  return (
    <div style={{
      padding: '12px 0', borderBottom: `1px solid ${S.border}`,
      borderLeft: isActive ? `2px solid ${S.accent}` : '2px solid transparent',
      paddingLeft: isActive ? 10 : 0,
      background: isActive ? S.activeBg : 'transparent',
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: S.dim }}>{hms(row.start)} – {hms(row.end)}</span>
        {!readonly && !editing && (
          <button onClick={() => setEditing(true)} style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'monospace', padding: '1px 7px', borderRadius: 4, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer' }}>
            éditer
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBlur() } }}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${S.accent}33`, borderRadius: 6, padding: '8px 10px', color: S.text, fontSize: 14, lineHeight: 1.7, outline: 'none', resize: 'none', fontFamily: 'inherit', caretColor: S.accent }}
          rows={Math.max(2, Math.ceil(row.words.length / 8))}
        />
      ) : (
        <p style={{ fontSize: 14, lineHeight: 1.9, margin: 0, cursor: readonly ? 'default' : 'text' }} onClick={() => !readonly && setEditing(true)}>
          {items.map((item, i) => {
            if (item.kind === 'marker') return (
              <span key={i} style={{ display: 'inline-block', verticalAlign: 'middle', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: S.accent, opacity: 0.7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 3, padding: '0 4px', margin: '0 4px', lineHeight: '18px' }}>
                {item.second}s
              </span>
            )
            if (item.kind === 'gap') return (
              <span key={i} style={{ display: 'inline-block', verticalAlign: 'middle', fontSize: 9, fontFamily: 'monospace', color: item.duration > 1.0 ? '#f59e0b' : S.dim, margin: '0 2px', opacity: 0.8 }}>
                ···{item.duration.toFixed(1)}s
              </span>
            )
            // word — highlight if active
            const isActiveWord = item.globalIdx === activeWordGlobalIdx
            return (
              <span key={i} style={{
                borderRadius: 3, padding: isActiveWord ? '1px 3px' : undefined,
                background: isActiveWord ? 'rgba(59,130,246,0.35)' : undefined,
                color: isActiveWord ? '#fff' : (isActive ? S.text : S.text),
                fontWeight: isActiveWord ? 600 : 400,
                transition: 'background 0.08s',
              }}>
                {item.tok.word}{' '}
              </span>
            )
          })}
        </p>
      )}
    </div>
  )
}
